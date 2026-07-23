-- Fantasy Hockey Manager schema
-- Two domains: (1) real NHL reference data, synced from the NHL API
--              (2) fantasy league data, owned by this app

-- ============================================================
-- REAL NHL DATA (synced)
-- ============================================================

CREATE TABLE teams (
    team_id      INTEGER PRIMARY KEY,        -- NHL's own team id
    abbrev       VARCHAR(5) NOT NULL,
    name         VARCHAR(100) NOT NULL,
    conference   VARCHAR(20),
    division     VARCHAR(20)
);

CREATE TABLE players (
    player_id    INTEGER PRIMARY KEY,        -- NHL's own player id
    full_name    VARCHAR(100) NOT NULL,
    position     VARCHAR(5) NOT NULL,        -- C, LW, RW, D, G
    team_id      INTEGER REFERENCES teams(team_id),
    is_active    BOOLEAN DEFAULT TRUE,
    updated_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE games (
    game_id      BIGINT PRIMARY KEY,         -- NHL's own game id
    game_date    DATE NOT NULL,
    home_team_id INTEGER REFERENCES teams(team_id),
    away_team_id INTEGER REFERENCES teams(team_id),
    season       VARCHAR(9) NOT NULL         -- e.g. '20262027'
);

-- One row per player per game. This is what the scoring engine reads from.
CREATE TABLE player_game_stats (
    stat_id      BIGSERIAL PRIMARY KEY,
    player_id    INTEGER REFERENCES players(player_id),
    game_id      BIGINT REFERENCES games(game_id),
    goals        SMALLINT DEFAULT 0,
    assists      SMALLINT DEFAULT 0,
    plus_minus   SMALLINT DEFAULT 0,
    pim          SMALLINT DEFAULT 0,         -- penalty minutes
    shots        SMALLINT DEFAULT 0,
    hits         SMALLINT DEFAULT 0,
    blocks       SMALLINT DEFAULT 0,
    toi_seconds  INTEGER DEFAULT 0,          -- time on ice
    -- goalie-specific, NULL for skaters
    saves        SMALLINT,
    goals_against SMALLINT,
    is_win       BOOLEAN,
    is_shutout   BOOLEAN,
    UNIQUE (player_id, game_id)
);

CREATE INDEX idx_pgs_player ON player_game_stats(player_id);
CREATE INDEX idx_pgs_game ON player_game_stats(game_id);

-- ============================================================
-- FANTASY LEAGUE DATA (owned by this app)
-- ============================================================

CREATE TABLE users (
    user_id      SERIAL PRIMARY KEY,
    username     VARCHAR(50) UNIQUE NOT NULL,
    email        VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE leagues (
    league_id      SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    commissioner_id INTEGER REFERENCES users(user_id),
    max_teams      SMALLINT DEFAULT 10,
    draft_status   VARCHAR(20) DEFAULT 'not_started', -- not_started | in_progress | complete
    created_at     TIMESTAMP DEFAULT now()
);

-- Configurable scoring: how many fantasy points each stat category is worth,
-- per league. This is what keeps the scoring engine data-driven instead of hardcoded.
CREATE TABLE scoring_rules (
    rule_id      SERIAL PRIMARY KEY,
    league_id    INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    stat_name    VARCHAR(30) NOT NULL,       -- must match a player_game_stats column
    points_per   NUMERIC(5,2) NOT NULL,      -- e.g. goals -> 3.0, assists -> 2.0
    UNIQUE (league_id, stat_name)
);

CREATE TABLE fantasy_teams (
    fantasy_team_id SERIAL PRIMARY KEY,
    league_id       INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    owner_id        INTEGER REFERENCES users(user_id),
    team_name       VARCHAR(100) NOT NULL,
    draft_position  SMALLINT,                -- assigned before draft starts
    UNIQUE (league_id, owner_id)
);

-- Every player drafted, ever, in a league. Doubles as "who owns this player right now"
-- when combined with roster_slots.
CREATE TABLE draft_picks (
    pick_id         SERIAL PRIMARY KEY,
    league_id       INTEGER REFERENCES leagues(league_id) ON DELETE CASCADE,
    fantasy_team_id INTEGER REFERENCES fantasy_teams(fantasy_team_id),
    player_id       INTEGER REFERENCES players(player_id),
    round_number    SMALLINT NOT NULL,
    pick_number     INTEGER NOT NULL,        -- overall pick number, 1-indexed
    picked_at       TIMESTAMP DEFAULT now(),
    UNIQUE (league_id, player_id),           -- a player can only be drafted once per league
    UNIQUE (league_id, pick_number)
);

CREATE TABLE roster_slots (
    roster_slot_id  SERIAL PRIMARY KEY,
    fantasy_team_id INTEGER REFERENCES fantasy_teams(fantasy_team_id) ON DELETE CASCADE,
    player_id       INTEGER REFERENCES players(player_id),
    slot_type       VARCHAR(10) NOT NULL,    -- C, LW, RW, D, G, BENCH, IR
    week_start      DATE NOT NULL,           -- lineups are set per scoring week
    UNIQUE (fantasy_team_id, player_id, week_start)
);

-- Cached weekly totals so the frontend doesn't recompute from raw stats every request.
CREATE TABLE weekly_scores (
    fantasy_team_id INTEGER REFERENCES fantasy_teams(fantasy_team_id) ON DELETE CASCADE,
    week_start      DATE NOT NULL,
    total_points    NUMERIC(8,2) DEFAULT 0,
    PRIMARY KEY (fantasy_team_id, week_start)
);
