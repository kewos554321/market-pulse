CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS algorithms (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
  conditions TEXT NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  triggered_at TEXT NOT NULL,
  conditions_snapshot TEXT NOT NULL,
  close_price REAL NOT NULL,
  notified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('notify_email', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('schedule_enabled', '1');
