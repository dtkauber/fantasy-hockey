"""
Skater stat projections via empirical-Bayes (Gamma-Poisson) shrinkage.

This is deliberately NOT a next-season forecasting model. A real forecast
(the kind that predicts *change* year over year -- aging, injury recovery,
role changes) needs multiple seasons of history to fit and validate against,
which we don't have yet.

What this *is*: a standard sabermetrics technique for separating signal from
single-season sample noise. A player's observed per-game rate for a stat is
blended with their position's league-average rate, weighted by how many
games they've played -- someone with 80 games of data gets trusted almost
entirely on their own rate, someone with 8 games gets pulled hard toward the
position average, because 8 games isn't enough to know their true rate yet.

The blend is the posterior mean of a Gamma-Poisson conjugate model:

    regressed_rate = (observed_count + m * k) / (games_played + k)

where `m` is the position's league-average per-game rate and `k` is a
"pseudo-games" prior weight, derived from the actual population variance
(method of moments) rather than picked by hand -- a noisier population (more
game-to-game spread beyond what Poisson sampling alone explains) gets a
smaller k, meaning individual results are trusted sooner.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Player, PlayerGameStat, Game
from .scoring import DEFAULT_SCORING_RULES

SKATER_POSITIONS = ("C", "L", "R", "D")
SKATER_STATS = ["goals", "assists", "shots", "hits", "blocks", "pim"]
FULL_SEASON_GAMES = 82
MIN_GAMES_FOR_VARIANCE = 5  # exclude tiny-sample players when estimating population spread
MIN_PLAYERS_FOR_VARIANCE = 5  # need at least this many "reliable" players to trust the estimate


def _player_stat_rows(db: Session, season: str):
    sums = [func.sum(getattr(PlayerGameStat, s)).label(s) for s in SKATER_STATS]
    return (
        db.query(
            Player.player_id,
            Player.full_name,
            Player.position,
            Player.team_id,
            func.count(PlayerGameStat.stat_id).label("games_played"),
            *sums,
        )
        .join(PlayerGameStat, PlayerGameStat.player_id == Player.player_id)
        .join(Game, Game.game_id == PlayerGameStat.game_id)
        .filter(Game.season == season, Player.position.in_(SKATER_POSITIONS))
        .group_by(Player.player_id, Player.full_name, Player.position, Player.team_id)
        .all()
    )


def _shrinkage_params(rows, stat: str, position: str) -> tuple[float, float]:
    """Method-of-moments Gamma-Poisson params for one stat within one position: (league_mean, k)."""
    sample = [r for r in rows if r.position == position and r.games_played > 0]
    total_games = sum(r.games_played for r in sample)
    total_count = sum(getattr(r, stat) or 0 for r in sample)
    if total_games == 0:
        return 0.0, 50.0
    m = total_count / total_games

    reliable = [r for r in sample if r.games_played >= MIN_GAMES_FOR_VARIANCE]
    if len(reliable) < MIN_PLAYERS_FOR_VARIANCE:
        return m, 20.0  # not enough players to estimate spread; moderate default shrinkage

    observed_rates = [(getattr(r, stat) or 0) / r.games_played for r in reliable]
    mean_observed = sum(observed_rates) / len(observed_rates)
    observed_var = sum((x - mean_observed) ** 2 for x in observed_rates) / (len(observed_rates) - 1)
    expected_noise = sum(m / r.games_played for r in reliable) / len(reliable)
    true_var = observed_var - expected_noise

    if true_var <= 0:
        return m, 200.0  # nearly all observed spread is sampling noise; shrink hard toward the mean
    return m, max(m / true_var, 1.0)


def compute_skater_projections(db: Session, season: str) -> list[dict]:
    rows = _player_stat_rows(db, season)
    params = {
        (pos, stat): _shrinkage_params(rows, stat, pos)
        for pos in SKATER_POSITIONS
        for stat in SKATER_STATS
    }

    results = []
    for r in rows:
        regressed_per_game = {}
        for stat in SKATER_STATS:
            m, k = params[(r.position, stat)]
            observed = getattr(r, stat) or 0
            regressed_per_game[stat] = (observed + m * k) / (r.games_played + k)

        fantasy_points_per_game = sum(
            regressed_per_game[rule["stat_name"]] * rule["points_per"]
            for rule in DEFAULT_SCORING_RULES
            if rule["stat_name"] in regressed_per_game
        )

        results.append({
            "player_id": r.player_id,
            "full_name": r.full_name,
            "position": r.position,
            "team_id": r.team_id,
            "games_played": r.games_played,
            "projected_goals_per_82": round(regressed_per_game["goals"] * FULL_SEASON_GAMES, 1),
            "projected_assists_per_82": round(regressed_per_game["assists"] * FULL_SEASON_GAMES, 1),
            "projected_points_per_82": round(
                (regressed_per_game["goals"] + regressed_per_game["assists"]) * FULL_SEASON_GAMES, 1
            ),
            "projected_shots_per_82": round(regressed_per_game["shots"] * FULL_SEASON_GAMES, 1),
            "projected_hits_per_82": round(regressed_per_game["hits"] * FULL_SEASON_GAMES, 1),
            "projected_blocks_per_82": round(regressed_per_game["blocks"] * FULL_SEASON_GAMES, 1),
            "projected_pim_per_82": round(regressed_per_game["pim"] * FULL_SEASON_GAMES, 1),
            "projected_fantasy_points_per_game": round(fantasy_points_per_game, 2),
            "projected_fantasy_points_per_82": round(fantasy_points_per_game * FULL_SEASON_GAMES, 1),
        })
    return results
