# Spec: LINE Group Notification

**Date:** 2026-06-04  
**Status:** Approved

## Overview

Send daily signal notifications to a LINE group chat via a LINE Bot (Messaging API). The bot is added to a group, automatically captures the group ID via webhook, and the scheduler pushes messages to the group alongside email.

## Prerequisites (Manual Setup)

Before any code can run, the operator must:

1. Create a LINE Bot channel at [LINE Developers Console](https://developers.line.biz/)
2. Enable **Messaging API**
3. Copy the **Channel Access Token** (long-lived)
4. Set the **Webhook URL** to `https://<workers-domain>/line/webhook`
5. Enable **Use webhook** in the channel settings
6. Add the Bot to the desired LINE group chat

## Data Layer

No new tables. Two new keys in the existing `settings` table:

| Key | Description |
|-----|-------------|
| `line_channel_access_token` | LINE Messaging API channel access token |
| `line_group_id` | Target group chat ID (auto-filled by webhook or manually set) |

## API (Cloudflare Workers)

### New Route: `POST /line/webhook`

Handles LINE platform events.

**Signature verification:**
- LINE sends `X-Line-Signature` header (HMAC-SHA256 of request body using Channel Secret)
- The endpoint must verify this signature and return 400 if invalid
- Requires a new setting key: `line_channel_secret` (stored in settings, used only for verification)

**Event handling:**
- On `join` event (bot added to group): extract `event.source.groupId`, upsert into `settings` as `line_group_id`
- On all other events: ignore and return 200

**Response:** Always return `200 OK` with empty body to LINE (LINE retries if it gets non-200)

### Updated Route: `PUT /settings`

Already exists — used by Web UI to save `line_channel_access_token` and `line_channel_secret`.

## Scheduler

In `scheduler/src/notify.ts`, add:

```ts
export async function sendLineGroupMessage(
  channelAccessToken: string,
  groupId: string,
  date: string,
  signals: SignalSummary[]
): Promise<void>
```

- Uses LINE Messaging API: `POST https://api.line.me/v2/bot/message/push`
- Message format: plain text listing triggered symbols and conditions
- Authorization: `Bearer <channelAccessToken>`

In `scheduler/src/index.ts`:

1. After email step, read `line_channel_access_token` and `line_group_id` from settings
2. If either is missing, skip LINE notification (log and continue)
3. Call `sendLineGroupMessage` — failure does not abort the run, just logs error

## Web UI

In the Settings page, add a **LINE 通知** section:

- **Channel Access Token** input: password-type field, shows "已設定" placeholder if value exists in settings
- **Channel Secret** input: same treatment as above
- **Group ID** field: read-only display (auto-filled by webhook), with a manual override option
- **儲存** button: saves all three values via `PUT /settings`
- Inline instructions: "請將 Bot 加入群組後，Group ID 將自動填入"

## Message Format

Plain text push message sent to the group:

```
📊 Market Pulse｜{date}
共 {n} 支標的觸發條件：

・{symbol} {name}  {closePrice}
  條件：{triggeredConditions}

・...
```

If no signals, do not send a LINE message (same as email behavior).

## Error Handling

- Webhook: invalid signature → 400, no processing
- Webhook: missing groupId in join event → log and return 200
- Scheduler: LINE API error → log error, do not retry, continue rest of run
- Scheduler: missing token or groupId → skip silently with log message

## Security

- `line_channel_secret` is used only for webhook signature verification; excluded entirely from the `GET /settings` response
- `line_channel_access_token` is stored in settings; treat as a secret in logs

## Out of Scope

- LINE Flex Messages (rich cards) — plain text only for now
- Multiple LINE groups
- Per-user LINE subscriptions
- LINE login / LIFF
