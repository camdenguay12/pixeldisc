-- Run once in Cloudflare D1 -> pixeldisc-db -> Console
CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,display_name TEXT,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS saved_rounds(player_id TEXT PRIMARY KEY REFERENCES players(id),state TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS player_rounds(id TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),layout TEXT NOT NULL,holes INTEGER NOT NULL,throws INTEGER NOT NULL,par INTEGER NOT NULL,score INTEGER NOT NULL,completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX IF NOT EXISTS player_rounds_history ON player_rounds(player_id,completed_at DESC);
