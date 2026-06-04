# Multi-Email Recipients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `notify_email` setting with a CRUD-managed list of email recipients, sending daily signal notifications to all of them.

**Architecture:** Add an `email_recipients` table to D1, expose GET/POST/DELETE routes in the API, update the scheduler to send to all recipients via `Promise.all`, and replace the email input in the Settings UI with a recipient list manager.

**Tech Stack:** Cloudflare Workers + Hono + D1 (API), Node.js + Resend (scheduler), React (web)

---

### Task 1: DB Migration — Create `email_recipients` table

**Files:**
- Create: `api/migrations/0003_add_email_recipients.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Apply migration locally**

Run from `api/`:
```bash
npm run migrate:local
```

Expected: `✅ Applied migration 0003_add_email_recipients.sql`

- [ ] **Step 3: Verify table exists**

```bash
npx wrangler d1 execute market-pulse --local --command "SELECT * FROM email_recipients;"
```

Expected: empty result set (or one row if `notify_email` was set)

- [ ] **Step 4: Commit**

```bash
git add api/migrations/0003_add_email_recipients.sql
git commit -m "feat: add email_recipients migration"
```

---

### Task 2: API Route — `emailRecipients.ts`

**Files:**
- Create: `api/src/routes/emailRecipients.ts`
- Modify: `api/src/types.ts` (add `EmailRecipientRow`)

- [ ] **Step 1: Add `EmailRecipientRow` type to `api/src/types.ts`**

Append to the end of the file:

```ts
export interface EmailRecipientRow {
  id: string;
  email: string;
  label: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create `api/src/routes/emailRecipients.ts`**

```ts
import { Hono } from 'hono';
import { Env, EmailRecipientRow } from '../types';

export const emailRecipientsRoutes = new Hono<{ Bindings: Env }>();

emailRecipientsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM email_recipients ORDER BY created_at ASC'
  ).all<EmailRecipientRow>();
  return c.json(results);
});

emailRecipientsRoutes.post('/', async (c) => {
  const { email, label } = await c.req.json<{ email: string; label?: string }>();
  if (!email) return c.json({ error: 'email required' }, 400);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return c.json({ error: 'invalid email format' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      'INSERT INTO email_recipients (id, email, label, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, email.trim().toLowerCase(), label?.trim() ?? null, now).run();
  } catch {
    return c.json({ error: 'email already exists' }, 409);
  }

  return c.json({ id, email: email.trim().toLowerCase(), label: label?.trim() ?? null, created_at: now }, 201);
});

emailRecipientsRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare(
    'DELETE FROM email_recipients WHERE id = ?'
  ).bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 3: Register route in `api/src/index.ts`**

Add import after existing imports:
```ts
import { emailRecipientsRoutes } from './routes/emailRecipients';
```

Add route registration after `app.route('/settings', settingsRoutes);`:
```ts
app.route('/email-recipients', emailRecipientsRoutes);
```

- [ ] **Step 4: Test GET with wrangler dev**

```bash
cd api && npm run dev
```

Then in another terminal:
```bash
curl -H "X-API-Key: <your-key>" http://localhost:8787/email-recipients
```

Expected: `[]`

- [ ] **Step 5: Test POST**

```bash
curl -X POST http://localhost:8787/email-recipients \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","label":"測試"}'
```

Expected: `{"id":"...","email":"test@example.com","label":"測試","created_at":"..."}`

- [ ] **Step 6: Test duplicate rejection**

```bash
curl -X POST http://localhost:8787/email-recipients \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected: `{"error":"email already exists"}` with status 409

- [ ] **Step 7: Test DELETE**

```bash
curl -X DELETE http://localhost:8787/email-recipients/<id-from-step-5> \
  -H "X-API-Key: <your-key>"
```

Expected: `{"success":true}`

- [ ] **Step 8: Commit**

```bash
git add api/src/routes/emailRecipients.ts api/src/types.ts api/src/index.ts
git commit -m "feat: add email-recipients API routes"
```

---

### Task 3: Scheduler — Update `notify.ts`

**Files:**
- Modify: `scheduler/src/notify.ts`

- [ ] **Step 1: Change `toEmail` parameter to accept an array**

Replace the entire content of `scheduler/src/notify.ts`:

```ts
import { Resend } from 'resend';

export interface SignalSummary {
  symbol: string;
  name: string;
  closePrice: number;
  triggeredConditions: string[];
}

export async function sendSignalEmail(
  apiKey: string,
  toEmails: string[],
  date: string,
  signals: SignalSummary[]
): Promise<void> {
  const resend = new Resend(apiKey);

  const listHtml = signals
    .map(
      (s) => `
      <li style="margin-bottom:12px">
        <strong>${s.symbol} ${s.name}</strong><br/>
        收盤價：${s.closePrice}<br/>
        觸發條件：${s.triggeredConditions.join(', ')}
      </li>`
    )
    .join('');

  await resend.emails.send({
    from: 'Market Pulse <onboarding@resend.dev>',
    to: toEmails,
    subject: `[Market Pulse] ${date} 發現 ${signals.length} 支符合條件的標的`,
    html: `
      <h2>今日觸發訊號 (${date})</h2>
      <ul style="padding-left:20px">${listHtml}</ul>
      <hr/>
      <small>由 Market Pulse 自動發送</small>
    `,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd scheduler && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add scheduler/src/notify.ts
git commit -m "feat: update sendSignalEmail to accept multiple recipients"
```

---

### Task 4: Scheduler — Update `index.ts` to fetch recipient list

**Files:**
- Modify: `scheduler/src/index.ts`

- [ ] **Step 1: Replace `notify_email` lookup with recipient list fetch**

In `scheduler/src/index.ts`, replace this block:

```ts
  const notifyEmail = settings.notify_email;
  if (!notifyEmail) {
    console.log('No notify_email configured. Exiting.');
    return;
  }
```

With:

```ts
  const { data: recipients } = await api.get<{ id: string; email: string }[]>('/email-recipients');
  const notifyEmails = recipients.map((r) => r.email);
  if (notifyEmails.length === 0) {
    console.log('No email recipients configured. Skipping email.');
  }
```

- [ ] **Step 2: Replace the entire `if (triggeredSignals.length > 0)` block**

Replace the existing block:

```ts
  if (triggeredSignals.length > 0) {
    await api.post('/signals', {
      signals: triggeredSignals.map(({ name: _n, ...s }) => s),
    });

    await sendSignalEmail(
      RESEND_API_KEY,
      notifyEmail,
      today,
      triggeredSignals.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        closePrice: s.close_price,
        triggeredConditions: ['條件符合'],
      }))
    );
    console.log(`✉️  Sent email to ${notifyEmail} with ${triggeredSignals.length} signals`);
  } else {
    console.log('No signals today.');
  }
```

With:

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
git add scheduler/src/index.ts
git commit -m "feat: scheduler reads email recipients from API"
```

---

### Task 5: Web — Add API methods to `client.ts`

**Files:**
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Add `EmailRecipient` type and new API methods**

Add to `web/src/api/client.ts` — first, add an inline type at the top (after the existing imports area, before `const API_BASE`):

```ts
export interface EmailRecipient {
  id: string;
  email: string;
  label: string | null;
  created_at: string;
}
```

Then add to the `api` object (after `deleteRecommendationStock`):

```ts
  getEmailRecipients: () => request<EmailRecipient[]>('/email-recipients'),
  addEmailRecipient: (email: string, label?: string) =>
    request<EmailRecipient>('/email-recipients', {
      method: 'POST',
      body: JSON.stringify({ email, label }),
    }),
  deleteEmailRecipient: (id: string) =>
    request<{ success: boolean }>(`/email-recipients/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Commit**

```bash
git add web/src/api/client.ts
git commit -m "feat: add email-recipients API client methods"
```

---

### Task 6: Web — Update Settings page

**Files:**
- Modify: `web/src/pages/Settings.tsx`

- [ ] **Step 1: Replace the single email input with a CRUD email recipients section**

Replace the entire content of `web/src/pages/Settings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { EmailRecipient } from '../api/client';
import type { RecommendationStock } from '../types';

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
  maxWidth: '480px',
};

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #e2e8f0', borderRadius: '8px',
  padding: '9px 12px', fontSize: '13px', color: '#1e293b',
  outline: 'none', boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none',
  borderRadius: '8px', padding: '9px 16px',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};

export function Settings() {
  const [enabled, setEnabled] = useState(true);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [emailError, setEmailError] = useState('');

  const [stocks, setStocks] = useState<RecommendationStock[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [stockError, setStockError] = useState('');
  const [stocksLoading, setStocksLoading] = useState(true);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEnabled(s.schedule_enabled !== '0');
    }).catch(console.error);

    api.getEmailRecipients()
      .then(setRecipients)
      .catch(console.error)
      .finally(() => setRecipientsLoading(false));

    api.getRecommendationStocks()
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, []);

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    await api.saveSettings({ schedule_enabled: enabled ? '1' : '0' });
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 2000);
  }

  async function handleAddRecipient(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    try {
      const recipient = await api.addEmailRecipient(newEmail.trim(), newLabel.trim() || undefined);
      setRecipients((prev) => [...prev, recipient]);
      setNewEmail('');
      setNewLabel('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('409')) setEmailError('此 email 已存在');
      else if (msg.includes('invalid')) setEmailError('Email 格式不正確');
      else setEmailError('新增失敗');
    }
  }

  async function handleDeleteRecipient(id: string) {
    if (!confirm('確定要移除此收件人？')) return;
    await api.deleteEmailRecipient(id);
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    setStockError('');
    try {
      const stock = await api.addRecommendationStock(newSymbol.trim(), newName.trim());
      setStocks((prev) => [...prev, stock]);
      setNewSymbol('');
      setNewName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStockError(msg.includes('full') ? '股票池已達上限 120 支' : '新增失敗，請確認代號是否重複');
    }
  }

  async function handleDeleteStock(symbol: string) {
    await api.deleteRecommendationStock(symbol);
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>設定</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>通知和排程設定</p>
      </div>

      {/* Schedule settings */}
      <div style={cardStyle}>
        <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>啟用每日排程</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>每週一到五 14:35 台北時間自動執行</div>
              </div>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" style={btnStyle}>儲存設定</button>
            {scheduleSaved && (
              <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>
            )}
          </div>
        </form>
      </div>

      {/* Email recipients */}
      <div style={{ marginTop: '32px', marginBottom: '12px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Email 收件人</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>每日訊號通知的收件人清單</p>
      </div>

      <div style={{ ...cardStyle, maxWidth: '560px' }}>
        <form onSubmit={handleAddRecipient} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ ...inputStyle, width: '200px' }}
            required
          />
          <input
            type="text"
            placeholder="備註（選填）"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ ...inputStyle, width: '120px' }}
          />
          <button type="submit" style={btnStyle}>新增</button>
          {emailError && (
            <span style={{ fontSize: '12px', color: '#ef4444', alignSelf: 'center' }}>{emailError}</span>
          )}
        </form>

        {recipientsLoading ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>載入中...</p>
        ) : recipients.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>尚無收件人</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                {['Email', '備註', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontSize: '13px', color: '#0f172a' }}>{r.email}</td>
                  <td style={{ padding: '8px 10px', fontSize: '13px', color: '#64748b' }}>{r.label ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <button
                      onClick={() => handleDeleteRecipient(r.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', padding: '2px 8px' }}
                    >
                      移除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recommendation stock pool */}
      <div style={{ marginTop: '32px', marginBottom: '12px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>推薦股票池</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>每日推薦掃描的範圍，上限 120 支</p>
      </div>

      <div style={{ ...cardStyle, maxWidth: '560px' }}>
        {stocksLoading ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>載入中...</p>
        ) : (
          <>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              目前 <strong style={{ color: '#0f172a' }}>{stocks.length}</strong> / 120 支
            </p>

            <form onSubmit={handleAddStock} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="代號（如 2330）"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                style={{ ...inputStyle, width: '130px' }}
                required
              />
              <input
                type="text"
                placeholder="名稱（如 台積電）"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ ...inputStyle, width: '130px' }}
                required
              />
              <button type="submit" style={btnStyle}>新增</button>
              {stockError && (
                <span style={{ fontSize: '12px', color: '#ef4444', alignSelf: 'center' }}>{stockError}</span>
              )}
            </form>

            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                    {['代號', '名稱', '類型', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => (
                    <tr key={s.symbol} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{s.symbol}</td>
                      <td style={{ padding: '8px 10px', fontSize: '13px', color: '#374151' }}>{s.name}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                          background: s.is_default ? '#ede9fe' : '#f0fdf4',
                          color: s.is_default ? '#6366f1' : '#16a34a',
                          fontWeight: 500,
                        }}>
                          {s.is_default ? '預設' : '自訂'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          onClick={() => handleDeleteStock(s.symbol)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', padding: '2px 8px' }}
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run the web dev server and verify visually**

```bash
cd web && npm run dev
```

Open `http://localhost:5173/settings` and verify:
- Schedule enabled checkbox still works and saves
- Email recipients section shows empty state "尚無收件人"
- Can add an email (with and without label)
- Can delete a recipient
- Duplicate email shows error "此 email 已存在"

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Settings.tsx web/src/api/client.ts
git commit -m "feat: replace single notify_email with email recipients CRUD UI"
```
