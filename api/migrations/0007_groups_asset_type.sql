PRAGMA foreign_keys=OFF;

ALTER TABLE groups RENAME TO groups_old;

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'tw_stock',
  created_at TEXT NOT NULL,
  UNIQUE(name, asset_type)
);

INSERT INTO groups (id, name, asset_type, created_at)
  SELECT id, name, 'tw_stock', created_at FROM groups_old;

DROP TABLE groups_old;

PRAGMA foreign_keys=ON;
