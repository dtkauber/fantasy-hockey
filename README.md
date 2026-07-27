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

## Deploying to Render

This repo includes a `render.yaml` Blueprint that provisions the backend, frontend,
and Postgres in one go.

1. Push this repo to GitHub (already done).
2. In the Render dashboard: **New > Blueprint**, connect this repo. Render reads
   `render.yaml` and proposes three resources: `fantasy-hockey-backend` (web
   service), `fantasy-hockey-frontend` (static site), `fantasy-hockey-db`
   (Postgres).
3. When prompted, paste your `OPENAI_API_KEY` (marked `sync: false` in the
   blueprint, so Render only asks once, at creation time).
4. Deploy. **If either service name is already taken** by another Render user,
   Render suffixes it, which breaks the hardcoded cross-references
   (`FRONTEND_ORIGIN` on the backend, `VITE_API_BASE_URL` on the frontend) --
   check the actual assigned URLs in the dashboard, update those two env vars
   to match if they differ, then redeploy.
5. Apply the schema to the new production database (grab the "External
   Database URL" from the Postgres service's dashboard page):
   ```bash
   docker run --rm -i postgres:16 psql "<external-database-url>" < db/schema.sql
   ```
6. Populate real data by hitting the deployed backend's sync endpoints once
   (swap in your actual backend URL if it differs from the default):
   ```bash
   curl -X POST https://fantasy-hockey-backend.onrender.com/sync/rosters
   curl -X POST "https://fantasy-hockey-backend.onrender.com/sync/season?concurrency=10" --max-time 1800
   ```
   The season sync takes ~15-20 minutes (1,300+ games) -- run it in the
   background or expect a long-lived request.

**Free-tier caveats:**
- The free Postgres instance expires after 90 days unless upgraded -- you'll
  need to re-apply the schema and re-sync if that happens.
- The free web service spins down after 15 minutes of inactivity; the next
  request after that takes ~30-60s to cold-start.
- The chat assistant is rate-limited to 10 requests/minute per IP, but every
  request still costs OpenAI tokens -- keep an eye on usage at
  platform.openai.com if you share the link widely.

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
