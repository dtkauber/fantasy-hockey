from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DraftPick, FantasyTeam
from ..schemas import DraftPickCreate, DraftPickOut
from ..services.draft import make_pick, get_team_on_the_clock, get_next_pick_number, DraftError

router = APIRouter(prefix="/draft", tags=["draft"])


@router.get("/{league_id}/board", response_model=list[DraftPickOut])
def get_draft_board(league_id: int, db: Session = Depends(get_db)):
    """Full pick history for a league, in order."""
    return (
        db.query(DraftPick)
        .filter(DraftPick.league_id == league_id)
        .order_by(DraftPick.pick_number)
        .all()
    )


@router.get("/{league_id}/on-the-clock")
def on_the_clock(league_id: int, db: Session = Depends(get_db)):
    team = get_team_on_the_clock(db, league_id)
    if team is None:
        raise HTTPException(404, "No teams found for this league.")
    return {
        "fantasy_team_id": team.fantasy_team_id,
        "team_name": team.team_name,
        "next_pick_number": get_next_pick_number(db, league_id),
    }


@router.post("/pick", response_model=DraftPickOut)
def draft_player(payload: DraftPickCreate, db: Session = Depends(get_db)):
    try:
        pick = make_pick(db, payload.league_id, payload.fantasy_team_id, payload.player_id)
    except DraftError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return pick
