
-- One-time historical score carryover for November 11, 2026 only.
-- Run once in the D1 Console. Does not change future-day behavior.
-- Uses original IDs with a migration prefix to avoid duplicate inserts on reruns.
INSERT OR IGNORE INTO leaderboard_scores(id,day,layout,player,holes,throws,par,score)
SELECT 'legacy-20261111-' || id, '2026-11-11',
       CASE holes WHEN 3 THEN 'random3' WHEN 6 THEN 'random6' END,
       player,holes,throws,par,score
FROM scores
WHERE player IN ('CMDN','KYLE') AND holes IN (3,6);

-- Keep at most the five best scores in each migrated daily layout.
DELETE FROM leaderboard_scores WHERE id IN (
 SELECT id FROM (
  SELECT id,ROW_NUMBER() OVER(PARTITION BY day,layout ORDER BY score ASC,throws ASC,created_at ASC,id ASC) AS rank
  FROM leaderboard_scores WHERE day='2026-11-11' AND layout IN ('random3','random6')
 ) WHERE rank>5
);
