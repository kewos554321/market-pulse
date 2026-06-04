CREATE TABLE email_recipients (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  label      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO email_recipients (id, email)
SELECT lower(hex(randomblob(8))), value
FROM settings
WHERE key = 'notify_email' AND value != '';

DELETE FROM settings WHERE key = 'notify_email';
