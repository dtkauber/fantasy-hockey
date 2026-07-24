from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..database import get_db
from ..models import Player, DraftPick, PlayerGameStat
from ..schemas import PlayerOut, PlayerRankingOut
from ..services.scoring import default_points_expr

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/rankings", response_model=list[PlayerRankingOut])
def player_rankings(
    db: Session = Depends(get_db),
    position: str | None = None,
    search: str | None = Query(None, description="Substring match on player name"),
    limit: int = 100,
):
    """
    Ranks players by total fantasy points across all synced games, using
    the default scoring weights (goals, assists, etc. -- see scoring.py).
    This is season-to-date value, not a single-game snapshot.
    """
    points_expr = default_points_expr()
    total_points = func.sum(points_expr)
    games_played = func.count(PlayerGameStat.stat_id)

    q = (
        db.query(
            Player.player_id,
            Player.full_name,
            Player.position,
            Player.team_id,
            games_played.label("games_played"),
            total_points.label("total_points"),
        )
        .join(PlayerGameStat, PlayerGameStat.player_id == Player.player_id)
        .group_by(Player.player_id, Player.full_name, Player.position, Player.team_id)
    )
    if position:
        q = q.filter(Player.position == position)
    if search:
        q = q.filter(Player.full_name.ilike(f"%{search}%"))

    rows = q.order_by(total_points.desc()).limit(limit).all()
    return [
        PlayerRankingOut(
            player_id=r.player_id,
            full_name=r.full_name,
            position=r.position,
            team_id=r.team_id,
            games_played=r.games_played,
            total_points=round(float(r.total_points or 0), 2),
            points_per_game=round(float(r.total_points or 0) / r.games_played, 2) if r.games_played else 0.0,
        )
        for r in rows
    ]


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
