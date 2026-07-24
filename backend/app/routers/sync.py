import asyncio
from datetime import date as date_cls

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Team, Player, Game, PlayerGameStat
from ..services import nhl_client

router = APIRouter(prefix="/sync", tags=["sync"])

COMPLETED_STATES = ("OFF", "FINAL")
REGULAR_SEASON_GAME_TYPE = 2


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


def _get_or_create_team(db: Session, abbrev: str, name: str) -> Team:
    team = db.query(Team).filter(Team.abbrev == abbrev).first()
    if not team:
        team = Team(team_id=abs(hash(abbrev)) % 100000, abbrev=abbrev, name=name)
        db.add(team)
        db.flush()
    return team


def _upsert_stat_row(db: Session, player_id: int, game_id: int, fields: dict) -> bool:
    """Returns True if a new row was inserted, False if an existing one was updated."""
    if not db.query(Player.player_id).filter(Player.player_id == player_id).first():
        return False  # stat line for a player we've never synced via rosters; skip

    existing = (
        db.query(PlayerGameStat)
        .filter(PlayerGameStat.player_id == player_id, PlayerGameStat.game_id == game_id)
        .first()
    )
    if existing:
        for key, value in fields.items():
            setattr(existing, key, value)
        return False

    db.add(PlayerGameStat(player_id=player_id, game_id=game_id, **fields))
    return True


def _write_game_and_stats(db: Session, game: dict, boxscore: dict) -> int:
    """
    Upserts the Game row and its boxscore stat lines. Pure sync/DB work --
    no awaits -- so it's safe to call sequentially against one Session even
    though boxscores were fetched concurrently beforehand.
    """
    home = game["homeTeam"]
    away = game["awayTeam"]
    home_team = _get_or_create_team(db, home["abbrev"], home.get("commonName", {}).get("default", home["abbrev"]))
    away_team = _get_or_create_team(db, away["abbrev"], away.get("commonName", {}).get("default", away["abbrev"]))

    game_row = db.query(Game).filter(Game.game_id == game["id"]).first()
    if not game_row:
        game_row = Game(
            game_id=game["id"],
            game_date=date_cls.fromisoformat(game["startTimeUTC"][:10]),
            home_team_id=home_team.team_id,
            away_team_id=away_team.team_id,
            season=str(game["season"]),
        )
        db.add(game_row)
        db.flush()

    stat_rows = nhl_client.parse_boxscore_player_stats(boxscore)

    written = 0
    for row in stat_rows:
        player_id = row.pop("player_id")
        if player_id is None:
            continue
        if _upsert_stat_row(db, player_id, game["id"], row):
            written += 1
    return written


@router.post("/season")
async def sync_season(
    db: Session = Depends(get_db),
    start_date: str | None = None,
    end_date: str | None = None,
    concurrency: int = 8,
):
    """
    Backfills completed regular-season games (and their boxscores) into
    games + player_game_stats. Walks the schedule week by week from
    start_date (defaults to the season's actual start) through end_date
    (defaults to the season's actual end). Safe to re-run: games and
    stat lines are upserted, never duplicated.
    """
    if start_date:
        anchor_date = start_date
    else:
        # "now" resolves to the *upcoming* season during the off-season, which
        # has no games yet -- anchor on the most recently completed season instead.
        standings = await nhl_client.fetch_standings_now()
        season_id = str(standings["standings"][0]["seasonId"])
        anchor_date = f"{season_id[:4]}-11-01"

    first_week = await nhl_client.fetch_schedule(anchor_date)
    walk_start = start_date or first_week["regularSeasonStartDate"]
    walk_end = end_date or first_week["regularSeasonEndDate"]

    games_to_sync: list[dict] = []
    cursor = walk_start
    previous_cursor = None
    while cursor <= walk_end and cursor != previous_cursor:
        week = await nhl_client.fetch_schedule(cursor)
        for day in week.get("gameWeek", []):
            if day["date"] > walk_end:
                continue
            for g in day.get("games", []):
                if g.get("gameType") != REGULAR_SEASON_GAME_TYPE:
                    continue
                if g.get("gameState") not in COMPLETED_STATES:
                    continue
                games_to_sync.append(g)
        previous_cursor = cursor
        cursor = week.get("nextStartDate") or walk_end

    semaphore = asyncio.Semaphore(concurrency)

    async def fetch_with_limit(game: dict):
        async with semaphore:
            return await nhl_client.fetch_boxscore(game["id"])

    stat_rows_written = 0
    games_synced = 0

    # Fetch boxscores concurrently (the slow part -- an external API call per
    # game), then write each one to the DB sequentially: SQLAlchemy's Session
    # isn't safe to touch from overlapping coroutines.
    total = len(games_to_sync)
    for i in range(0, total, concurrency):
        batch = games_to_sync[i : i + concurrency]
        boxscores = await asyncio.gather(*(fetch_with_limit(g) for g in batch))
        for game, boxscore in zip(batch, boxscores):
            stat_rows_written += _write_game_and_stats(db, game, boxscore)
        games_synced += len(batch)
        db.commit()
        print(f"[sync/season] {games_synced}/{total} games, {stat_rows_written} stat rows so far", flush=True)

    return {
        "games_synced": games_synced,
        "stat_rows_written": stat_rows_written,
        "date_range": [walk_start, walk_end],
    }
