CREATE TABLE IF NOT EXISTS algorithm_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  conditions TEXT NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE groups ADD COLUMN algorithm_template_id TEXT REFERENCES algorithm_templates(id) ON DELETE SET NULL;

ALTER TABLE watchlist ADD COLUMN algorithm_source_group_id TEXT REFERENCES groups(id) ON DELETE SET NULL;
