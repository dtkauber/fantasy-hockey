from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models import Player, DraftPick
from ..schemas import PlayerOut

router = APIRouter(prefix="/players", tags=["players"])


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
