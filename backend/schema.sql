CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, day TEXT NOT NULL, player TEXT NOT NULL, holes INTEGER NOT NULL, throws INTEGER NOT NULL, par INTEGER NOT NULL, score INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS scores_daily_rank ON scores(day,holes,score,throws);
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, event TEXT NOT NULL, session TEXT NOT NULL, holes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS activity_day_event ON activity(day,event);
CREATE UNIQUE INDEX IF NOT EXISTS activity_unique_visit ON activity(day,session) WHERE event='visit';
-- Run this migration once in the Cloudflare D1 console before deploying the updated Worker.
CREATE TABLE IF NOT EXISTS leaderboard_scores (id TEXT PRIMARY KEY,day TEXT NOT NULL,layout TEXT NOT NULL,player TEXT NOT NULL,holes INTEGER NOT NULL,throws INTEGER NOT NULL,par INTEGER NOT NULL,score INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS leaderboard_daily_rank ON leaderboard_scores(day,layout,score,throws,created_at);
CREATE INDEX IF NOT EXISTS leaderboard_alltime_rank ON leaderboard_scores(layout,score,throws,created_at);

-- Anonymous browser player profiles and progress (run once in D1 Console).
CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,display_name TEXT,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS saved_rounds(player_id TEXT PRIMARY KEY REFERENCES players(id),state TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS player_rounds(id TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),layout TEXT NOT NULL,holes INTEGER NOT NULL,throws INTEGER NOT NULL,par INTEGER NOT NULL,score INTEGER NOT NULL,completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS player_rounds_history ON player_rounds(player_id,completed_at DESC);

-- Daily ace-run records used by the Worker.
CREATE TABLE IF NOT EXISTS ace_runs (id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id), day TEXT NOT NULL, aces INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS ace_runs_daily ON ace_runs(day,player_id,aces DESC);
