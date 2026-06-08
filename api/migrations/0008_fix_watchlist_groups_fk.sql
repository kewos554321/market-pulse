PRAGMA foreign_keys=OFF;

CREATE TABLE watchlist_groups_new (
  watchlist_id TEXT NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (watchlist_id, group_id)
);

INSERT INTO watchlist_groups_new SELECT * FROM watchlist_groups;

DROP TABLE watchlist_groups;

ALTER TABLE watchlist_groups_new RENAME TO watchlist_groups;

PRAGMA foreign_keys=ON;
