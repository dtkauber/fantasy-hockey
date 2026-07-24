from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import League, FantasyTeam, ScoringRule
from ..schemas import LeagueCreate, LeagueOut, FantasyTeamCreate, FantasyTeamOut
from ..services.scoring import DEFAULT_SCORING_RULES

router = APIRouter(prefix="/leagues", tags=["leagues"])


@router.get("", response_model=list[LeagueOut])
def list_leagues(db: Session = Depends(get_db)):
    return db.query(League).order_by(League.league_id).all()


@router.get("/{league_id}", response_model=LeagueOut)
def get_league(league_id: int, db: Session = Depends(get_db)):
    league = db.query(League).filter(League.league_id == league_id).first()
    if league is None:
        raise HTTPException(404, "League not found.")
    return league


@router.post("", response_model=LeagueOut)
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


@router.post("/teams", response_model=FantasyTeamOut)
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


@router.get("/{league_id}/teams", response_model=list[FantasyTeamOut])
def list_teams(league_id: int, db: Session = Depends(get_db)):
    return (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id)
        .order_by(FantasyTeam.draft_position)
        .all()
    )
