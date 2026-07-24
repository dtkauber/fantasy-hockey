"""
Scoring engine: turns raw player_game_stats rows into fantasy points,
using a league's configurable scoring_rules. Nothing here is hardcoded
to a specific scoring format on purpose -- every league can weight
categories differently.
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, case, func
from datetime import date

from ..models import PlayerGameStat, Game, ScoringRule, RosterSlot, WeeklyScore


def get_scoring_map(db: Session, league_id: int) -> dict[str, float]:
    """league_id -> {stat_name: points_per} e.g. {'goals': 3.0, 'assists': 2.0, ...}"""
    rules = db.query(ScoringRule).filter(ScoringRule.league_id == league_id).all()
    return {r.stat_name: float(r.points_per) for r in rules}


def score_stat_line(stat_row: PlayerGameStat, scoring_map: dict[str, float]) -> float:
    """Dot-product of one game's stat line against the league's point values."""
    total = 0.0
    for stat_name, points_per in scoring_map.items():
        value = getattr(stat_row, stat_name, None)
        if value is None:
            continue
        # booleans (is_win, is_shutout) count as 0/1 multipliers
        total += (1 if value is True else (0 if value is False else value)) * points_per
    return round(total, 2)


def compute_weekly_score(db: Session, fantasy_team_id: int, week_start: date) -> float:
    """
    Sums fantasy points for every player in a team's *starting* roster slots
    (excludes BENCH/IR) for games played during that scoring week, then
    upserts the result into weekly_scores.
    """
    slots = (
        db.query(RosterSlot)
        .filter(
            RosterSlot.fantasy_team_id == fantasy_team_id,
            RosterSlot.week_start == week_start,
            RosterSlot.slot_type.notin_(["BENCH", "IR"]),
        )
        .all()
    )
    if not slots:
        return 0.0

    league_id = _league_id_for_team(db, fantasy_team_id)
    scoring_map = get_scoring_map(db, league_id)
    player_ids = [s.player_id for s in slots]

    stat_rows = (
        db.query(PlayerGameStat)
        .join(Game, PlayerGameStat.game_id == Game.game_id)
        .filter(
            PlayerGameStat.player_id.in_(player_ids),
            Game.game_date >= week_start,
        )
        .all()
    )

    total = sum(score_stat_line(row, scoring_map) for row in stat_rows)

    existing = db.query(WeeklyScore).filter(
        and_(WeeklyScore.fantasy_team_id == fantasy_team_id, WeeklyScore.week_start == week_start)
    ).first()
    if existing:
        existing.total_points = total
    else:
        db.add(WeeklyScore(fantasy_team_id=fantasy_team_id, week_start=week_start, total_points=total))
    db.commit()
    return total


def _league_id_for_team(db: Session, fantasy_team_id: int) -> int:
    from ..models import FantasyTeam
    team = db.query(FantasyTeam).filter(FantasyTeam.fantasy_team_id == fantasy_team_id).first()
    return team.league_id


def default_points_expr():
    """
    SQL expression (not a Python value) computing fantasy points per
    player_game_stats row using DEFAULT_SCORING_RULES -- for aggregate
    queries like overall player rankings, where doing this row-by-row
    in Python would mean pulling the whole stats table into memory.
    """
    terms = []
    for rule in DEFAULT_SCORING_RULES:
        col = getattr(PlayerGameStat, rule["stat_name"])
        weight = rule["points_per"]
        if rule["stat_name"] in ("is_win", "is_shutout"):
            terms.append(case((col.is_(True), weight), else_=0.0))
        else:
            terms.append(func.coalesce(col, 0) * weight)
    expr = terms[0]
    for term in terms[1:]:
        expr = expr + term
    return expr


DEFAULT_SCORING_RULES = [
    # skater categories
    {"stat_name": "goals", "points_per": 3.0},
    {"stat_name": "assists", "points_per": 2.0},
    {"stat_name": "plus_minus", "points_per": 0.5},
    {"stat_name": "pim", "points_per": 0.25},
    {"stat_name": "shots", "points_per": 0.2},
    {"stat_name": "hits", "points_per": 0.2},
    {"stat_name": "blocks", "points_per": 0.3},
    # goalie categories
    {"stat_name": "saves", "points_per": 0.2},
    {"stat_name": "is_win", "points_per": 4.0},
    {"stat_name": "is_shutout", "points_per": 3.0},
    {"stat_name": "goals_against", "points_per": -1.0},
]
