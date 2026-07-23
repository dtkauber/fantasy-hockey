from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Team, Player
from ..services import nhl_client

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/rosters")
async def sync_rosters(db: Session = Depends(get_db)):
    """
    Pulls the current roster for every NHL team and upserts teams + players.
    This is the one endpoint you run first, before anything else works.
    """
    synced_teams = 0
    synced_players = 0

    for abbrev in nhl_client.TEAM_ABBREVS:
        team = db.query(Team).filter(Team.abbrev == abbrev).first()
        if not team:
            # team_id gets backfilled properly by /sync/standings; placeholder id for now
            team = Team(team_id=abs(hash(abbrev)) % 100000, abbrev=abbrev, name=abbrev)
            db.add(team)
            db.flush()
            synced_teams += 1

        roster = await nhl_client.fetch_team_roster(abbrev)
        for group in ("forwards", "defensemen", "goalies"):
            for p in roster.get(group, []):
                player = db.query(Player).filter(Player.player_id == p["id"]).first()
                full_name = f'{p["firstName"]["default"]} {p["lastName"]["default"]}'
                position = p.get("positionCode", "")
                if player:
                    player.full_name = full_name
                    player.position = position
                    player.team_id = team.team_id
                else:
                    db.add(Player(
                        player_id=p["id"],
                        full_name=full_name,
                        position=position,
                        team_id=team.team_id,
                    ))
                    synced_players += 1

    db.commit()
    return {"teams_synced": synced_teams, "players_synced": synced_players}
