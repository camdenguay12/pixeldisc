-- Apply once to the existing production D1 database before deploying the updated Worker.
-- Retains every existing published course layout and its version.
CREATE TABLE published_holes_new (hole_id INTEGER PRIMARY KEY CHECK(hole_id BETWEEN 0 AND 53), layout TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
INSERT INTO published_holes_new (hole_id,layout,version,updated_at) SELECT hole_id,layout,version,updated_at FROM published_holes;
DROP TABLE published_holes;
ALTER TABLE published_holes_new RENAME TO published_holes;
