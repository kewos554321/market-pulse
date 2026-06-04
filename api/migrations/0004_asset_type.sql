ALTER TABLE watchlist ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'tw_stock';

CREATE TABLE IF NOT EXISTS fx_daily (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  rates_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
