ALTER TABLE watchlist ADD COLUMN algorithm_template_id TEXT REFERENCES algorithm_templates(id) ON DELETE SET NULL;

UPDATE watchlist
SET algorithm_template_id = (
  SELECT g.algorithm_template_id
  FROM groups g
  WHERE g.id = watchlist.algorithm_source_group_id
    AND g.algorithm_template_id IS NOT NULL
)
WHERE algorithm_source_group_id IS NOT NULL;

ALTER TABLE watchlist DROP COLUMN algorithm_source_group_id;
ALTER TABLE groups DROP COLUMN algorithm_template_id;
