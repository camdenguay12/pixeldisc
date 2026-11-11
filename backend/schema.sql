CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, day TEXT NOT NULL, player TEXT NOT NULL, holes INTEGER NOT NULL, throws INTEGER NOT NULL, par INTEGER NOT NULL, score INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS scores_daily_rank ON scores(day,holes,score,throws);
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, event TEXT NOT NULL, session TEXT NOT NULL, holes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS activity_day_event ON activity(day,event);
CREATE UNIQUE INDEX IF NOT EXISTS activity_unique_visit ON activity(day,session) WHERE event='visit';