-- Run once in Cloudflare D1 Console BEFORE deploying the updated Worker.
-- Retain the oldest claimant of each existing four-character name;
-- clear only duplicate claims, so affected players can choose a new name.
UPDATE players SET display_name=NULL
WHERE display_name IS NOT NULL AND id NOT IN (
 SELECT p.id FROM players p
 WHERE p.display_name IS NOT NULL
 AND p.rowid=(SELECT MIN(p2.rowid) FROM players p2 WHERE p2.display_name=p.display_name)
);
-- Enforce uniqueness atomically, including simultaneous registration requests.
CREATE UNIQUE INDEX IF NOT EXISTS players_unique_display_name ON players(display_name) WHERE display_name IS NOT NULL;
