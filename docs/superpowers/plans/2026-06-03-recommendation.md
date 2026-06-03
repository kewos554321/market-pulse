# Recommendation Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily stock recommendation system that scans a configurable pool (default: top 50 Taiwan stocks, max 120) against 4 built-in strategies, stores results in D1, and exposes them via a new web page; also add strategy templates to the AlgorithmEditor.

**Architecture:** Scheduler pre-computes recommendations daily and writes to D1 via API. Worker exposes CRUD for the stock pool and a read endpoint for recommendation results. Frontend adds a Recommendations page and template selector in AlgorithmEditor.

**Tech Stack:** Cloudflare Workers (Hono), D1 (SQLite), Vitest, React, React Router, Vite

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `api/migrations/0002_recommendations.sql` | New tables + seed data |
| Modify | `api/src/types.ts` | Add RecommendationStockRow, RecommendationRow |
| Create | `api/src/routes/recommendation-stocks.ts` | CRUD for stock pool |
| Create | `api/src/routes/recommendations.ts` | GET latest / POST results |
| Modify | `api/src/index.ts` | Register new routes |
| Modify | `scheduler/src/types.ts` | Add MA_CROSS to ConditionLeaf |
| Modify | `scheduler/src/evaluator.ts` | Handle MA_CROSS case |
| Create | `scheduler/src/strategies.ts` | 4 built-in strategy ConditionTrees |
| Modify | `scheduler/src/index.ts` | Scan stock pool + write recommendations |
| Modify | `scheduler/test/evaluator.test.ts` | Tests for MA_CROSS |
| Modify | `web/src/types.ts` | Add MA_CROSS, RecommendationStock, Recommendation |
| Modify | `web/src/api/client.ts` | Add recommendation API methods |
| Create | `web/src/pages/Recommendations.tsx` | Recommendations page |
| Modify | `web/src/App.tsx` | Add /recommendations route + nav link |
| Modify | `web/src/pages/Settings.tsx` | Add stock pool management section |
| Modify | `web/src/pages/AlgorithmEditor.tsx` | Add template selector |
| Modify | `web/src/components/ConditionBuilder.tsx` | Add MA_CROSS to INDICATORS |

---

## Task 1: DB Migration

**Files:**
- Create: `api/migrations/0002_recommendations.sql`

- [ ] **Step 1: Create migration file**

```sql
-- api/migrations/0002_recommendations.sql

CREATE TABLE IF NOT EXISTS recommendation_stocks (
  symbol     TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recommendations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  name        TEXT NOT NULL,
  close_price REAL NOT NULL,
  strategies  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendations_date ON recommendations(date);

-- Seed: top 50 Taiwan stocks by market cap
INSERT OR IGNORE INTO recommendation_stocks (symbol, name, is_default) VALUES
('2330', '台積電', 1),
('2317', '鴻海', 1),
('2454', '聯發科', 1),
('2412', '中華電', 1),
('2882', '國泰金', 1),
('2881', '富邦金', 1),
('2886', '兆豐金', 1),
('2884', '玉山金', 1),
('2891', '中信金', 1),
('2892', '第一金', 1),
('2880', '華南金', 1),
('2883', '開發金', 1),
('2885', '元大金', 1),
('2887', '台新金', 1),
('2888', '新光金', 1),
('2889', '國票金', 1),
('2890', '永豐金', 1),
('5880', '合庫金', 1),
('5871', '中租', 1),
('2823', '中壽', 1),
('1301', '台塑', 1),
('1303', '南亞', 1),
('1326', '台化', 1),
('6505', '台塑化', 1),
('2002', '中鋼', 1),
('2303', '聯電', 1),
('2308', '台達電', 1),
('2327', '國巨', 1),
('2356', '英業達', 1),
('2357', '華碩', 1),
('2379', '瑞昱', 1),
('2382', '廣達', 1),
('2395', '研華', 1),
('2408', '南亞科', 1),
('2409', '友達', 1),
('3008', '大立光', 1),
('3711', '日月光投控', 1),
('6669', '緯穎', 1),
('6770', '力積電', 1),
('8046', '南電', 1),
('2207', '和泰車', 1),
('2603', '長榮', 1),
('2609', '陽明', 1),
('2615', '萬海', 1),
('2618', '長榮航', 1),
('2633', '台灣高鐵', 1),
('2801', '彰銀', 1),
('3045', '台灣大', 1),
('4904', '遠傳', 1),
('9910', '豐泰', 1);
```

- [ ] **Step 2: Apply migration locally**

```bash
cd api && npx wrangler d1 migrations apply market-pulse --local
```

Expected output: `✅ Applied 1 migration`

- [ ] **Step 3: Commit**

```bash
git add api/migrations/0002_recommendations.sql
git commit -m "feat: add recommendations and recommendation_stocks DB tables"
```

---

## Task 2: Extend Evaluator with MA_CROSS

**Files:**
- Modify: `scheduler/src/types.ts`
- Modify: `scheduler/src/evaluator.ts`
- Modify: `scheduler/test/evaluator.test.ts`

MA_CROSS checks whether MA5 crossed above or below MA20 between the previous and current day (requires at least 2 data points in each MA array).

- [ ] **Step 1: Write failing tests**

Add to `scheduler/test/evaluator.test.ts` inside the `'leaf conditions'` describe block:

```typescript
  it('MA_CROSS golden is true when MA5 just crossed above MA20', () => {
    expect(evaluateConditionTree(
      { indicator: 'MA_CROSS', direction: 'golden' },
      makeIndicators({
        ma5:  [94, 97],   // prev=94 < prevMa20=95, curr=97 > currMa20=96
        ma20: [95, 96],
      })
    )).toBe(true);
  });

  it('MA_CROSS golden is false when MA5 was already above MA20', () => {
    expect(evaluateConditionTree(
      { indicator: 'MA_CROSS', direction: 'golden' },
      makeIndicators({
        ma5:  [98, 99],   // prev already above
        ma20: [95, 96],
      })
    )).toBe(false);
  });

  it('MA_CROSS dead is true when MA5 just crossed below MA20', () => {
    expect(evaluateConditionTree(
      { indicator: 'MA_CROSS', direction: 'dead' },
      makeIndicators({
        ma5:  [97, 94],   // prev=97 > prevMa20=95, curr=94 < currMa20=96
        ma20: [95, 96],
      })
    )).toBe(true);
  });

  it('MA_CROSS golden is false when arrays have fewer than 2 points', () => {
    expect(evaluateConditionTree(
      { indicator: 'MA_CROSS', direction: 'golden' },
      makeIndicators({ ma5: [102], ma20: [97] })
    )).toBe(false);
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd scheduler && npm test -- --reporter=verbose 2>&1 | grep -A2 'MA_CROSS'
```

Expected: FAIL — `evaluateConditionTree` returns false for unknown indicator.

- [ ] **Step 3: Add MA_CROSS to types**

In `scheduler/src/types.ts`, update the `indicator` union:

```typescript
export interface ConditionLeaf {
  indicator: 'RSI' | 'MA' | 'CLOSE' | 'VOLUME' | 'KD_CROSS' | 'MACD_CROSS' | 'MA_CROSS';
  period?: number;
  op?: ConditionOp;
  value?: number;
  ref?: string;
  multiplier?: number;
  direction?: 'golden' | 'dead';
}
```

- [ ] **Step 4: Add MA_CROSS case to evaluator**

In `scheduler/src/evaluator.ts`, add this case inside `evaluateLeaf` after the `KD_CROSS` case, before `default`:

```typescript
    case 'MA_CROSS': {
      const ma5 = indicators.ma5;
      const ma20 = indicators.ma20;
      if (ma5.length < 2 || ma20.length < 2) return false;
      const prevMa5 = ma5[ma5.length - 2];
      const currMa5 = ma5[ma5.length - 1];
      const prevMa20 = ma20[ma20.length - 2];
      const currMa20 = ma20[ma20.length - 1];
      if (c.direction === 'golden') {
        return prevMa5 <= prevMa20 && currMa5 > currMa20;
      }
      return prevMa5 >= prevMa20 && currMa5 < currMa20;
    }
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd scheduler && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add scheduler/src/types.ts scheduler/src/evaluator.ts scheduler/test/evaluator.test.ts
git commit -m "feat: add MA_CROSS indicator to evaluator"
```

---

## Task 3: Scheduler — strategies.ts

**Files:**
- Create: `scheduler/src/strategies.ts`

Defines the 4 built-in strategy names + their ConditionTrees. The Scheduler uses these to evaluate each stock in the recommendation pool.

- [ ] **Step 1: Create strategies.ts**

```typescript
// scheduler/src/strategies.ts
import type { ConditionTree } from './types.js';

export const BUILT_IN_STRATEGIES: Array<{ name: string; conditions: ConditionTree }> = [
  {
    name: '黃金交叉',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'MA_CROSS', direction: 'golden' }],
    },
  },
  {
    name: 'RSI超賣反彈',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'RSI', op: '<', value: 30 }],
    },
  },
  {
    name: 'MACD翻多',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'MACD_CROSS', direction: 'golden' }],
    },
  },
  {
    name: 'KD黃金交叉',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'KD_CROSS', direction: 'golden' }],
    },
  },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd scheduler && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scheduler/src/strategies.ts
git commit -m "feat: add built-in strategy definitions"
```

---

## Task 4: Scheduler — Recommendation Scan

**Files:**
- Modify: `scheduler/src/index.ts`

Add a `runRecommendationScan` function that runs after the watchlist scan and writes results to the API.

- [ ] **Step 1: Add runRecommendationScan to scheduler/src/index.ts**

Add this import at the top of the file (after existing imports):

```typescript
import { BUILT_IN_STRATEGIES } from './strategies.js';
```

Add this function before the `run()` function:

```typescript
async function runRecommendationScan(today: string) {
  const { data: stockPool } = await api.get<{ symbol: string; name: string }[]>(
    '/recommendation-stocks'
  );
  console.log(`Scanning ${stockPool.length} recommendation stocks...`);

  const hits: {
    symbol: string;
    name: string;
    close_price: number;
    strategies: string[];
  }[] = [];

  for (const stock of stockPool) {
    try {
      let ohlcv = await fetchNinetyDays(stock.symbol);
      if (ohlcv.length < 65) {
        const d = new Date();
        d.setMonth(d.getMonth() - 4);
        const startDate = d.toISOString().split('T')[0];
        ohlcv = await fetchHistoricalData(stock.symbol, startDate, FINMIND_TOKEN || undefined);
      }
      if (ohlcv.length < 30) {
        console.log(`${stock.symbol}: insufficient data, skipping`);
        continue;
      }
      const indicators = calculateIndicators(ohlcv);
      const triggered = BUILT_IN_STRATEGIES
        .filter((s) => evaluateConditionTree(s.conditions, indicators))
        .map((s) => s.name);

      if (triggered.length > 0) {
        const closePrice = ohlcv[ohlcv.length - 1].close;
        console.log(`✅ ${stock.symbol} ${stock.name}: ${triggered.join(', ')}`);
        hits.push({ symbol: stock.symbol, name: stock.name, close_price: closePrice, strategies: triggered });
      }
    } catch (err) {
      console.error(`Recommendation scan error for ${stock.symbol}:`, err);
    }
  }

  await api.post('/recommendations', { date: today, items: hits });
  console.log(`📊 Wrote ${hits.length} recommendations for ${today}`);
}
```

- [ ] **Step 2: Call runRecommendationScan at end of run()**

At the bottom of the `run()` function, before the closing brace, add:

```typescript
  const today = new Date().toISOString().split('T')[0];
  await runRecommendationScan(today);
```

**Note:** The existing `today` const is defined later in `run()`. Move the definition to the top of `run()` and reuse it in both the email send and the recommendation scan call. Replace `const today = new Date().toISOString().split('T')[0];` that's already in `run()` with a reference to the one moved to the top.

The updated `run()` function structure (only showing changed/added lines around the end):

```typescript
async function run() {
  const today = new Date().toISOString().split('T')[0];   // ← move here, was near sendSignalEmail

  // ... existing settings/watchlist/signals logic unchanged ...

  if (triggeredSignals.length > 0) {
    await api.post('/signals', {
      signals: triggeredSignals.map(({ name: _n, ...s }) => s),
    });

    await sendSignalEmail(
      RESEND_API_KEY,
      notifyEmail,
      today,                                              // ← use moved const
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

  await runRecommendationScan(today);                     // ← new call
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd scheduler && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scheduler/src/index.ts
git commit -m "feat: add daily recommendation scan to scheduler"
```

---

## Task 5: API — Types + Recommendation-Stocks Routes

**Files:**
- Modify: `api/src/types.ts`
- Create: `api/src/routes/recommendation-stocks.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Add new row types to api/src/types.ts**

Append to the end of `api/src/types.ts`:

```typescript
export interface RecommendationStockRow {
  symbol: string;
  name: string;
  is_default: number;
}

export interface RecommendationRow {
  id: number;
  date: string;
  symbol: string;
  name: string;
  close_price: number;
  strategies: string; // JSON array string
  created_at: string;
}
```

Also update `IndicatorName` to include `'MA_CROSS'`:

```typescript
export type IndicatorName = 'RSI' | 'MA' | 'CLOSE' | 'VOLUME' | 'KD_CROSS' | 'MACD_CROSS' | 'MA_CROSS';
```

And update `ConditionLeaf` accordingly:

```typescript
export interface ConditionLeaf {
  indicator: IndicatorName;
  period?: number;
  op?: ConditionOp;
  value?: number;
  ref?: string;
  multiplier?: number;
  direction?: 'golden' | 'dead';
}
```

- [ ] **Step 2: Create api/src/routes/recommendation-stocks.ts**

```typescript
import { Hono } from 'hono';
import { Env, RecommendationStockRow } from '../types';

export const recommendationStocksRoutes = new Hono<{ Bindings: Env }>();

const MAX_STOCKS = 120;

recommendationStocksRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM recommendation_stocks ORDER BY is_default DESC, symbol ASC'
  ).all<RecommendationStockRow>();
  return c.json(results);
});

recommendationStocksRoutes.post('/', async (c) => {
  const { symbol, name } = await c.req.json<{ symbol: string; name: string }>();
  if (!symbol || !name) return c.json({ error: 'symbol and name required' }, 400);

  const { results: existing } = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM recommendation_stocks'
  ).all<{ count: number }>();
  if ((existing[0]?.count ?? 0) >= MAX_STOCKS) {
    return c.json({ error: `Stock pool is full (max ${MAX_STOCKS})` }, 400);
  }

  await c.env.DB.prepare(
    'INSERT INTO recommendation_stocks (symbol, name, is_default) VALUES (?, ?, 0)'
  ).bind(symbol.trim(), name.trim()).run();

  return c.json({ symbol: symbol.trim(), name: name.trim(), is_default: 0 }, 201);
});

recommendationStocksRoutes.delete('/:symbol', async (c) => {
  const { symbol } = c.req.param();
  const result = await c.env.DB.prepare(
    'DELETE FROM recommendation_stocks WHERE symbol = ?'
  ).bind(symbol).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 3: Register route in api/src/index.ts**

Add the import after the existing route imports:

```typescript
import { recommendationStocksRoutes } from './routes/recommendation-stocks';
```

Add the route registration after `app.route('/settings', settingsRoutes);`:

```typescript
app.route('/recommendation-stocks', recommendationStocksRoutes);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add api/src/types.ts api/src/routes/recommendation-stocks.ts api/src/index.ts
git commit -m "feat: add recommendation-stocks API routes"
```

---

## Task 6: API — Recommendations Routes

**Files:**
- Create: `api/src/routes/recommendations.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Create api/src/routes/recommendations.ts**

```typescript
import { Hono } from 'hono';
import { Env, RecommendationRow } from '../types';

export const recommendationsRoutes = new Hono<{ Bindings: Env }>();

recommendationsRoutes.get('/', async (c) => {
  const { results: dateRow } = await c.env.DB.prepare(
    'SELECT MAX(date) as latest_date FROM recommendations'
  ).all<{ latest_date: string | null }>();

  const latestDate = dateRow[0]?.latest_date;
  if (!latestDate) return c.json({ date: null, items: [] });

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM recommendations WHERE date = ? ORDER BY symbol ASC'
  ).bind(latestDate).all<RecommendationRow>();

  return c.json({
    date: latestDate,
    items: results.map((r) => ({
      ...r,
      strategies: JSON.parse(r.strategies) as string[],
    })),
  });
});

recommendationsRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    date: string;
    items: { symbol: string; name: string; close_price: number; strategies: string[] }[];
  }>();

  if (!body.date) return c.json({ error: 'date required' }, 400);

  const now = new Date().toISOString();

  // Replace today's results atomically
  const stmts = [
    c.env.DB.prepare('DELETE FROM recommendations WHERE date = ?').bind(body.date),
    ...body.items.map((item) =>
      c.env.DB.prepare(
        'INSERT INTO recommendations (date, symbol, name, close_price, strategies, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(body.date, item.symbol, item.name, item.close_price, JSON.stringify(item.strategies), now)
    ),
  ];

  await c.env.DB.batch(stmts);
  return c.json({ inserted: body.items.length }, 201);
});
```

- [ ] **Step 2: Register route in api/src/index.ts**

Add import:

```typescript
import { recommendationsRoutes } from './routes/recommendations';
```

Add route registration:

```typescript
app.route('/recommendations', recommendationsRoutes);
```

The final `api/src/index.ts` route block should look like:

```typescript
app.route('/watchlist', watchlistRoutes);
app.route('/watchlist', algorithmRoutes);
app.route('/signals', signalRoutes);
app.route('/settings', settingsRoutes);
app.route('/recommendation-stocks', recommendationStocksRoutes);
app.route('/recommendations', recommendationsRoutes);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/recommendations.ts api/src/index.ts
git commit -m "feat: add recommendations API routes"
```

---

## Task 7: Web — Types + API Client

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Add new types to web/src/types.ts**

Add `'MA_CROSS'` to the `ConditionLeaf` indicator union:

```typescript
export interface ConditionLeaf {
  indicator: 'RSI' | 'MA' | 'CLOSE' | 'VOLUME' | 'KD_CROSS' | 'MACD_CROSS' | 'MA_CROSS';
  // ... rest unchanged
}
```

Append new interfaces at the end of the file:

```typescript
export interface RecommendationStock {
  symbol: string;
  name: string;
  is_default: number;
}

export interface Recommendation {
  id: number;
  date: string;
  symbol: string;
  name: string;
  close_price: number;
  strategies: string[];
}

export interface RecommendationsResponse {
  date: string | null;
  items: Recommendation[];
}
```

- [ ] **Step 2: Add API methods to web/src/api/client.ts**

Append inside the `api` object (before the closing `};`):

```typescript
  getRecommendations: () => request<import('../types').RecommendationsResponse>('/recommendations'),
  getRecommendationStocks: () => request<import('../types').RecommendationStock[]>('/recommendation-stocks'),
  addRecommendationStock: (symbol: string, name: string) =>
    request<import('../types').RecommendationStock>('/recommendation-stocks', {
      method: 'POST',
      body: JSON.stringify({ symbol, name }),
    }),
  deleteRecommendationStock: (symbol: string) =>
    request<{ success: boolean }>(`/recommendation-stocks/${symbol}`, { method: 'DELETE' }),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/types.ts web/src/api/client.ts
git commit -m "feat: add recommendation types and API client methods"
```

---

## Task 8: Web — Recommendations Page + Routing

**Files:**
- Create: `web/src/pages/Recommendations.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create web/src/pages/Recommendations.tsx**

```typescript
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Recommendation, RecommendationStock, WatchlistItem } from '../types';

export function Recommendations() {
  const [date, setDate] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([api.getRecommendations(), api.getWatchlist()])
      .then(([recs, wl]) => {
        setDate(recs.date);
        setItems(recs.items);
        setWatchlist(wl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const watchlistSymbols = new Set(watchlist.map((w) => w.symbol));

  async function handleAdd(item: Recommendation) {
    await api.addStock(item.symbol, item.name);
    setAddedSymbols((prev) => new Set(prev).add(item.symbol));
  }

  if (loading) return <p>載入中...</p>;

  return (
    <div>
      <h1>推薦選股</h1>
      {!date ? (
        <p style={{ color: '#666' }}>尚無推薦資料，請等待排程執行。</p>
      ) : (
        <>
          <p style={{ color: '#666', marginBottom: '1rem' }}>掃描日期：{date}</p>
          {items.length === 0 ? (
            <p>今日無符合策略的標的。</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>代號</th>
                  <th style={{ padding: '0.5rem' }}>名稱</th>
                  <th style={{ padding: '0.5rem' }}>收盤價</th>
                  <th style={{ padding: '0.5rem' }}>符合策略</th>
                  <th style={{ padding: '0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const inWatchlist = watchlistSymbols.has(item.symbol) || addedSymbols.has(item.symbol);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{item.symbol}</td>
                      <td style={{ padding: '0.5rem' }}>{item.name}</td>
                      <td style={{ padding: '0.5rem' }}>{item.close_price.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {item.strategies.map((s) => (
                          <span
                            key={s}
                            style={{
                              display: 'inline-block',
                              background: '#e8f4fd',
                              color: '#0070f3',
                              borderRadius: '4px',
                              padding: '0.1rem 0.4rem',
                              fontSize: '12px',
                              marginRight: '0.25rem',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <button
                          onClick={() => handleAdd(item)}
                          disabled={inWatchlist}
                          style={{ opacity: inWatchlist ? 0.5 : 1 }}
                        >
                          {inWatchlist ? '已在追蹤清單' : '加入追蹤清單'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route and nav link in web/src/App.tsx**

Add the import:

```typescript
import { Recommendations } from './pages/Recommendations';
```

Add the nav link after the `/watchlist` link:

```typescript
<NavLink to="/recommendations" style={navLinkStyle}>推薦</NavLink>
```

Add the route inside `<Routes>`:

```typescript
<Route path="/recommendations" element={<Recommendations />} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Recommendations.tsx web/src/App.tsx
git commit -m "feat: add Recommendations page and nav route"
```

---

## Task 9: Web — Settings Stock Pool Section

**Files:**
- Modify: `web/src/pages/Settings.tsx`

Add a "推薦股票池" section below the existing notification settings form.

- [ ] **Step 1: Update web/src/pages/Settings.tsx**

Replace the entire file content with:

```typescript
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RecommendationStock } from '../types';

export function Settings() {
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const [stocks, setStocks] = useState<RecommendationStock[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [stockError, setStockError] = useState('');
  const [stocksLoading, setStocksLoading] = useState(true);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEmail(s.notify_email ?? '');
      setEnabled(s.schedule_enabled !== '0');
    }).catch(console.error);

    api.getRecommendationStocks()
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await api.saveSettings({
      notify_email: email,
      schedule_enabled: enabled ? '1' : '0',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      <h1>設定</h1>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
        <label>
          通知 Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
            placeholder="your@email.com"
            required
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          啟用每日排程
        </label>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button type="submit">儲存設定</button>
          {saved && <span style={{ color: 'green' }}>已儲存 ✓</span>}
        </div>
      </form>

      <hr style={{ margin: '2rem 0' }} />

      <section>
        <h2 style={{ marginBottom: '0.5rem' }}>推薦股票池</h2>
        {stocksLoading ? (
          <p>載入中...</p>
        ) : (
          <>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              {stocks.length} / 120 支
            </p>

            <form onSubmit={handleAddStock} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="股票代號（如 2330）"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                style={{ width: '140px' }}
                required
              />
              <input
                type="text"
                placeholder="名稱（如 台積電）"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: '140px' }}
                required
              />
              <button type="submit">新增</button>
              {stockError && <span style={{ color: 'red', alignSelf: 'center' }}>{stockError}</span>}
            </form>

            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: '500px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>代號</th>
                  <th style={{ padding: '0.4rem' }}>名稱</th>
                  <th style={{ padding: '0.4rem' }}>類型</th>
                  <th style={{ padding: '0.4rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.symbol} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>{s.symbol}</td>
                    <td style={{ padding: '0.4rem' }}>{s.name}</td>
                    <td style={{ padding: '0.4rem', color: '#888', fontSize: '12px' }}>
                      {s.is_default ? '預設' : '自訂'}
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <button
                        onClick={() => handleDeleteStock(s.symbol)}
                        style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Settings.tsx
git commit -m "feat: add recommendation stock pool management to Settings page"
```

---

## Task 10: Web — Template Selector + MA_CROSS in ConditionBuilder

**Files:**
- Modify: `web/src/components/ConditionBuilder.tsx`
- Modify: `web/src/pages/AlgorithmEditor.tsx`

- [ ] **Step 1: Add MA_CROSS to ConditionBuilder.tsx**

In `web/src/components/ConditionBuilder.tsx`:

1. Update the `INDICATORS` constant:

```typescript
const INDICATORS = ['RSI', 'CLOSE', 'MA', 'VOLUME', 'KD_CROSS', 'MACD_CROSS', 'MA_CROSS'] as const;
```

2. Update the `isCross` check:

```typescript
const isCross = ['KD_CROSS', 'MACD_CROSS', 'MA_CROSS'].includes(leaf.indicator);
```

- [ ] **Step 2: Add template selector to AlgorithmEditor.tsx**

Define templates at the top of the file (after imports):

```typescript
const STRATEGY_TEMPLATES: Array<{ name: string; conditions: ConditionTree }> = [
  {
    name: '黃金交叉',
    conditions: { operator: 'AND', conditions: [{ indicator: 'MA_CROSS', direction: 'golden' }] },
  },
  {
    name: 'RSI超賣反彈',
    conditions: { operator: 'AND', conditions: [{ indicator: 'RSI', op: '<', value: 30 }] },
  },
  {
    name: 'MACD翻多',
    conditions: { operator: 'AND', conditions: [{ indicator: 'MACD_CROSS', direction: 'golden' }] },
  },
  {
    name: 'KD黃金交叉',
    conditions: { operator: 'AND', conditions: [{ indicator: 'KD_CROSS', direction: 'golden' }] },
  },
];
```

Add a handler in the `AlgorithmEditor` component body (after the `handleSave` function):

```typescript
  function handleApplyTemplate(templateName: string) {
    const tpl = STRATEGY_TEMPLATES.find((t) => t.name === templateName);
    if (!tpl) return;
    if (!window.confirm(`套用「${tpl.name}」模板將覆蓋現有條件，確定嗎？`)) return;
    setConditions(tpl.conditions);
  }
```

Add the template selector UI in the JSX, right after the `<h1>` heading and before `<ConditionBuilder>`:

```typescript
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label htmlFor="template-select" style={{ fontWeight: 'bold' }}>套用模板：</label>
        <select
          id="template-select"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) handleApplyTemplate(e.target.value);
            e.target.value = '';
          }}
        >
          <option value="" disabled>選擇策略模板...</option>
          {STRATEGY_TEMPLATES.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ConditionBuilder.tsx web/src/pages/AlgorithmEditor.tsx
git commit -m "feat: add strategy template selector and MA_CROSS to ConditionBuilder"
```

---

## Task 11: Apply Migration to Production

Run this only when ready to deploy. Requires wrangler authenticated with the correct account.

- [ ] **Step 1: Apply migration to remote D1**

```bash
cd api && npx wrangler d1 migrations apply market-pulse
```

Expected: `✅ Applied 1 migration`

- [ ] **Step 2: Deploy API**

```bash
cd api && npx wrangler deploy
```

- [ ] **Step 3: Commit (if any deployment config changed)**

```bash
git add -A && git commit -m "chore: deploy recommendation feature"
```
