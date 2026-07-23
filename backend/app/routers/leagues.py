from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import League, FantasyTeam, ScoringRule
from ..schemas import LeagueCreate, FantasyTeamCreate
from ..services.scoring import DEFAULT_SCORING_RULES

router = APIRouter(prefix="/leagues", tags=["leagues"])


@router.post("")
def create_league(payload: LeagueCreate, db: Session = Depends(get_db)):
    league = League(name=payload.name, commissioner_id=payload.commissioner_id, max_teams=payload.max_teams)
    db.add(league)
    db.flush()

    # Seed with default scoring rules; commissioner can edit these later.
    for rule in DEFAULT_SCORING_RULES:
        db.add(ScoringRule(league_id=league.league_id, **rule))

    db.commit()
    db.refresh(league)
    return league


@router.post("/teams")
def create_fantasy_team(payload: FantasyTeamCreate, db: Session = Depends(get_db)):
    existing_count = db.query(FantasyTeam).filter(FantasyTeam.league_id == payload.league_id).count()
    team = FantasyTeam(
        league_id=payload.league_id,
        owner_id=payload.owner_id,
        team_name=payload.team_name,
        draft_position=existing_count + 1,  # simple join-order draft position for now
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/{league_id}/teams")
def list_teams(league_id: int, db: Session = Depends(get_db)):
    return (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id)
        .order_by(FantasyTeam.draft_position)
        .all()
    )
