# Fantasy Hockey Manager

A full-stack fantasy hockey app: PostgreSQL + FastAPI backend, real NHL data
via the public NHL API, React frontend (coming next).

## What's built so far

- **`db/schema.sql`** — normalized schema: real NHL data (teams, players,
  games, per-game stats) separate from fantasy league data (leagues, fantasy
  teams, draft picks, roster slots, weekly scores).
- **`backend/app/services/nhl_client.py`** — client for the public NHL Web
  API (`api-web.nhle.com/v1`). Pulls rosters, schedules, and boxscores.
- **`backend/app/services/scoring.py`** — configurable scoring engine. Each
  league has its own `scoring_rules` (points per goal, assist, etc.), so the
  math is data-driven, not hardcoded.
- **`backend/app/services/draft.py`** — snake draft logic: turn order,
  pick validation, "who's on the clock."
- **`backend/app/routers/`** — REST endpoints for players, draft, leagues,
  and syncing NHL data.

## Local setup

1. **Start Postgres:**
   ```bash
   docker compose up -d
   ```
   This spins up Postgres and applies `db/schema.sql` automatically.

2. **Install backend deps:**
   ```bash
   cd backend
   python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```

3. **Run the API:**
   ```bash
   uvicorn app.main:app --reload
   ```
   Visit `http://localhost:8000/docs` for interactive Swagger docs.

4. **Pull real NHL data:**
   ```bash
   curl -X POST http://localhost:8000/sync/rosters
   ```
   This populates `teams` and `players` from the live NHL API.

5. **Try it out:**
   ```bash
   curl http://localhost:8000/players?position=C&limit=5
   ```

## Roadmap (next steps)

- [ ] Historical stat backfill: loop `/sync/rosters` results through
      `/schedule/{date}` and `/gamecenter/{id}/boxscore` to populate
      `player_game_stats` for a full season.
- [ ] Auth (JWT) for `users`, so leagues/teams are tied to real accounts.
- [ ] Roster management endpoints (set weekly lineup, waive/add players).
- [ ] React frontend: player pool browser, live draft board (poll
      `/draft/{league_id}/on-the-clock`), roster view, standings.
- [ ] Weekly score computation as a scheduled job (`compute_weekly_score`
      already exists in `scoring.py` — just needs a cron/Celery trigger).
- [ ] Trade proposals between fantasy teams.

## Why this schema shape

The real-NHL-data tables and fantasy-league tables are deliberately kept
separate with no fantasy-specific columns bolted onto `players`. That
means: (1) the NHL sync logic never has to know anything about leagues,
and (2) the same `players`/`player_game_stats` tables serve every league
in the system, so scoring is just "join stats to whoever has that player
rostered this week" rather than duplicating stat data per league.
