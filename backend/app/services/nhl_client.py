"""
Thin client around the public NHL Web API (api-web.nhle.com/v1).
No API key required. This is the *only* place in the codebase that
talks to the NHL API — everything else reads from our own Postgres tables.
"""
import httpx

BASE_URL = "https://api-web.nhle.com/v1"

TEAM_ABBREVS = [
    "ANA", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL",
    "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NSH", "NJD", "NYI", "NYR",
    "OTT", "PHI", "PIT", "SJS", "SEA", "STL", "TBL", "TOR", "UTA", "VAN", "VGK",
    "WSH", "WPG",
]


async def fetch_team_roster(abbrev: str) -> dict:
    """GET /roster/{team}/current -> forwards, defensemen, goalies for a team."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(f"{BASE_URL}/roster/{abbrev}/current")
        resp.raise_for_status()
        return resp.json()


async def fetch_standings_now() -> dict:
    """GET /standings/now -> current standings, used to backfill team metadata."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(f"{BASE_URL}/standings/now")
        resp.raise_for_status()
        return resp.json()


async def fetch_schedule(date: str) -> dict:
    """GET /schedule/{YYYY-MM-DD} -> games for a given date (or week starting that date)."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(f"{BASE_URL}/schedule/{date}")
        resp.raise_for_status()
        return resp.json()


async def fetch_boxscore(game_id: int) -> dict:
    """GET /gamecenter/{game_id}/boxscore -> per-player stats for a completed game."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(f"{BASE_URL}/gamecenter/{game_id}/boxscore")
        resp.raise_for_status()
        return resp.json()


def parse_boxscore_player_stats(boxscore: dict) -> list[dict]:
    """
    Flattens the NHL boxscore JSON (grouped by team -> forwards/defense/goalies)
    into a flat list of per-player stat dicts matching player_game_stats columns.
    """
    rows: list[dict] = []
    player_by_game_stats = boxscore.get("playerByGameStats", {})

    for side in ("homeTeam", "awayTeam"):
        team_stats = player_by_game_stats.get(side, {})
        for group in ("forwards", "defense"):
            for p in team_stats.get(group, []):
                rows.append({
                    "player_id": p.get("playerId"),
                    "goals": p.get("goals", 0),
                    "assists": p.get("assists", 0),
                    "plus_minus": p.get("plusMinus", 0),
                    "pim": p.get("pim", 0),
                    "shots": p.get("sog", 0),
                    "hits": p.get("hits", 0),
                    "blocks": p.get("blockedShots", 0),
                    "toi_seconds": _toi_to_seconds(p.get("toi", "0:00")),
                })
        for p in team_stats.get("goalies", []):
            if p.get("toi", "0:00") == "0:00":
                continue  # dressed but didn't play
            rows.append({
                "player_id": p.get("playerId"),
                "saves": p.get("saves", 0),
                "goals_against": p.get("goalsAgainst", 0),
                "is_win": p.get("decision") == "W",
                "is_shutout": p.get("decision") == "W" and p.get("goalsAgainst", 1) == 0,
                "toi_seconds": _toi_to_seconds(p.get("toi", "0:00")),
            })
    return rows


def _toi_to_seconds(toi: str) -> int:
    """'MM:SS' -> total seconds."""
    try:
        minutes, seconds = toi.split(":")
        return int(minutes) * 60 + int(seconds)
    except (ValueError, AttributeError):
        return 0
