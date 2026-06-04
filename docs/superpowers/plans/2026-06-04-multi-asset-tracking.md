# Multi-Asset Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend market-pulse to track US stocks, crypto, and FX rates — each with a dedicated page, sub-tabs, and the same algorithm/condition/notification infrastructure already used for Taiwan stocks.

**Architecture:** Add `asset_type` column to the existing `watchlist` table as the single discriminator. New `fx_daily` table stores daily FX snapshots for indicator calculation (accumulates over time — no paid time-series API needed). A `DataFetcher` interface in the scheduler routes each asset type to Finnhub (US stocks), Binance (crypto), or ExchangeRate-API + D1 (FX).

**Tech Stack:** Vitest, Cloudflare Workers + D1, Hono, React + React Router, Finnhub API (free), Binance Public API (free), ExchangeRate-API free tier

---

## File Map

**New — API:**
- `api/migrations/0003_asset_type.sql` — add `asset_type` to `watchlist`; add `fx_daily` table
- `api/src/routes/fx-daily.ts` — GET + POST for FX daily rate snapshots

**Modified — API:**
- `api/src/types.ts` — add `asset_type` to `WatchlistRow`; add `FxDailyRow`
- `api/src/routes/watchlist.ts` — filter GET by `?asset_type=`; accept `asset_type` in POST; add GET `/:id` single-item route
- `api/src/routes/signals.ts` — filter GET by `?asset_type=` via JOIN with watchlist
- `api/src/index.ts` — register `/fx-daily` route

**New — Scheduler:**
- `scheduler/src/fetchers/types.ts` — `DataFetcher` interface + re-export of `OHLCVData`
- `scheduler/src/fetchers/tw-stock.ts` — wraps existing TWSE + FinMind logic
- `scheduler/src/fetchers/us-stock.ts` — Finnhub candles
- `scheduler/src/fetchers/crypto.ts` — Binance klines
- `scheduler/src/fetchers/fx.ts` — ExchangeRate-API + D1 accumulation
- `scheduler/test/us-stock.test.ts`
- `scheduler/test/crypto.test.ts`
- `scheduler/test/fx.test.ts`

**Modified — Scheduler:**
- `scheduler/src/index.ts` — refactor to DataFetcher pattern; add separate hourly entry point for crypto
- `scheduler/.env.example` — add `FINNHUB_API_KEY`, `EXCHANGERATE_API_KEY`

**New — Web:**
- `web/src/data/us-stocks.json` — S&P 500 stock list
- `web/src/data/crypto.ts` — top-50 crypto list
- `web/src/data/fx.ts` — 42 currency pairs (7 currencies × 6)
- `web/src/components/SubTabNav.tsx` — reusable sub-tab bar
- `web/src/components/AssetSearch.tsx` — replaces StockSearch; supports all asset types
- `web/src/components/AssetWatchlist.tsx` — generic watchlist tab
- `web/src/components/AssetSignals.tsx` — generic signals tab
- `web/src/pages/TwStocks.tsx` — Taiwan stocks page with sub-tabs
- `web/src/pages/UsStocks.tsx` — US stocks page
- `web/src/pages/Crypto.tsx` — crypto page
- `web/src/pages/Fx.tsx` — FX page

**Modified — Web:**
- `web/src/types.ts` — add `asset_type` to `WatchlistItem`
- `web/src/api/client.ts` — add `asset_type` params; add `getWatchlistItem`
- `web/src/App.tsx` — new nav + routes
- `web/src/pages/AlgorithmEditor.tsx` — back button uses `navigate(-1)`

---

## Task 1: DB Migration

**Files:**
- Create: `api/migrations/0003_asset_type.sql`

- [ ] **Step 1: Write the migration**

```sql
-- api/migrations/0003_asset_type.sql
ALTER TABLE watchlist ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'tw_stock';

CREATE TABLE IF NOT EXISTS fx_daily (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  rates_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

- [ ] **Step 2: Apply to local D1**

```bash
cd api
npx wrangler d1 execute market-pulse --local --file=migrations/0003_asset_type.sql
```

Expected: no errors, `ok` response.

- [ ] **Step 3: Commit**

```bash
git add api/migrations/0003_asset_type.sql
git commit -m "feat: add asset_type to watchlist and fx_daily table"
```

---

## Task 2: Update API Types

**Files:**
- Modify: `api/src/types.ts`

- [ ] **Step 1: Add `asset_type` to `WatchlistRow` and new `FxDailyRow`**

In `api/src/types.ts`, update `WatchlistRow` and add `FxDailyRow`:

```typescript
export interface WatchlistRow {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
  created_at: string;
}

export interface FxDailyRow {
  id: string;
  date: string;
  rates_json: string;
  created_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add api/src/types.ts
git commit -m "feat: add asset_type to WatchlistRow and FxDailyRow type"
```

---

## Task 3: Update Watchlist API Route

**Files:**
- Modify: `api/src/routes/watchlist.ts`

- [ ] **Step 1: Replace full contents of `api/src/routes/watchlist.ts`**

```typescript
import { Hono } from 'hono';
import { Env, WatchlistRow } from '../types';

export const watchlistRoutes = new Hono<{ Bindings: Env }>();

watchlistRoutes.get('/', async (c) => {
  const assetType = c.req.query('asset_type');
  const query = assetType
    ? 'SELECT * FROM watchlist WHERE asset_type = ? ORDER BY created_at DESC'
    : 'SELECT * FROM watchlist ORDER BY created_at DESC';
  const { results } = assetType
    ? await c.env.DB.prepare(query).bind(assetType).all<WatchlistRow>()
    : await c.env.DB.prepare(query).all<WatchlistRow>();
  return c.json(results);
});

watchlistRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const row = await c.env.DB.prepare('SELECT * FROM watchlist WHERE id = ?')
    .bind(id)
    .first<WatchlistRow>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

watchlistRoutes.post('/', async (c) => {
  const { symbol, name, asset_type = 'tw_stock' } = await c.req.json<{
    symbol: string;
    name: string;
    asset_type?: string;
  }>();
  if (!symbol || !name) return c.json({ error: 'symbol and name required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO watchlist (id, symbol, name, enabled, asset_type, created_at) VALUES (?, ?, ?, 1, ?, ?)'
  ).bind(id, symbol.trim(), name.trim(), asset_type, now).run();

  await c.env.DB.prepare(
    'INSERT INTO algorithms (id, watchlist_id, conditions, updated_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, '{"operator":"AND","conditions":[]}', now).run();

  return c.json({ id, symbol: symbol.trim(), name: name.trim(), enabled: 1, asset_type, created_at: now }, 201);
});

watchlistRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare('DELETE FROM watchlist WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

watchlistRoutes.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const { enabled } = await c.req.json<{ enabled: boolean }>();
  const result = await c.env.DB.prepare(
    'UPDATE watchlist SET enabled = ? WHERE id = ?'
  ).bind(enabled ? 1 : 0, id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 2: Commit**

```bash
git add api/src/routes/watchlist.ts
git commit -m "feat: filter watchlist by asset_type, add single-item GET route"
```

---

## Task 4: Update Signals Route (asset_type filter)

**Files:**
- Modify: `api/src/routes/signals.ts`

- [ ] **Step 1: Update GET handler to support `?asset_type=` filter via JOIN**

Replace the GET handler in `api/src/routes/signals.ts`:

```typescript
import { Hono } from 'hono';
import { Env, SignalRow } from '../types';

export const signalRoutes = new Hono<{ Bindings: Env }>();

signalRoutes.get('/', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const assetType = c.req.query('asset_type');

  let query: string;
  let binds: (string | number)[];

  if (assetType) {
    query = `
      SELECT s.* FROM signals s
      JOIN watchlist w ON w.id = s.watchlist_id
      WHERE w.asset_type = ?
      ORDER BY s.triggered_at DESC
      LIMIT ?
    `;
    binds = [assetType, limit];
  } else {
    query = 'SELECT * FROM signals ORDER BY triggered_at DESC LIMIT ?';
    binds = [limit];
  }

  const { results } = await c.env.DB.prepare(query).bind(...binds).all<SignalRow>();
  return c.json(results);
});

signalRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    signals: {
      watchlist_id: string;
      symbol: string;
      close_price: number;
      conditions_snapshot: unknown;
    }[];
  }>();

  if (!body.signals?.length) return c.json({ inserted: 0 });

  const now = new Date().toISOString();
  const stmts = body.signals.map((s) =>
    c.env.DB.prepare(
      'INSERT INTO signals (id, watchlist_id, symbol, triggered_at, conditions_snapshot, close_price, notified) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).bind(
      crypto.randomUUID(),
      s.watchlist_id,
      s.symbol,
      now,
      JSON.stringify(s.conditions_snapshot),
      s.close_price
    )
  );

  await c.env.DB.batch(stmts);
  return c.json({ inserted: stmts.length }, 201);
});
```

- [ ] **Step 2: Commit**

```bash
git add api/src/routes/signals.ts
git commit -m "feat: filter signals by asset_type via watchlist JOIN"
```

---

## Task 5: Add fx-daily API Route

**Files:**
- Create: `api/src/routes/fx-daily.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Create `api/src/routes/fx-daily.ts`**

```typescript
import { Hono } from 'hono';
import { Env, FxDailyRow } from '../types';

export const fxDailyRoutes = new Hono<{ Bindings: Env }>();

fxDailyRoutes.get('/', async (c) => {
  const limit = Number(c.req.query('limit') ?? 90);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM fx_daily ORDER BY date DESC LIMIT ?'
  ).bind(limit).all<FxDailyRow>();
  return c.json(results.reverse()); // oldest first for indicator calculation
});

fxDailyRoutes.post('/', async (c) => {
  const { date, rates_json } = await c.req.json<{ date: string; rates_json: string }>();
  if (!date || !rates_json) return c.json({ error: 'date and rates_json required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO fx_daily (id, date, rates_json, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET rates_json = excluded.rates_json'
  ).bind(id, date, rates_json, now).run();

  return c.json({ success: true }, 201);
});
```

- [ ] **Step 2: Register route in `api/src/index.ts`**

Add to `api/src/index.ts`:

```typescript
import { fxDailyRoutes } from './routes/fx-daily';
// ... existing imports ...

app.route('/fx-daily', fxDailyRoutes);
```

Full updated file:

```typescript
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
import { fxDailyRoutes } from './routes/fx-daily';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowHeaders: ['X-API-Key', 'Content-Type'] }));
app.use('*', apiKeyAuth);

app.route('/watchlist', watchlistRoutes);
app.route('/watchlist', algorithmRoutes);
app.route('/signals', signalRoutes);
app.route('/settings', settingsRoutes);
app.route('/recommendation-stocks', recommendationStocksRoutes);
app.route('/recommendations', recommendationsRoutes);
app.route('/fx-daily', fxDailyRoutes);

export default app;
```

- [ ] **Step 3: Commit**

```bash
git add api/src/routes/fx-daily.ts api/src/index.ts
git commit -m "feat: add fx-daily route for FX rate accumulation"
```

---

## Task 6: Scheduler DataFetcher Interface + TW Stock Fetcher

**Files:**
- Create: `scheduler/src/fetchers/types.ts`
- Create: `scheduler/src/fetchers/tw-stock.ts`

- [ ] **Step 1: Create `scheduler/src/fetchers/types.ts`**

```typescript
export interface OHLCVData {
  date: string;   // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DataFetcher {
  fetchOHLCV(symbol: string, timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]>;
}
```

- [ ] **Step 2: Create `scheduler/src/fetchers/tw-stock.ts`**

This wraps the existing `fetchNinetyDays` + `fetchHistoricalData` logic, moved from `index.ts`:

```typescript
import { fetchNinetyDays } from '../twse.js';
import { fetchHistoricalData } from '../finmind.js';
import type { DataFetcher, OHLCVData } from './types.js';

export class TwStockFetcher implements DataFetcher {
  constructor(private readonly finmindToken?: string) {}

  async fetchOHLCV(symbol: string, _timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    let ohlcv = await fetchNinetyDays(symbol);
    if (ohlcv.length < 65) {
      const d = new Date();
      d.setMonth(d.getMonth() - 4);
      const startDate = d.toISOString().split('T')[0];
      ohlcv = await fetchHistoricalData(symbol, startDate, this.finmindToken);
    }
    return ohlcv;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add scheduler/src/fetchers/types.ts scheduler/src/fetchers/tw-stock.ts
git commit -m "feat: add DataFetcher interface and TwStockFetcher"
```

---

## Task 7: US Stock Fetcher (Finnhub)

**Files:**
- Create: `scheduler/src/fetchers/us-stock.ts`
- Create: `scheduler/test/us-stock.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// scheduler/test/us-stock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { UsStockFetcher } from '../src/fetchers/us-stock.js';

const mockGet = vi.mocked(axios.get);

describe('UsStockFetcher', () => {
  beforeEach(() => mockGet.mockReset());

  it('maps Finnhub candle response to OHLCVData', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        s: 'ok',
        t: [1704067200, 1704153600],
        o: [180.0, 183.0],
        h: [185.0, 186.0],
        l: [178.0, 181.0],
        c: [183.5, 185.2],
        v: [50000000, 45000000],
      },
    });
    const fetcher = new UsStockFetcher('test-key');
    const result = await fetcher.fetchOHLCV('AAPL', 'daily');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ open: 180.0, high: 185.0, low: 178.0, close: 183.5, volume: 50000000 });
  });

  it('returns empty array when Finnhub returns no_data', async () => {
    mockGet.mockResolvedValueOnce({ data: { s: 'no_data' } });
    const fetcher = new UsStockFetcher('test-key');
    const result = await fetcher.fetchOHLCV('INVALID', 'daily');
    expect(result).toHaveLength(0);
  });

  it('returns empty array on API error', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const fetcher = new UsStockFetcher('test-key');
    const result = await fetcher.fetchOHLCV('AAPL', 'daily');
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd scheduler && npx vitest run test/us-stock.test.ts
```

Expected: FAIL — `Cannot find module '../src/fetchers/us-stock.js'`

- [ ] **Step 3: Implement `scheduler/src/fetchers/us-stock.ts`**

```typescript
import axios from 'axios';
import type { DataFetcher, OHLCVData } from './types.js';

export class UsStockFetcher implements DataFetcher {
  constructor(private readonly apiKey: string) {}

  async fetchOHLCV(symbol: string, timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    const resolution = timeframe === 'hourly' ? '60' : 'D';
    const to = Math.floor(Date.now() / 1000);
    // daily: ~120 trading days; hourly: 7 days
    const from = to - (timeframe === 'hourly' ? 7 * 24 * 3600 : 120 * 24 * 3600);

    try {
      const { data } = await axios.get('https://finnhub.io/api/v1/stock/candle', {
        params: { symbol, resolution, from, to, token: this.apiKey },
        timeout: 15000,
      });

      if (data.s !== 'ok' || !Array.isArray(data.c)) return [];

      return (data.t as number[]).map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i],
      }));
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd scheduler && npx vitest run test/us-stock.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scheduler/src/fetchers/us-stock.ts scheduler/test/us-stock.test.ts
git commit -m "feat: add UsStockFetcher using Finnhub API"
```

---

## Task 8: Crypto Fetcher (Binance)

**Files:**
- Create: `scheduler/src/fetchers/crypto.ts`
- Create: `scheduler/test/crypto.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// scheduler/test/crypto.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { CryptoFetcher } from '../src/fetchers/crypto.js';

const mockGet = vi.mocked(axios.get);

describe('CryptoFetcher', () => {
  beforeEach(() => mockGet.mockReset());

  it('maps Binance klines response to OHLCVData', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        ['1704067200000', '42000.0', '43000.0', '41500.0', '42800.0', '1234.5', '1704153599999', '0', '0', '0', '0', '0'],
        ['1704153600000', '42800.0', '44000.0', '42600.0', '43500.0', '987.3', '1704239999999', '0', '0', '0', '0', '0'],
      ],
    });
    const fetcher = new CryptoFetcher();
    const result = await fetcher.fetchOHLCV('BTCUSDT', 'daily');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ open: 42000.0, high: 43000.0, low: 41500.0, close: 42800.0, volume: 1234.5 });
  });

  it('uses 1h interval for hourly timeframe', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const fetcher = new CryptoFetcher();
    await fetcher.fetchOHLCV('ETHUSDT', 'hourly');
    expect(mockGet).toHaveBeenCalledWith(
      'https://api.binance.com/api/v3/klines',
      expect.objectContaining({ params: expect.objectContaining({ interval: '1h' }) })
    );
  });

  it('uses 1d interval for daily timeframe', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const fetcher = new CryptoFetcher();
    await fetcher.fetchOHLCV('BTCUSDT', 'daily');
    expect(mockGet).toHaveBeenCalledWith(
      'https://api.binance.com/api/v3/klines',
      expect.objectContaining({ params: expect.objectContaining({ interval: '1d' }) })
    );
  });

  it('returns empty array on error', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const fetcher = new CryptoFetcher();
    const result = await fetcher.fetchOHLCV('BTCUSDT', 'hourly');
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd scheduler && npx vitest run test/crypto.test.ts
```

Expected: FAIL — `Cannot find module '../src/fetchers/crypto.js'`

- [ ] **Step 3: Implement `scheduler/src/fetchers/crypto.ts`**

```typescript
import axios from 'axios';
import type { DataFetcher, OHLCVData } from './types.js';

export class CryptoFetcher implements DataFetcher {
  async fetchOHLCV(symbol: string, timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    const interval = timeframe === 'hourly' ? '1h' : '1d';
    const limit = timeframe === 'hourly' ? 168 : 120; // 7 days hourly or 4 months daily

    try {
      const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit },
        timeout: 15000,
      });

      return (data as string[][]).map((k) => ({
        date: new Date(Number(k[0])).toISOString().split('T')[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd scheduler && npx vitest run test/crypto.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scheduler/src/fetchers/crypto.ts scheduler/test/crypto.test.ts
git commit -m "feat: add CryptoFetcher using Binance API"
```

---

## Task 9: FX Fetcher (ExchangeRate-API + D1)

**Files:**
- Create: `scheduler/src/fetchers/fx.ts`
- Create: `scheduler/test/fx.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// scheduler/test/fx.test.ts
import { describe, it, expect } from 'vitest';
import { computeCrossRate, rateRowsToOHLCV } from '../src/fetchers/fx.js';

describe('computeCrossRate', () => {
  const rates = { EUR: 0.92, GBP: 0.79, TWD: 32.1, JPY: 149.5, AUD: 1.53, CHF: 0.88 };

  it('USD/TWD = direct rate', () => {
    expect(computeCrossRate(rates, 'USD', 'TWD')).toBeCloseTo(32.1);
  });

  it('TWD/USD = inverse', () => {
    expect(computeCrossRate(rates, 'TWD', 'USD')).toBeCloseTo(1 / 32.1);
  });

  it('EUR/TWD = TWD_rate / EUR_rate', () => {
    expect(computeCrossRate(rates, 'EUR', 'TWD')).toBeCloseTo(32.1 / 0.92);
  });

  it('JPY/TWD = TWD_rate / JPY_rate', () => {
    expect(computeCrossRate(rates, 'JPY', 'TWD')).toBeCloseTo(32.1 / 149.5);
  });
});

describe('rateRowsToOHLCV', () => {
  it('converts fx_daily rows to OHLCVData for a pair', () => {
    const rows = [
      { date: '2026-01-01', rates_json: JSON.stringify({ EUR: 0.92, TWD: 32.1 }) },
      { date: '2026-01-02', rates_json: JSON.stringify({ EUR: 0.93, TWD: 32.3 }) },
    ];
    const result = rateRowsToOHLCV(rows, 'USD', 'TWD');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ date: '2026-01-01', open: 32.1, high: 32.1, low: 32.1, close: 32.1, volume: 0 });
    expect(result[1].close).toBeCloseTo(32.3);
  });

  it('filters out rows where rate cannot be computed (missing currency)', () => {
    const rows = [
      { date: '2026-01-01', rates_json: JSON.stringify({ EUR: 0.92 }) }, // no TWD
    ];
    const result = rateRowsToOHLCV(rows, 'USD', 'TWD');
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd scheduler && npx vitest run test/fx.test.ts
```

Expected: FAIL — `Cannot find module '../src/fetchers/fx.js'`

- [ ] **Step 3: Implement `scheduler/src/fetchers/fx.ts`**

```typescript
import axios, { type AxiosInstance } from 'axios';
import type { DataFetcher, OHLCVData } from './types.js';

const TRACKED_CURRENCIES = ['EUR', 'GBP', 'TWD', 'JPY', 'AUD', 'CHF'];

export function computeCrossRate(rates: Record<string, number>, base: string, quote: string): number {
  if (base === 'USD') return rates[quote] ?? 0;
  if (quote === 'USD') return rates[base] ? 1 / rates[base] : 0;
  return (rates[quote] ?? 0) / (rates[base] ?? 1);
}

export function rateRowsToOHLCV(
  rows: { date: string; rates_json: string }[],
  base: string,
  quote: string
): OHLCVData[] {
  return rows
    .map((row) => {
      const rates = JSON.parse(row.rates_json) as Record<string, number>;
      const rate = computeCrossRate(rates, base, quote);
      if (!rate) return null;
      return { date: row.date, open: rate, high: rate, low: rate, close: rate, volume: 0 };
    })
    .filter((r): r is OHLCVData => r !== null);
}

export class FxFetcher implements DataFetcher {
  constructor(
    private readonly apiKey: string,
    private readonly internalApi: AxiosInstance,
  ) {}

  async fetchOHLCV(symbol: string, _timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    const [base, quote] = symbol.split('/');
    if (!base || !quote) return [];

    await this.ensureTodayStored();

    const { data: rows } = await this.internalApi.get<{ date: string; rates_json: string }[]>(
      '/fx-daily',
      { params: { limit: 90 } }
    );

    return rateRowsToOHLCV(rows, base, quote);
  }

  private async ensureTodayStored(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await axios.get(
        `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest/USD`,
        { timeout: 10000 }
      );
      if (data.result !== 'success') return;

      const rates: Record<string, number> = {};
      for (const currency of TRACKED_CURRENCIES) {
        if (data.conversion_rates[currency]) {
          rates[currency] = data.conversion_rates[currency];
        }
      }

      await this.internalApi.post('/fx-daily', {
        date: today,
        rates_json: JSON.stringify(rates),
      });
    } catch {
      // If today already stored or API down, continue with existing data
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd scheduler && npx vitest run test/fx.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add scheduler/src/fetchers/fx.ts scheduler/test/fx.test.ts
git commit -m "feat: add FxFetcher with D1 accumulation and cross-rate computation"
```

---

## Task 10: Refactor Scheduler Orchestration

**Files:**
- Modify: `scheduler/src/index.ts`
- Modify: `scheduler/.env.example`

- [ ] **Step 1: Update `scheduler/.env.example`**

```
WORKERS_API_URL=http://localhost:8787
WORKERS_API_KEY=dev-secret-key-change-in-prod
RESEND_API_KEY=
FINMIND_TOKEN=
FINNHUB_API_KEY=
EXCHANGERATE_API_KEY=
```

- [ ] **Step 2: Replace `scheduler/src/index.ts`**

```typescript
import axios from 'axios';
import { calculateIndicators } from './indicators.js';
import { evaluateConditionTree } from './evaluator.js';
import { sendSignalEmail } from './notify.js';
import { BUILT_IN_STRATEGIES } from './strategies.js';
import { TwStockFetcher } from './fetchers/tw-stock.js';
import { UsStockFetcher } from './fetchers/us-stock.js';
import { CryptoFetcher } from './fetchers/crypto.js';
import { FxFetcher } from './fetchers/fx.js';
import type { DataFetcher } from './fetchers/types.js';
import type { ConditionTree } from './types.js';

const API_URL = process.env.WORKERS_API_URL!;
const API_KEY = process.env.WORKERS_API_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FINMIND_TOKEN = process.env.FINMIND_TOKEN ?? '';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? '';
const EXCHANGERATE_API_KEY = process.env.EXCHANGERATE_API_KEY ?? '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'X-API-Key': API_KEY },
});

function getFetcher(assetType: string): DataFetcher {
  switch (assetType) {
    case 'us_stock': return new UsStockFetcher(FINNHUB_API_KEY);
    case 'crypto':   return new CryptoFetcher();
    case 'fx':       return new FxFetcher(EXCHANGERATE_API_KEY, api);
    default:         return new TwStockFetcher(FINMIND_TOKEN || undefined);
  }
}

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
}

interface AlgorithmResponse {
  conditions: ConditionTree;
}

async function runWatchlistScan(assetType: string, timeframe: 'daily' | 'hourly') {
  const today = new Date().toISOString().split('T')[0];
  const { data: settings } = await api.get<Record<string, string>>('/settings');
  if (settings.schedule_enabled !== '1') return;

  const notifyEmail = settings.notify_email;
  if (!notifyEmail) return;

  const { data: watchlist } = await api.get<WatchlistItem[]>('/watchlist', {
    params: { asset_type: assetType },
  });
  const enabled = watchlist.filter((w) => w.enabled === 1);
  console.log(`[${assetType}] Processing ${enabled.length} items...`);

  const fetcher = getFetcher(assetType);
  const triggeredSignals: { watchlist_id: string; symbol: string; close_price: number; conditions_snapshot: unknown; name: string }[] = [];

  for (const item of enabled) {
    try {
      const { data: algo } = await api.get<AlgorithmResponse>(`/watchlist/${item.id}/algorithm`);
      if (!algo.conditions?.conditions?.length) continue;

      const ohlcv = await fetcher.fetchOHLCV(item.symbol, timeframe);
      if (ohlcv.length < 20) {
        console.log(`${item.symbol}: insufficient data (${ohlcv.length}), skipping`);
        continue;
      }

      const indicators = calculateIndicators(ohlcv);
      if (!evaluateConditionTree(algo.conditions, indicators)) continue;

      const closePrice = ohlcv[ohlcv.length - 1].close;
      console.log(`✅ ${item.symbol} ${item.name}: triggered (close=${closePrice})`);
      triggeredSignals.push({ watchlist_id: item.id, symbol: item.symbol, close_price: closePrice, conditions_snapshot: algo.conditions, name: item.name });
    } catch (err) {
      console.error(`Error processing ${item.symbol}:`, err);
    }
  }

  if (triggeredSignals.length > 0) {
    await api.post('/signals', { signals: triggeredSignals.map(({ name: _n, ...s }) => s) });
    await sendSignalEmail(RESEND_API_KEY, notifyEmail, today,
      triggeredSignals.map((s) => ({ symbol: s.symbol, name: s.name, closePrice: s.close_price, triggeredConditions: ['條件符合'] }))
    );
  }
}

async function runTwRecommendationScan() {
  const today = new Date().toISOString().split('T')[0];
  const { data: stockPool } = await api.get<{ symbol: string; name: string }[]>('/recommendation-stocks');
  console.log(`Scanning ${stockPool.length} recommendation stocks...`);

  const fetcher = new TwStockFetcher(FINMIND_TOKEN || undefined);
  const hits: { symbol: string; name: string; close_price: number; strategies: string[] }[] = [];

  for (const stock of stockPool) {
    try {
      const ohlcv = await fetcher.fetchOHLCV(stock.symbol, 'daily');
      if (ohlcv.length < 30) continue;
      const indicators = calculateIndicators(ohlcv);
      const triggered = BUILT_IN_STRATEGIES
        .filter((s) => evaluateConditionTree(s.conditions, indicators))
        .map((s) => s.name);
      if (triggered.length > 0) {
        hits.push({ symbol: stock.symbol, name: stock.name, close_price: ohlcv[ohlcv.length - 1].close, strategies: triggered });
      }
    } catch (err) {
      console.error(`Recommendation scan error for ${stock.symbol}:`, err);
    }
  }

  await api.post('/recommendations', { date: today, items: hits });
  console.log(`📊 Wrote ${hits.length} recommendations`);
}

// Entry point: daily scan (TW stocks + US stocks + FX)
async function runDaily() {
  console.log('=== Daily scan ===');
  await runWatchlistScan('tw_stock', 'daily');
  await runWatchlistScan('us_stock', 'daily');
  await runWatchlistScan('fx', 'daily');
  await runTwRecommendationScan();
}

// Entry point: hourly scan (crypto only)
async function runHourly() {
  console.log('=== Hourly crypto scan ===');
  await runWatchlistScan('crypto', 'hourly');
}

const mode = process.argv[2] ?? 'daily';
const fn = mode === 'hourly' ? runHourly : runDaily;

fn().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

Update `package.json` scripts to expose both entry points:

```json
{
  "scripts": {
    "start": "node --env-file=.env --import tsx/esm src/index.ts daily",
    "start:hourly": "node --env-file=.env --import tsx/esm src/index.ts hourly",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Run all tests**

```bash
cd scheduler && npx vitest run
```

Expected: all tests pass (existing + new fetcher tests).

- [ ] **Step 4: Commit**

```bash
git add scheduler/src/index.ts scheduler/.env.example scheduler/package.json
git commit -m "feat: refactor scheduler to DataFetcher pattern, add hourly crypto entry point"
```

---

## Task 11: Frontend Static Data Files

**Files:**
- Create: `web/src/data/us-stocks.json`
- Create: `web/src/data/crypto.ts`
- Create: `web/src/data/fx.ts`

- [ ] **Step 1: Fetch and save S&P 500 stock list**

Run this from the project root to generate the file:

```bash
curl -s "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv" \
  | node -e "
const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\n');
const stocks = lines.slice(1).map(line => {
  const cols = line.split(',');
  return { symbol: cols[0].replace(/\"/g,'').trim(), name: cols[1].replace(/\"/g,'').trim() };
}).filter(s => s.symbol && s.name);
process.stdout.write(JSON.stringify(stocks, null, 2));
" > web/src/data/us-stocks.json
```

Verify it generated correctly:

```bash
node -e "const d = require('./web/src/data/us-stocks.json'); console.log(d.length, d[0])"
```

Expected: ~503 `{ symbol: 'MMM', name: '3M' }` (or similar first entry).

- [ ] **Step 2: Create `web/src/data/crypto.ts`**

```typescript
export interface CryptoAsset {
  symbol: string; // Binance pair, e.g. BTCUSDT
  name: string;
}

export const CRYPTO_LIST: CryptoAsset[] = [
  { symbol: 'BTCUSDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', name: 'Ethereum' },
  { symbol: 'BNBUSDT', name: 'BNB' },
  { symbol: 'SOLUSDT', name: 'Solana' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'USDCUSDT', name: 'USD Coin' },
  { symbol: 'ADAUSDT', name: 'Cardano' },
  { symbol: 'AVAXUSDT', name: 'Avalanche' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin' },
  { symbol: 'DOTUSDT', name: 'Polkadot' },
  { symbol: 'TRXUSDT', name: 'TRON' },
  { symbol: 'LINKUSDT', name: 'Chainlink' },
  { symbol: 'TONUSDT', name: 'Toncoin' },
  { symbol: 'MATICUSDT', name: 'Polygon' },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu' },
  { symbol: 'LTCUSDT', name: 'Litecoin' },
  { symbol: 'BCHUSDT', name: 'Bitcoin Cash' },
  { symbol: 'ICPUSDT', name: 'Internet Computer' },
  { symbol: 'UNIUSDT', name: 'Uniswap' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol' },
  { symbol: 'APTUSDT', name: 'Aptos' },
  { symbol: 'XLMUSDT', name: 'Stellar' },
  { symbol: 'ATOMUSDT', name: 'Cosmos' },
  { symbol: 'ETCUSDT', name: 'Ethereum Classic' },
  { symbol: 'FILUSDT', name: 'Filecoin' },
  { symbol: 'ALGOUSDT', name: 'Algorand' },
  { symbol: 'VETUSDT', name: 'VeChain' },
  { symbol: 'MKRUSDT', name: 'Maker' },
  { symbol: 'AAVEUSDT', name: 'Aave' },
  { symbol: 'ARBUSDT', name: 'Arbitrum' },
  { symbol: 'OPUSDT', name: 'Optimism' },
  { symbol: 'SUIUSDT', name: 'Sui' },
  { symbol: 'SEIUSDT', name: 'Sei' },
  { symbol: 'INJUSDT', name: 'Injective' },
  { symbol: 'LDOUSDT', name: 'Lido DAO' },
  { symbol: 'RUNEUSDT', name: 'THORChain' },
  { symbol: 'FTMUSDT', name: 'Fantom' },
  { symbol: 'SANDUSDT', name: 'The Sandbox' },
  { symbol: 'MANAUSDT', name: 'Decentraland' },
  { symbol: 'AXSUSDT', name: 'Axie Infinity' },
  { symbol: 'GRTUSDT', name: 'The Graph' },
  { symbol: 'APEUSDT', name: 'ApeCoin' },
  { symbol: 'GMXUSDT', name: 'GMX' },
  { symbol: 'SNXUSDT', name: 'Synthetix' },
  { symbol: 'COMPUSDT', name: 'Compound' },
  { symbol: 'ENSUSDT', name: 'Ethereum Name Service' },
  { symbol: 'ZECUSDT', name: 'Zcash' },
  { symbol: 'DASHUSDT', name: 'Dash' },
  { symbol: 'XMRUSDT', name: 'Monero' },
  { symbol: 'WBTCUSDT', name: 'Wrapped Bitcoin' },
];
```

- [ ] **Step 3: Create `web/src/data/fx.ts`**

```typescript
export interface FxPair {
  symbol: string; // e.g. 'USD/TWD'
  name: string;   // e.g. 'US Dollar / New Taiwan Dollar'
}

const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'TWD', name: 'New Taiwan Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
];

export const FX_PAIRS: FxPair[] = CURRENCIES.flatMap((base) =>
  CURRENCIES
    .filter((quote) => quote.code !== base.code)
    .map((quote) => ({
      symbol: `${base.code}/${quote.code}`,
      name: `${base.name} / ${quote.name}`,
    }))
);
```

- [ ] **Step 4: Commit**

```bash
git add web/src/data/us-stocks.json web/src/data/crypto.ts web/src/data/fx.ts
git commit -m "feat: add static data files for US stocks, crypto, and FX pairs"
```

---

## Task 12: SubTabNav Component

**Files:**
- Create: `web/src/components/SubTabNav.tsx`

- [ ] **Step 1: Create `web/src/components/SubTabNav.tsx`**

```typescript
import { NavLink } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
}

interface Props {
  tabs: Tab[];
}

export function SubTabNav({ tabs }: Props) {
  return (
    <div style={{
      display: 'flex', borderBottom: '1px solid #e2e8f0',
      marginBottom: '20px', gap: '4px',
    }}>
      {tabs.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          style={({ isActive }) => ({
            padding: '8px 16px',
            fontSize: '13px',
            textDecoration: 'none',
            color: isActive ? '#6366f1' : '#64748b',
            fontWeight: isActive ? 600 : 400,
            borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
            marginBottom: '-1px',
            transition: 'color 0.15s',
          })}
        >
          {label}
        </NavLink>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/SubTabNav.tsx
git commit -m "feat: add SubTabNav reusable sub-tab navigation component"
```

---

## Task 13: AssetSearch Component

**Files:**
- Create: `web/src/components/AssetSearch.tsx`

- [ ] **Step 1: Create `web/src/components/AssetSearch.tsx`**

```typescript
import { useState, useRef, useEffect } from 'react';
import stocksData from '../data/stocks.json';
import usStocksData from '../data/us-stocks.json';
import { CRYPTO_LIST } from '../data/crypto';
import { FX_PAIRS } from '../data/fx';

type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

interface Asset {
  symbol: string;
  name: string;
}

interface Props {
  assetType: AssetType;
  onSelect: (symbol: string, name: string) => void;
}

const PLACEHOLDER: Record<AssetType, string> = {
  tw_stock: '輸入代號或名稱（如 2330 或 台積）',
  us_stock: '輸入代號或公司名稱（如 AAPL 或 Apple）',
  crypto: '輸入幣種（如 BTC 或 Bitcoin）',
  fx: '輸入貨幣對（如 USD/TWD）',
};

function getAssets(assetType: AssetType): Asset[] {
  switch (assetType) {
    case 'tw_stock': return stocksData as Asset[];
    case 'us_stock': return usStocksData as Asset[];
    case 'crypto':   return CRYPTO_LIST.map(({ symbol, name }) => ({ symbol, name }));
    case 'fx':       return FX_PAIRS.map(({ symbol, name }) => ({ symbol, name }));
  }
}

function filterAssets(assets: Asset[], query: string): Asset[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return assets
    .filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    .slice(0, 8);
}

export function AssetSearch({ assetType, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const assets = getAssets(assetType);

  useEffect(() => {
    setResults(filterAssets(assets, query));
    setActiveIndex(-1);
  }, [query, assetType]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(asset: Asset) {
    onSelect(asset.symbol, asset.name);
    setQuery('');
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setResults([]);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#f8fafc', border: '1.5px solid #6366f1',
        borderRadius: '8px', padding: '9px 12px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER[assetType]}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: '13px', color: '#1e293b', width: '100%',
          }}
        />
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden',
        }}>
          <div style={{
            padding: '6px 12px', fontSize: '10px', color: '#94a3b8',
            background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
            letterSpacing: '0.05em', fontWeight: 600,
          }}>
            搜尋結果
          </div>
          {results.map((asset, i) => (
            <div
              key={asset.symbol}
              onMouseDown={() => handleSelect(asset)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '10px 12px', display: 'flex', alignItems: 'center',
                gap: '12px', cursor: 'pointer',
                background: i === activeIndex ? '#eff6ff' : '#fff',
                borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '13px', minWidth: '60px' }}>
                {asset.symbol}
              </span>
              <span style={{ color: '#1e293b', fontSize: '13px' }}>{asset.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/AssetSearch.tsx
git commit -m "feat: add AssetSearch component supporting all asset types"
```

---

## Task 14: AssetWatchlist and AssetSignals Components

**Files:**
- Create: `web/src/components/AssetWatchlist.tsx`
- Create: `web/src/components/AssetSignals.tsx`

- [ ] **Step 1: Create `web/src/components/AssetWatchlist.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AssetSearch } from './AssetSearch';
import type { WatchlistItem } from '../types';

type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

interface Props {
  assetType: AssetType;
  label: string;       // displayed in "新增X" button
  description: string; // subtitle
}

export function AssetWatchlist({ assetType, label, description }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist(assetType).then(setItems).catch(console.error);
  }, [assetType]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addAsset(selected.symbol, selected.name, assetType);
      setItems((prev) => [item, ...prev]);
      setSelected(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    await api.deleteStock(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleToggle(item: WatchlistItem) {
    await api.toggleStock(item.id, item.enabled === 0);
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, enabled: i.enabled === 1 ? 0 : 1 } : i)
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>追蹤清單</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{description}</p>
      </div>

      <div style={{
        background: '#fff', borderRadius: '12px', padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>新增{label}</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <AssetSearch assetType={assetType} onSelect={(symbol, name) => setSelected({ symbol, name })} />
          {selected && (
            <span style={{
              alignSelf: 'center', fontSize: '12px', color: '#6366f1',
              background: '#eff6ff', padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
            }}>
              {selected.symbol} {selected.name}
            </span>
          )}
          <button
            type="submit"
            disabled={!selected}
            style={{
              background: selected ? '#6366f1' : '#e2e8f0',
              color: selected ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              fontSize: '13px', fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}
          >
            新增
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{error}</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px',
            border: '1px solid #e2e8f0',
          }}>
            還沒有追蹤的項目，從上方搜尋新增吧
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff', borderRadius: '12px', padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: '16px',
              opacity: item.enabled ? 1 : 0.6, transition: 'opacity 0.15s',
            }}
          >
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: item.enabled ? '#10b981' : '#d1d5db',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{item.symbol}</span>
                <span style={{ color: '#475569', fontSize: '14px' }}>{item.name}</span>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: 500,
                  background: item.enabled ? '#dcfce7' : '#f1f5f9',
                  color: item.enabled ? '#166534' : '#64748b',
                }}>
                  {item.enabled ? '追蹤中' : '已暫停'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                設定算法
              </button>
              <button
                onClick={() => handleToggle(item)}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                {item.enabled ? '暫停' : '啟用'}
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                style={{ background: '#fff0f0', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/src/components/AssetSignals.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Signal } from '../types';

type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

interface Props {
  assetType: AssetType;
}

export function AssetSignals({ assetType }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(100, assetType).then(setSignals).catch(console.error);
  }, [assetType]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>訊號歷史</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>系統觸發過的買賣訊號紀錄</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {signals.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px',
            border: '1px solid #e2e8f0',
          }}>
            目前沒有觸發訊號
          </div>
        ) : signals.map((s) => (
          <div key={s.id} style={{
            background: '#fff', borderRadius: '12px', padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{s.symbol}</span>
                <span style={{
                  fontSize: '11px', background: '#dcfce7', color: '#166534',
                  padding: '2px 8px', borderRadius: '99px', fontWeight: 500,
                }}>觸發</span>
                {s.notified ? <span style={{ fontSize: '11px', color: '#10b981' }}>✓ 已通知</span> : null}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                收盤價 {s.close_price} ・ {new Date(s.triggered_at).toLocaleString('zh-TW')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssetWatchlist.tsx web/src/components/AssetSignals.tsx
git commit -m "feat: add generic AssetWatchlist and AssetSignals components"
```

---

## Task 15: Update Web Types and API Client

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Add `asset_type` to `WatchlistItem` in `web/src/types.ts`**

```typescript
export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
  created_at: string;
}
```

(All other types remain unchanged.)

- [ ] **Step 2: Update `web/src/api/client.ts`**

```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  getWatchlist: (assetType?: string) => {
    const qs = assetType ? `?asset_type=${assetType}` : '';
    return request<import('../types').WatchlistItem[]>(`/watchlist${qs}`);
  },
  getWatchlistItem: (id: string) =>
    request<import('../types').WatchlistItem>(`/watchlist/${id}`),
  addAsset: (symbol: string, name: string, assetType: string) =>
    request<import('../types').WatchlistItem>('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol, name, asset_type: assetType }),
    }),
  addStock: (symbol: string, name: string) =>
    request<import('../types').WatchlistItem>('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol, name, asset_type: 'tw_stock' }),
    }),
  deleteStock: (id: string) => request<{ success: boolean }>(`/watchlist/${id}`, { method: 'DELETE' }),
  toggleStock: (id: string, enabled: boolean) =>
    request<{ success: boolean }>(`/watchlist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  getAlgorithm: (id: string) => request<import('../types').Algorithm>(`/watchlist/${id}/algorithm`),
  saveAlgorithm: (id: string, conditions: import('../types').ConditionTree) =>
    request<{ success: boolean }>(`/watchlist/${id}/algorithm`, {
      method: 'PUT',
      body: JSON.stringify({ conditions }),
    }),
  getSignals: (limit = 50, assetType?: string) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (assetType) qs.set('asset_type', assetType);
    return request<import('../types').Signal[]>(`/signals?${qs}`);
  },
  getSettings: () => request<Record<string, string>>('/settings'),
  saveSettings: (updates: Record<string, string>) =>
    request<{ success: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(updates) }),
  getRecommendations: () => request<import('../types').RecommendationsResponse>('/recommendations'),
  getRecommendationStocks: () => request<import('../types').RecommendationStock[]>('/recommendation-stocks'),
  addRecommendationStock: (symbol: string, name: string) =>
    request<import('../types').RecommendationStock>('/recommendation-stocks', {
      method: 'POST',
      body: JSON.stringify({ symbol, name }),
    }),
  deleteRecommendationStock: (symbol: string) =>
    request<{ success: boolean }>(`/recommendation-stocks/${symbol}`, { method: 'DELETE' }),
};
```

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts web/src/api/client.ts
git commit -m "feat: add asset_type to WatchlistItem, update API client with asset_type params"
```

---

## Task 16: New Asset Pages

**Files:**
- Create: `web/src/pages/TwStocks.tsx`
- Create: `web/src/pages/UsStocks.tsx`
- Create: `web/src/pages/Crypto.tsx`
- Create: `web/src/pages/Fx.tsx`
- Modify: `web/src/pages/AlgorithmEditor.tsx` — back button uses `navigate(-1)`

- [ ] **Step 1: Create `web/src/pages/TwStocks.tsx`**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { AssetWatchlist } from '../components/AssetWatchlist';
import { AssetSignals } from '../components/AssetSignals';
import { Recommendations } from './Recommendations';

const TABS = [
  { to: '/tw-stocks', label: '追蹤清單' },
  { to: '/tw-stocks/recommendations', label: '推薦' },
  { to: '/tw-stocks/signals', label: '訊號歷史' },
];

export function TwStocks() {
  return (
    <div>
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>台股</h1>
      </div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={
          <AssetWatchlist assetType="tw_stock" label="股票" description="管理你想追蹤的台灣股票" />
        } />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="signals" element={<AssetSignals assetType="tw_stock" />} />
        <Route path="*" element={<Navigate to="/tw-stocks" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/src/pages/UsStocks.tsx`**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { AssetWatchlist } from '../components/AssetWatchlist';
import { AssetSignals } from '../components/AssetSignals';

const TABS = [
  { to: '/us-stocks', label: '追蹤清單' },
  { to: '/us-stocks/signals', label: '訊號歷史' },
];

export function UsStocks() {
  return (
    <div>
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>美股</h1>
      </div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={
          <AssetWatchlist assetType="us_stock" label="美股" description="管理你想追蹤的美國股票（S&P 500）" />
        } />
        <Route path="signals" element={<AssetSignals assetType="us_stock" />} />
        <Route path="*" element={<Navigate to="/us-stocks" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 3: Create `web/src/pages/Crypto.tsx`**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { AssetWatchlist } from '../components/AssetWatchlist';
import { AssetSignals } from '../components/AssetSignals';

const TABS = [
  { to: '/crypto', label: '追蹤清單' },
  { to: '/crypto/signals', label: '訊號歷史' },
];

export function Crypto() {
  return (
    <div>
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>加密貨幣</h1>
      </div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={
          <AssetWatchlist assetType="crypto" label="幣種" description="追蹤主流加密貨幣（每小時掃描）" />
        } />
        <Route path="signals" element={<AssetSignals assetType="crypto" />} />
        <Route path="*" element={<Navigate to="/crypto" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 4: Create `web/src/pages/Fx.tsx`**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { AssetWatchlist } from '../components/AssetWatchlist';
import { AssetSignals } from '../components/AssetSignals';

const TABS = [
  { to: '/fx', label: '追蹤清單' },
  { to: '/fx/signals', label: '訊號歷史' },
];

export function Fx() {
  return (
    <div>
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>匯率</h1>
      </div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={
          <AssetWatchlist assetType="fx" label="貨幣對" description="追蹤各國匯率（USD、EUR、GBP、TWD、JPY、AUD、CHF）" />
        } />
        <Route path="signals" element={<AssetSignals assetType="fx" />} />
        <Route path="*" element={<Navigate to="/fx" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 5: Update back button in `web/src/pages/AlgorithmEditor.tsx`**

On line 47, change:
```typescript
onClick={() => navigate('/watchlist')}
```
to:
```typescript
onClick={() => navigate(-1)}
```

Also update the call on line 22 from `api.getWatchlist()` to `api.getWatchlistItem(id!)`:

```typescript
// Replace line 22 in AlgorithmEditor.tsx:
api.getWatchlistItem(id!).then(setStock);
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/TwStocks.tsx web/src/pages/UsStocks.tsx \
        web/src/pages/Crypto.tsx web/src/pages/Fx.tsx \
        web/src/pages/AlgorithmEditor.tsx
git commit -m "feat: add TwStocks, UsStocks, Crypto, Fx pages with sub-tab navigation"
```

---

## Task 17: Update App.tsx (Nav + Routes)

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Replace full contents of `web/src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { TwStocks } from './pages/TwStocks';
import { UsStocks } from './pages/UsStocks';
import { Crypto } from './pages/Crypto';
import { Fx } from './pages/Fx';
import { AlgorithmEditor } from './pages/AlgorithmEditor';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <nav style={{
          display: 'flex', alignItems: 'center', background: '#fff',
          borderBottom: '1px solid #e2e8f0', padding: '0 24px',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontWeight: 800, color: '#6366f1', fontSize: '15px', marginRight: '32px', padding: '14px 0' }}>
            Market Pulse
          </span>
          {[
            { to: '/', label: '首頁', exact: true },
            { to: '/tw-stocks', label: '台股', exact: false },
            { to: '/us-stocks', label: '美股', exact: false },
            { to: '/crypto', label: '加密貨幣', exact: false },
            { to: '/fx', label: '匯率', exact: false },
            { to: '/settings', label: '設定', exact: false },
          ].map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                padding: '14px 16px',
                fontSize: '13px',
                textDecoration: 'none',
                color: isActive ? '#6366f1' : '#94a3b8',
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'color 0.15s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tw-stocks/*" element={<TwStocks />} />
            <Route path="/us-stocks/*" element={<UsStocks />} />
            <Route path="/crypto/*" element={<Crypto />} />
            <Route path="/fx/*" element={<Fx />} />
            <Route path="/watchlist/:id/algorithm" element={<AlgorithmEditor />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Start dev server and verify**

```bash
cd web && npm run dev
```

Open http://localhost:5173 and verify:
- Top nav shows: 首頁 | 台股 | 美股 | 加密貨幣 | 匯率 | 設定
- 台股 page shows sub-tabs: 追蹤清單 | 推薦 | 訊號歷史
- 美股 page shows sub-tabs: 追蹤清單 | 訊號歷史
- Adding a US stock (e.g. AAPL) works and shows in the list
- Adding a crypto pair (e.g. BTCUSDT) works
- Adding an FX pair (e.g. USD/TWD) works
- AlgorithmEditor back button navigates correctly (navigate -1)
- TypeScript build passes: `npm run build` shows no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: update App nav and routes for multi-asset pages"
```

---

## Task 18: Register API keys

- [ ] **Step 1: Get Finnhub API key**

Go to https://finnhub.io → Sign up → copy API key → add to `scheduler/.env`:

```
FINNHUB_API_KEY=your_key_here
```

- [ ] **Step 2: Get ExchangeRate-API key**

Go to https://www.exchangerate-api.com → Sign up (free, no credit card) → copy API key → add to `scheduler/.env`:

```
EXCHANGERATE_API_KEY=your_key_here
```

- [ ] **Step 3: Test US stock fetch manually**

```bash
cd scheduler
node --env-file=.env --import tsx/esm -e "
import { UsStockFetcher } from './src/fetchers/us-stock.js';
const f = new UsStockFetcher(process.env.FINNHUB_API_KEY);
const data = await f.fetchOHLCV('AAPL', 'daily');
console.log('AAPL rows:', data.length, 'latest:', data.at(-1));
"
```

Expected: 80–120 rows, latest with today or recent date.

- [ ] **Step 4: Test crypto fetch manually**

```bash
node --env-file=.env --import tsx/esm -e "
import { CryptoFetcher } from './src/fetchers/crypto.js';
const f = new CryptoFetcher();
const data = await f.fetchOHLCV('BTCUSDT', 'hourly');
console.log('BTC hourly rows:', data.length, 'latest:', data.at(-1));
"
```

Expected: 168 rows with hourly dates.

- [ ] **Step 5: Test FX fetch manually (requires API running locally)**

Start the API first in another terminal: `cd api && npm run dev`

```bash
node --env-file=.env --import tsx/esm -e "
import axios from 'axios';
import { FxFetcher } from './src/fetchers/fx.js';
const api = axios.create({ baseURL: process.env.WORKERS_API_URL, headers: { 'X-API-Key': process.env.WORKERS_API_KEY } });
const f = new FxFetcher(process.env.EXCHANGERATE_API_KEY, api);
const data = await f.fetchOHLCV('USD/TWD', 'daily');
console.log('USD/TWD rows:', data.length, 'latest:', data.at(-1));
"
```

Expected: 1 row on first run (today's rate stored in D1).

- [ ] **Step 6: Commit env example (do not commit .env)**

```bash
git add scheduler/.env.example
git commit -m "docs: update .env.example with Finnhub and ExchangeRate-API keys"
```
