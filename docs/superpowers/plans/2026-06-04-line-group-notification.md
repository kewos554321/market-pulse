# LINE Group Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push daily signal notifications to a LINE group chat via a LINE Bot (Messaging API), with automatic group ID capture via webhook.

**Architecture:** Add a `/line/webhook` endpoint on Cloudflare Workers that captures the bot's group ID when it joins a chat. The scheduler reads the stored `line_channel_access_token` and `line_group_id` from settings and pushes a text message via LINE's push API. Settings page adds a LINE config section.

**Tech Stack:** Cloudflare Workers + Hono (API/webhook), Node.js + axios (scheduler), React (web), LINE Messaging API

> **Dependency:** This plan assumes the **Multi-Email Recipients** plan (`2026-06-04-multi-email-recipients.md`) has already been implemented. Task 5 builds on the `notifyEmails` variable and updated `sendSignalEmail` signature introduced in that plan.

---

## Prerequisites (manual — must be done before any code is run)

1. Go to [LINE Developers Console](https://developers.line.biz/) and create a new provider if you don't have one
2. Create a **Messaging API** channel
3. Under **Messaging API** tab → **Channel access token** → Issue a long-lived token → copy it
4. Under **Basic settings** → copy the **Channel secret**
5. Under **Messaging API** tab → **Webhook settings** → set Webhook URL to `https://<your-workers-domain>/line/webhook` → enable **Use webhook**
6. Disable **Auto-reply messages** (optional but recommended to avoid double responses)
7. Add the bot to your LINE group chat

---

### Task 1: Auth middleware — exempt `/line/webhook`

**Files:**
- Modify: `api/src/middleware/auth.ts`

LINE's platform sends webhook events without your API key. The `/line/webhook` endpoint must be publicly reachable.

- [ ] **Step 1: Update `api/src/middleware/auth.ts` to skip auth for the webhook path**

Replace the entire file content:

```ts
import { createMiddleware } from 'hono/factory';
import { Env } from '../types';

export const apiKeyAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (c.req.path === '/line/webhook') {
    await next();
    return;
  }
  const key = c.req.header('X-API-Key');
  if (!key || key !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
```

- [ ] **Step 2: Verify the existing API still requires auth**

```bash
cd api && npm run dev
```

```bash
curl http://localhost:8787/settings
```

Expected: `{"error":"Unauthorized"}` with status 401

- [ ] **Step 3: Verify the webhook path is now public**

```bash
curl -X POST http://localhost:8787/line/webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: any non-401 response (will be 400 or 500 since the route doesn't exist yet — that's fine)

- [ ] **Step 4: Commit**

```bash
git add api/src/middleware/auth.ts
git commit -m "feat: exempt /line/webhook from API key auth"
```

---

### Task 2: API — LINE webhook route

**Files:**
- Create: `api/src/routes/lineWebhook.ts`

- [ ] **Step 1: Create `api/src/routes/lineWebhook.ts`**

```ts
import { Hono } from 'hono';
import { Env } from '../types';

export const lineWebhookRoutes = new Hono<{ Bindings: Env }>();

async function verifyLineSignature(body: string, signature: string, channelSecret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return signature === expected;
}

interface LineEvent {
  type: string;
  source?: {
    type: string;
    groupId?: string;
  };
}

interface LineWebhookBody {
  events: LineEvent[];
}

lineWebhookRoutes.post('/', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-line-signature') ?? '';

  const channelSecret = await c.env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'line_channel_secret'"
  ).first<{ value: string }>();

  if (!channelSecret?.value) {
    console.log('LINE webhook: no channel secret configured, skipping verification');
    return c.text('OK', 200);
  }

  const valid = await verifyLineSignature(rawBody, signature, channelSecret.value);
  if (!valid) {
    console.log('LINE webhook: invalid signature');
    return c.text('Forbidden', 400);
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.text('OK', 200);
  }

  for (const event of body.events ?? []) {
    if (event.type === 'join' && event.source?.type === 'group' && event.source.groupId) {
      const groupId = event.source.groupId;
      const now = new Date().toISOString();
      await c.env.DB.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('line_group_id', ?)"
      ).bind(groupId).run();
      console.log(`LINE webhook: saved groupId ${groupId} at ${now}`);
    }
  }

  return c.text('OK', 200);
});
```

- [ ] **Step 2: Register route in `api/src/index.ts`**

Add import after existing imports:

```ts
import { lineWebhookRoutes } from './routes/lineWebhook';
```

Add route registration **before** the `app.use('*', apiKeyAuth)` line — actually since the auth middleware already exempts the path, placement after is also fine. Add after the existing `app.route` calls:

```ts
app.route('/line', lineWebhookRoutes);
```

The final `api/src/index.ts` should look like:

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { apiKeyAuth } from './middleware/auth';
import { watchlistRoutes } from './routes/watchlist';
import { algorithmRoutes } from './routes/algorithms';
import { signalRoutes } from './routes/signals';
import { settingsRoutes } from './routes/settings';
import { recommendationStocksRoutes } from './routes/recommendation-stocks';
import { recommendationsRoutes } from './routes/recommendations';
import { emailRecipientsRoutes } from './routes/emailRecipients';
import { lineWebhookRoutes } from './routes/lineWebhook';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowHeaders: ['X-API-Key', 'Content-Type'] }));
app.use('*', apiKeyAuth);

app.route('/watchlist', watchlistRoutes);
app.route('/watchlist', algorithmRoutes);
app.route('/signals', signalRoutes);
app.route('/settings', settingsRoutes);
app.route('/recommendation-stocks', recommendationStocksRoutes);
app.route('/recommendations', recommendationsRoutes);
app.route('/email-recipients', emailRecipientsRoutes);
app.route('/line', lineWebhookRoutes);

export default app;
```

- [ ] **Step 3: Test webhook receives and returns 200**

Start dev server:

```bash
cd api && npm run dev
```

Send a mock join event (no signature check since no channel secret is configured in local DB yet):

```bash
curl -X POST http://localhost:8787/line/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"join","source":{"type":"group","groupId":"C_test_group_id"}}]}'
```

Expected: `OK` with status 200

Verify group ID was saved:

```bash
npx wrangler d1 execute market-pulse --local --command "SELECT * FROM settings WHERE key = 'line_group_id';"
```

Expected: one row with `value = C_test_group_id`

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/lineWebhook.ts api/src/index.ts
git commit -m "feat: add LINE webhook endpoint to capture group ID"
```

---

### Task 3: API — Exclude `line_channel_secret` from GET `/settings`

**Files:**
- Modify: `api/src/routes/settings.ts`

- [ ] **Step 1: Update the GET handler to filter out `line_channel_secret`**

Replace the GET route in `api/src/routes/settings.ts`:

```ts
settingsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all<{
    key: string;
    value: string;
  }>();
  const map = Object.fromEntries(
    results
      .filter((r) => r.key !== 'line_channel_secret')
      .map((r) => [r.key, r.value])
  );
  return c.json(map);
});
```

- [ ] **Step 2: Verify secret is excluded**

First, insert a test secret:

```bash
npx wrangler d1 execute market-pulse --local --command \
  "INSERT OR REPLACE INTO settings (key, value) VALUES ('line_channel_secret', 'super_secret');"
```

Then fetch settings:

```bash
curl -H "X-API-Key: <your-key>" http://localhost:8787/settings
```

Expected: response JSON does NOT contain `line_channel_secret` key

- [ ] **Step 3: Commit**

```bash
git add api/src/routes/settings.ts
git commit -m "feat: exclude line_channel_secret from GET /settings response"
```

---

### Task 4: Scheduler — Create `line.ts`

**Files:**
- Create: `scheduler/src/line.ts`

- [ ] **Step 1: Create `scheduler/src/line.ts`**

```ts
import axios from 'axios';
import type { SignalSummary } from './notify.js';

function buildMessageText(date: string, signals: SignalSummary[]): string {
  const lines = [
    `📊 Market Pulse｜${date}`,
    `共 ${signals.length} 支標的觸發條件：`,
    '',
    ...signals.map(
      (s) =>
        `・${s.symbol} ${s.name}  ${s.closePrice}\n  條件：${s.triggeredConditions.join(', ')}`
    ),
  ];
  return lines.join('\n');
}

export async function sendLineGroupMessage(
  channelAccessToken: string,
  groupId: string,
  date: string,
  signals: SignalSummary[]
): Promise<void> {
  const text = buildMessageText(date, signals);
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: groupId,
      messages: [{ type: 'text', text }],
    },
    {
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd scheduler && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add scheduler/src/line.ts
git commit -m "feat: add sendLineGroupMessage to scheduler"
```

---

### Task 5: Scheduler — Call LINE notification in `index.ts`

**Files:**
- Modify: `scheduler/src/index.ts`

- [ ] **Step 1: Import `sendLineGroupMessage` at the top of `scheduler/src/index.ts`**

Add after the existing imports:

```ts
import { sendLineGroupMessage } from './line.js';
```

- [ ] **Step 2: Add LINE notification call after the email block**

After the `if (triggeredSignals.length > 0)` block (which already contains the email send), add a LINE push call. The complete `if (triggeredSignals.length > 0)` block becomes:

```ts
  if (triggeredSignals.length > 0) {
    await api.post('/signals', {
      signals: triggeredSignals.map(({ name: _n, ...s }) => s),
    });

    if (notifyEmails.length > 0) {
      await sendSignalEmail(
        RESEND_API_KEY,
        notifyEmails,
        today,
        triggeredSignals.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          closePrice: s.close_price,
          triggeredConditions: ['條件符合'],
        }))
      );
      console.log(`✉️  Sent email to ${notifyEmails.length} recipients with ${triggeredSignals.length} signals`);
    }

    const lineToken = settings.line_channel_access_token;
    const lineGroupId = settings.line_group_id;
    if (lineToken && lineGroupId) {
      try {
        await sendLineGroupMessage(
          lineToken,
          lineGroupId,
          today,
          triggeredSignals.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            closePrice: s.close_price,
            triggeredConditions: ['條件符合'],
          }))
        );
        console.log(`💬 Sent LINE message to group ${lineGroupId}`);
      } catch (err) {
        console.error('LINE push failed:', err);
      }
    } else {
      console.log('LINE not configured, skipping.');
    }
  } else {
    console.log('No signals today.');
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd scheduler && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add scheduler/src/index.ts scheduler/src/line.ts
git commit -m "feat: scheduler sends LINE group notification after email"
```

---

### Task 6: Web — Add LINE settings section to Settings page

**Files:**
- Modify: `web/src/pages/Settings.tsx`

- [ ] **Step 1: Add LINE config state and handlers**

In `Settings.tsx`, add the following state variables inside the `Settings` function (after existing state declarations):

```tsx
  const [lineToken, setLineToken] = useState('');
  const [lineSecret, setLineSecret] = useState('');
  const [lineGroupId, setLineGroupId] = useState('');
  const [lineTokenSet, setLineTokenSet] = useState(false);
  const [lineSecretSet, setLineSecretSet] = useState(false);
  const [lineSaved, setLineSaved] = useState(false);
```

- [ ] **Step 2: Load LINE group ID in `useEffect`**

In the existing `useEffect`, extend the `api.getSettings()` call to also set LINE state:

```tsx
    api.getSettings().then((s) => {
      setEnabled(s.schedule_enabled !== '0');
      setLineGroupId(s.line_group_id ?? '');
      setLineTokenSet(!!s.line_channel_access_token);
      setLineSecretSet(false); // secret is never returned by the API
    }).catch(console.error);
```

- [ ] **Step 3: Add LINE save handler**

Add this function inside the `Settings` component:

```tsx
  async function handleSaveLine(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, string> = {};
    if (lineToken) updates.line_channel_access_token = lineToken;
    if (lineSecret) updates.line_channel_secret = lineSecret;
    if (lineGroupId) updates.line_group_id = lineGroupId;
    await api.saveSettings(updates);
    if (lineToken) setLineTokenSet(true);
    if (lineSecret) setLineSecretSet(true);
    setLineToken('');
    setLineSecret('');
    setLineSaved(true);
    setTimeout(() => setLineSaved(false), 2000);
  }
```

- [ ] **Step 4: Add LINE section JSX**

Add the following block in the JSX return, after the Email 收件人 section and before the 推薦股票池 section:

```tsx
      {/* LINE notification */}
      <div style={{ marginTop: '32px', marginBottom: '12px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>LINE 通知</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
          將 Bot 加入群組後 Group ID 將自動填入。
          Webhook URL：<code style={{ fontSize: '12px', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px' }}>https://&lt;workers-domain&gt;/line/webhook</code>
        </p>
      </div>

      <div style={{ ...cardStyle, maxWidth: '480px' }}>
        <form onSubmit={handleSaveLine} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Channel Access Token
            </label>
            <input
              type="password"
              value={lineToken}
              onChange={(e) => setLineToken(e.target.value)}
              placeholder={lineTokenSet ? '已設定（留空保持不變）' : '貼上 Channel Access Token'}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Channel Secret
            </label>
            <input
              type="password"
              value={lineSecret}
              onChange={(e) => setLineSecret(e.target.value)}
              placeholder={lineSecretSet ? '已設定（留空保持不變）' : '貼上 Channel Secret（用於驗證 webhook）'}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Group ID
            </label>
            <input
              type="text"
              value={lineGroupId}
              onChange={(e) => setLineGroupId(e.target.value)}
              placeholder="Bot 加入群組後自動填入，或手動輸入"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" style={btnStyle}>儲存 LINE 設定</button>
            {lineSaved && (
              <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>
            )}
          </div>
        </form>
      </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Run the web dev server and verify visually**

```bash
cd web && npm run dev
```

Open `http://localhost:5173/settings` and verify:
- LINE section appears between Email 收件人 and 推薦股票池
- Channel Access Token field shows password dots
- Channel Secret field shows password dots
- Group ID field is editable
- Saving shows "已儲存 ✓"
- After refresh, Group ID reloads from settings, token/secret fields show "已設定" placeholder

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/Settings.tsx
git commit -m "feat: add LINE notification settings section to Settings page"
```
