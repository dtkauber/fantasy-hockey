from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..database import get_db
from ..models import Player, DraftPick, PlayerGameStat, Game
from ..schemas import PlayerOut, PlayerRankingOut, PlayerProjectionOut
from ..services.scoring import default_points_expr
from ..services.projections import compute_skater_projections

router = APIRouter(prefix="/players", tags=["players"])


def _most_recent_season(db: Session) -> str | None:
    return db.query(func.max(Game.season)).scalar()


@router.get("/rankings", response_model=list[PlayerRankingOut])
def player_rankings(
    db: Session = Depends(get_db),
    position: str | None = None,
    search: str | None = Query(None, description="Substring match on player name"),
    season: str | None = Query(None, description="e.g. '20252026'; defaults to the most recent synced season"),
    limit: int = 100,
):
    """
    Ranks players by total fantasy points within one season, using the
    default scoring weights (goals, assists, etc. -- see scoring.py).
    This is season-to-date value, not a single-game snapshot.
    """
    season = season or _most_recent_season(db)
    points_expr = default_points_expr()
    total_points = func.sum(points_expr)
    games_played = func.count(PlayerGameStat.stat_id)
    points_stddev = func.stddev_samp(points_expr)

    q = (
        db.query(
            Player.player_id,
            Player.full_name,
            Player.position,
            Player.team_id,
            games_played.label("games_played"),
            func.sum(PlayerGameStat.goals).label("goals"),
            func.sum(PlayerGameStat.assists).label("assists"),
            func.sum(PlayerGameStat.shots).label("shots"),
            func.sum(PlayerGameStat.hits).label("hits"),
            func.sum(PlayerGameStat.blocks).label("blocks"),
            func.sum(PlayerGameStat.pim).label("pim"),
            total_points.label("total_points"),
            points_stddev.label("points_stddev"),
        )
        .join(PlayerGameStat, PlayerGameStat.player_id == Player.player_id)
        .join(Game, Game.game_id == PlayerGameStat.game_id)
        .filter(Game.season == season)
        .group_by(Player.player_id, Player.full_name, Player.position, Player.team_id)
    )
    if position:
        q = q.filter(Player.position == position)
    if search:
        q = q.filter(Player.full_name.ilike(f"%{search}%"))

    rows = q.order_by(total_points.desc()).limit(limit).all()
    results = []
    for r in rows:
        ppg = round(float(r.total_points or 0) / r.games_played, 2) if r.games_played else 0.0
        stddev = float(r.points_stddev or 0)
        results.append(
            PlayerRankingOut(
                player_id=r.player_id,
                full_name=r.full_name,
                position=r.position,
                team_id=r.team_id,
                games_played=r.games_played,
                goals=r.goals or 0,
                assists=r.assists or 0,
                points=(r.goals or 0) + (r.assists or 0),
                shots=r.shots or 0,
                hits=r.hits or 0,
                blocks=r.blocks or 0,
                pim=r.pim or 0,
                total_points=round(float(r.total_points or 0), 2),
                points_per_game=ppg,
                consistency_stddev=round(stddev, 2),
                # coefficient of variation: stddev relative to mean, so it's comparable
                # across players scoring at very different levels. Lower = more consistent.
                boom_bust_ratio=round(stddev / ppg, 2) if ppg else 0.0,
            )
        )
    return results


@router.get("/projections", response_model=list[PlayerProjectionOut])
def player_projections(
    db: Session = Depends(get_db),
    position: str | None = None,
    search: str | None = Query(None, description="Substring match on player name"),
    season: str | None = None,
    limit: int = 100,
):
    """
    Skater-only projections for next season: each player's rate stats are
    stabilized via empirical-Bayes shrinkage toward their position's league
    average (more games played = trust their own rate more), then scaled to
    an 82-game season. See services/projections.py for the method -- this is
    NOT a next-season forecast in the ML-forecasting sense (that needs
    multiple years of history to validate); it's a standard technique for
    separating signal from single-season sample noise.
    """
    season = season or _most_recent_season(db)
    results = compute_skater_projections(db, season)
    if position:
        results = [r for r in results if r["position"] == position]
    if search:
        needle = search.lower()
        results = [r for r in results if needle in r["full_name"].lower()]
    results.sort(key=lambda r: r["projected_fantasy_points_per_82"], reverse=True)
    return results[:limit]


@router.get("", response_model=list[PlayerOut])
def list_players(
    db: Session = Depends(get_db),
    position: str | None = None,
    team_id: int | None = None,
    search: str | None = Query(None, description="Substring match on player name"),
    undrafted_in_league: int | None = Query(None, description="league_id to exclude already-drafted players"),
    limit: int = 100,
):
    q = db.query(Player).filter(Player.is_active == True)  # noqa: E712
    if position:
        q = q.filter(Player.position == position)
    if team_id:
        q = q.filter(Player.team_id == team_id)
    if search:
        q = q.filter(Player.full_name.ilike(f"%{search}%"))
    if undrafted_in_league:
        drafted_ids = db.query(DraftPick.player_id).filter(
            DraftPick.league_id == undrafted_in_league
        )
        q = q.filter(~Player.player_id.in_(drafted_ids))
    return q.order_by(Player.full_name).limit(limit).all()


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db)):
    return db.query(Player).filter(Player.player_id == player_id).first()
