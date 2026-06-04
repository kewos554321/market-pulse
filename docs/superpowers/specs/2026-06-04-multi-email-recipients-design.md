# Spec: Multi-Email Recipients

**Date:** 2026-06-04  
**Status:** Approved

## Overview

Allow the system to send signal notifications to multiple email addresses. Replace the single `notify_email` settings key with a dedicated CRUD-managed recipient list.

## Data Layer

### New Table: `email_recipients`

```sql
CREATE TABLE email_recipients (
  id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email     TEXT NOT NULL UNIQUE,
  label     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- `label` is optional (e.g., "主要聯絡人", "備用")
- `email` must be unique
- Remove `notify_email` from the `settings` table (migration deletes the row)

## API (Cloudflare Workers)

New route file: `api/src/routes/emailRecipients.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/email-recipients` | Return all recipients, ordered by `created_at` |
| POST | `/email-recipients` | Add a new recipient `{ email, label? }` |
| DELETE | `/email-recipients/:id` | Delete a recipient by id |

Validation:
- `POST`: reject if `email` is missing or not a valid email format
- `POST`: reject if email already exists (return 409)
- `DELETE`: return 404 if id not found

## Scheduler

In `scheduler/src/index.ts`:

1. Replace `settings.notify_email` lookup with `GET /email-recipients`
2. If the list is empty, skip email sending (log and continue)
3. Send to all recipients with `Promise.all` — failure of one email does not block others
4. Log success/failure per recipient

In `scheduler/src/notify.ts`:

- Change `toEmail: string` → `toEmail: string[]` in `sendSignalEmail` signature
- Resend's `to` field already accepts an array

## Web UI

In the Settings page (`web/src/pages/`), add an **Email 收件人** section:

- List all existing recipients (email + optional label + delete button)
- Add form: email input + label input (optional) + 新增 button
- On delete: confirm before removing
- Inline validation: show error if email format is invalid or duplicate

No dedicated page needed — this section lives within the existing Settings page.

## Migration

New D1 migration file: `api/migrations/XXXX_add_email_recipients.sql`

```sql
CREATE TABLE email_recipients (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email      TEXT NOT NULL UNIQUE,
  label      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Migrate existing notify_email to new table if present
INSERT OR IGNORE INTO email_recipients (email)
SELECT value FROM settings WHERE key = 'notify_email';

DELETE FROM settings WHERE key = 'notify_email';
```

## Error Handling

- Scheduler: if `GET /email-recipients` fails, abort run and log error
- Scheduler: if an individual email send fails, log the error and continue sending to remaining recipients
- API: standard 400/404/409 JSON error responses

## Out of Scope

- Email delivery status tracking
- Unsubscribe links
- Per-recipient enable/disable toggle
