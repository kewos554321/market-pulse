# shadcn/ui 全站遷移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all pages and shared components (except TwStocks/Watchlist) from inline `style={{}}` to shadcn/ui + Tailwind classes, using WatchlistNew as the visual reference.

**Architecture:** Replace inline style objects with Tailwind utility classes and shadcn primitives (Card, Button, Badge, Input, Label). All colours reference CSS variable tokens (text-primary, text-muted-foreground, etc.) — no raw hex values. The shadcn CSS variables in index.css are already correct and do not need modification.

**Tech Stack:** React 18, TypeScript, Tailwind v4, shadcn/ui (base-nova), @base-ui/react, lucide-react

---

## File Map

| File | Action |
|------|--------|
| `web/src/components/ui/input.tsx` | Create (via shadcn CLI) |
| `web/src/components/ui/label.tsx` | Create (via shadcn CLI) |
| `web/src/components/SubTabNav.tsx` | Rewrite |
| `web/src/components/AssetSearch.tsx` | Rewrite |
| `web/src/components/AssetWatchlist.tsx` | Rewrite |
| `web/src/components/AssetSignals.tsx` | Rewrite |
| `web/src/pages/Home.tsx` | Rewrite |
| `web/src/pages/Recommendations.tsx` | Rewrite |
| `web/src/pages/Settings.tsx` | Rewrite |
| `web/src/pages/AlgorithmLibrary.tsx` | Rewrite |
| `web/src/pages/AlgorithmEditor.tsx` | Rewrite |
| `web/src/App.tsx` | Rewrite navbar only |

---

## Task 0: Install missing shadcn components (Input, Label)

**Files:**
- Create: `web/src/components/ui/input.tsx`
- Create: `web/src/components/ui/label.tsx`

- [ ] **Step 1: Add Input and Label via shadcn CLI**

```bash
cd web && npx shadcn@latest add input label
```

Expected: both files appear in `src/components/ui/`. If prompted about overwriting, say no (they shouldn't exist yet).

- [ ] **Step 2: Verify files exist**

```bash
ls web/src/components/ui/
```

Expected output includes `input.tsx` and `label.tsx`.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ui/input.tsx web/src/components/ui/label.tsx
git commit -m "feat: add shadcn Input and Label components"
```

---

## Task 1: Migrate SubTabNav

**Files:**
- Modify: `web/src/components/SubTabNav.tsx`

- [ ] **Step 1: Replace SubTabNav with Tailwind + className NavLink**

Replace the entire file with:

```tsx
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  label: string;
}

interface Props {
  tabs: Tab[];
}

export function SubTabNav({ tabs }: Props) {
  return (
    <div className="flex border-b border-border mb-5 gap-1">
      {tabs.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'px-4 py-2 text-[13px] no-underline transition-colors -mb-px border-b-2',
              isActive
                ? 'text-primary font-semibold border-primary'
                : 'text-muted-foreground font-normal border-transparent'
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and verify**

```bash
cd web && npm run dev
```

Open `http://localhost:5173/us-stocks` — sub-tabs should show indigo underline on active tab, muted colour on inactive. Check `/crypto` and `/fx` too.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SubTabNav.tsx
git commit -m "feat: migrate SubTabNav to Tailwind"
```

---

## Task 2: Migrate AssetSearch

**Files:**
- Modify: `web/src/components/AssetSearch.tsx`

- [ ] **Step 1: Replace AssetSearch with Tailwind + lucide Search icon**

Replace the entire file with:

```tsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import stocksData from '../data/stocks.json';
import usStocksData from '../data/us-stocks.json';
import { CRYPTO_LIST } from '../data/crypto';
import { FX_PAIRS } from '../data/fx';
import { cn } from '@/lib/utils';

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
  const assets = useMemo(() => getAssets(assetType), [assetType]);

  useEffect(() => {
    setResults(filterAssets(assets, query));
    setActiveIndex(-1);
  }, [query, assets]);

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
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center gap-2 bg-muted/40 border-2 border-primary rounded-lg px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER[assetType]}
          className="border-none outline-none bg-transparent text-[13px] text-foreground w-full"
        />
      </div>
      {results.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/50 border-b border-border uppercase tracking-wider font-semibold">
            搜尋結果
          </div>
          {results.map((asset, i) => (
            <div
              key={asset.symbol}
              onMouseDown={() => handleSelect(asset)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'px-3 py-2.5 flex items-center gap-3 cursor-pointer border-b border-border last:border-0',
                i === activeIndex ? 'bg-primary/5' : 'bg-card'
              )}
            >
              <span className="font-bold text-primary text-[13px] min-w-[60px]">{asset.symbol}</span>
              <span className="text-foreground text-[13px]">{asset.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify search still works**

Open `http://localhost:5173/us-stocks` — type in the search box. Dropdown should appear with indigo symbol and accessible keyboard navigation.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssetSearch.tsx
git commit -m "feat: migrate AssetSearch to Tailwind"
```

---

## Task 3: Migrate AssetWatchlist

**Files:**
- Modify: `web/src/components/AssetWatchlist.tsx`

This is the highest-leverage task — migrating it automatically updates UsStocks, Crypto, and Fx pages.

- [ ] **Step 1: Replace AssetWatchlist with Card/Button/Badge**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AssetSearch } from './AssetSearch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { WatchlistItem } from '../types';

type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

interface Props {
  assetType: AssetType;
  label: string;
  description: string;
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
      const item = await api.addStock(selected.symbol, selected.name, assetType);
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
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">追蹤清單</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="mb-5">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold text-foreground mb-2">新增{label}</p>
          <form onSubmit={handleAdd} className="flex gap-2 items-start">
            <AssetSearch assetType={assetType} onSelect={(symbol, name) => setSelected({ symbol, name })} />
            {selected && (
              <Badge variant="secondary" className="self-center whitespace-nowrap shrink-0">
                {selected.symbol} {selected.name}
              </Badge>
            )}
            <Button type="submit" disabled={!selected} className="shrink-0">
              新增
            </Button>
          </form>
          {error && <p className="text-destructive text-[13px] mt-2">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2.5">
        {items.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              還沒有追蹤的項目，從上方搜尋新增吧
            </CardContent>
          </Card>
        )}
        {items.map((item) => (
          <Card key={item.id} className={cn('transition-opacity', item.enabled ? 'opacity-100' : 'opacity-60')}>
            <CardContent className="flex items-center gap-4">
              <div className={cn('w-2 h-2 rounded-full shrink-0', item.enabled ? 'bg-emerald-500' : 'bg-muted-foreground')} />
              <div className="flex-1 flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">{item.symbol}</span>
                <span className="text-muted-foreground text-sm">{item.name}</span>
                <Badge variant={item.enabled ? 'default' : 'secondary'} className="text-[11px]">
                  {item.enabled ? '追蹤中' : '已暫停'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}>
                  設定算法
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleToggle(item)}>
                  {item.enabled ? '暫停' : '啟用'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                  刪除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify three pages**

Check `http://localhost:5173/us-stocks`, `/crypto`, and `/fx`. Each should show the Card-based layout with enabled/disabled status dots and Badge.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssetWatchlist.tsx
git commit -m "feat: migrate AssetWatchlist to shadcn Card/Button/Badge"
```

---

## Task 4: Migrate AssetSignals

**Files:**
- Modify: `web/src/components/AssetSignals.tsx`

- [ ] **Step 1: Replace AssetSignals with Card and Badge**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">訊號歷史</h1>
        <p className="text-sm text-muted-foreground">系統觸發過的買賣訊號紀錄</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {signals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              目前沒有觸發訊號
            </CardContent>
          </Card>
        ) : signals.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-foreground text-sm">{s.symbol}</span>
                  <Badge className="text-[11px]">觸發</Badge>
                  {s.notified && (
                    <span className="text-[11px] text-emerald-600">✓ 已通知</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  收盤價 {s.close_price} ・ {new Date(s.triggered_at).toLocaleString('zh-TW')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Open `http://localhost:5173/us-stocks/signals`. Page should show Card layout with Badge on each signal entry.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssetSignals.tsx
git commit -m "feat: migrate AssetSignals to shadcn Card/Badge"
```

---

## Task 5: Migrate Home

**Files:**
- Modify: `web/src/pages/Home.tsx`

- [ ] **Step 1: Replace Home with Card + Tailwind**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, CardContent } from '@/components/ui/card';
import type { Signal } from '../types';

export function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(10).then(setSignals).catch(console.error);
  }, []);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">首頁</h1>
        <p className="text-sm text-muted-foreground">最新觸發訊號概覽</p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground mb-4">近期訊號</p>
          {signals.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-6">
              目前沒有觸發訊號。
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {signals.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-3 bg-muted/40 rounded-lg">
                  <span className="font-bold text-primary text-sm min-w-[44px]">{s.symbol}</span>
                  <span className="text-muted-foreground text-[13px]">收盤 {s.close_price}</span>
                  <span className="ml-auto text-muted-foreground text-xs">
                    {s.triggered_at.split('T')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Open `http://localhost:5173/`. Page header and card should match the style of other migrated pages.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home.tsx
git commit -m "feat: migrate Home page to shadcn Card"
```

---

## Task 6: Migrate Recommendations

**Files:**
- Modify: `web/src/pages/Recommendations.tsx`

- [ ] **Step 1: Replace Recommendations with Card/Button/Badge/Input**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Recommendation, RecommendationStock, WatchlistItem } from '../types';

export function Recommendations() {
  const [date, setDate] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  const [stocks, setStocks] = useState<RecommendationStock[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [stockError, setStockError] = useState('');
  const [poolOpen, setPoolOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.getRecommendations(), api.getWatchlist()])
      .then(([recs, wl]) => {
        setDate(recs.date);
        setItems(recs.items);
        setWatchlist(wl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    api.getRecommendationStocks()
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, []);

  const watchlistSymbols = new Set(watchlist.map((w) => w.symbol));

  async function handleAdd(item: Recommendation) {
    await api.addStock(item.symbol, item.name);
    setAddedSymbols((prev) => new Set(prev).add(item.symbol));
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
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">推薦選股</h1>
        <p className="text-sm text-muted-foreground">每日排程掃描結果</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">載入中...</p>
          ) : !date ? (
            <p className="text-sm text-muted-foreground">尚無推薦資料，請等待排程執行。</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">掃描日期：{date}</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">今日無符合策略的標的。</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border">
                      {['代號', '名稱', '收盤價', '符合策略', ''].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-xs font-semibold text-muted-foreground text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const inWatchlist = watchlistSymbols.has(item.symbol) || addedSymbols.has(item.symbol);
                      return (
                        <tr key={item.id} className="border-b border-border/50">
                          <td className="px-2.5 py-2 text-[13px] font-semibold text-foreground">{item.symbol}</td>
                          <td className="px-2.5 py-2 text-[13px] text-foreground">{item.name}</td>
                          <td className="px-2.5 py-2 text-[13px] text-foreground">{item.close_price.toFixed(2)}</td>
                          <td className="px-2.5 py-2">
                            {item.strategies.map((s) => (
                              <Badge key={s} variant="secondary" className="mr-1 text-[11px]">{s}</Badge>
                            ))}
                          </td>
                          <td className="px-2.5 py-2">
                            <Button
                              size="sm"
                              variant={inWatchlist ? 'secondary' : 'default'}
                              disabled={inWatchlist}
                              onClick={() => handleAdd(item)}
                            >
                              {inWatchlist ? '已追蹤' : '加入追蹤'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <Button
          variant="outline"
          onClick={() => setPoolOpen((v) => !v)}
          className="gap-1.5"
        >
          <span>管理股票池</span>
          {!stocksLoading && (
            <span className="text-xs text-muted-foreground font-normal">{stocks.length} / 120 支</span>
          )}
          <span className="text-xs text-muted-foreground">{poolOpen ? '▲' : '▼'}</span>
        </Button>

        {poolOpen && (
          <Card className="mt-3 max-w-[560px]">
            <CardContent className="pt-5">
              {stocksLoading ? (
                <p className="text-sm text-muted-foreground">載入中...</p>
              ) : (
                <>
                  <form onSubmit={handleAddStock} className="flex gap-2 mb-4 flex-wrap items-center">
                    <Input
                      type="text"
                      placeholder="代號（如 2330）"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value)}
                      className="w-32"
                      required
                    />
                    <Input
                      type="text"
                      placeholder="名稱（如 台積電）"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-32"
                      required
                    />
                    <Button type="submit">新增</Button>
                    {stockError && (
                      <span className="text-xs text-destructive self-center">{stockError}</span>
                    )}
                  </form>

                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border">
                          {['代號', '名稱', '類型', ''].map((h) => (
                            <th key={h} className="px-2.5 py-2 text-xs font-semibold text-muted-foreground text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stocks.map((s) => (
                          <tr key={s.symbol} className="border-b border-border/50">
                            <td className="px-2.5 py-2 text-[13px] font-semibold text-foreground">{s.symbol}</td>
                            <td className="px-2.5 py-2 text-[13px] text-foreground">{s.name}</td>
                            <td className="px-2.5 py-2">
                              <Badge variant={s.is_default ? 'default' : 'secondary'} className="text-[11px]">
                                {s.is_default ? '預設' : '自訂'}
                              </Badge>
                            </td>
                            <td className="px-2.5 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteStock(s.symbol)}
                              >
                                移除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Open `http://localhost:5173/recommendations`. Check the table, badges, and "管理股票池" toggle expand.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Recommendations.tsx
git commit -m "feat: migrate Recommendations page to shadcn"
```

---

## Task 7: Migrate Settings

**Files:**
- Modify: `web/src/pages/Settings.tsx`

- [ ] **Step 1: Replace Settings with Card/Button/Input/Label**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EmailRecipient } from '../api/client';

export function Settings() {
  const [enabled, setEnabled] = useState(true);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [emailError, setEmailError] = useState('');

  const [lineToken, setLineToken] = useState('');
  const [lineSecret, setLineSecret] = useState('');
  const [lineGroupId, setLineGroupId] = useState('');
  const [lineTokenSet, setLineTokenSet] = useState(false);
  const [lineSecretSet, setLineSecretSet] = useState(false);
  const [lineSaved, setLineSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEnabled(s.schedule_enabled !== '0');
      setLineGroupId(s.line_group_id ?? '');
      setLineTokenSet(!!s.line_channel_access_token);
      setLineSecretSet(false);
    }).catch(console.error);

    api.getEmailRecipients()
      .then(setRecipients)
      .catch(console.error)
      .finally(() => setRecipientsLoading(false));
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

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">設定</h1>
        <p className="text-sm text-muted-foreground">通知和排程設定</p>
      </div>

      <Card className="max-w-[480px]">
        <CardContent className="pt-5">
          <form onSubmit={handleSaveSchedule} className="flex flex-col gap-5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <div className="text-[13px] font-semibold text-foreground">啟用每日排程</div>
                <div className="text-xs text-muted-foreground">每週一到五 14:35 台北時間自動執行</div>
              </div>
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit">儲存設定</Button>
              {scheduleSaved && (
                <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 mb-3">
        <h2 className="text-base font-bold text-foreground mb-1">Email 收件人</h2>
        <p className="text-sm text-muted-foreground">每日訊號通知的收件人清單</p>
      </div>

      <Card className="max-w-[560px]">
        <CardContent className="pt-5">
          <form onSubmit={handleAddRecipient} className="flex gap-2 mb-4 flex-wrap items-center">
            <Input
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-48"
              required
            />
            <Input
              type="text"
              placeholder="備註（選填）"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-28"
            />
            <Button type="submit">新增</Button>
            {emailError && (
              <span className="text-xs text-destructive self-center">{emailError}</span>
            )}
          </form>

          {recipientsLoading ? (
            <p className="text-sm text-muted-foreground">載入中...</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無收件人</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  {['Email', '備註', ''].map((h) => (
                    <th key={h} className="px-2.5 py-2 text-xs font-semibold text-muted-foreground text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-2.5 py-2 text-[13px] text-foreground">{r.email}</td>
                    <td className="px-2.5 py-2 text-[13px] text-muted-foreground">{r.label ?? '—'}</td>
                    <td className="px-2.5 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteRecipient(r.id)}
                      >
                        移除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 mb-3">
        <h2 className="text-base font-bold text-foreground mb-1">LINE 通知</h2>
        <p className="text-sm text-muted-foreground">
          將 Bot 加入群組後 Group ID 將自動填入。
          Webhook URL：<code className="text-xs bg-muted px-1 py-0.5 rounded">https://&lt;workers-domain&gt;/line/webhook</code>
        </p>
      </div>

      <Card className="max-w-[480px]">
        <CardContent className="pt-5">
          <form onSubmit={handleSaveLine} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-token">Channel Access Token</Label>
              <Input
                id="line-token"
                type="password"
                value={lineToken}
                onChange={(e) => setLineToken(e.target.value)}
                placeholder={lineTokenSet ? '已設定（留空保持不變）' : '貼上 Channel Access Token'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-secret">Channel Secret</Label>
              <Input
                id="line-secret"
                type="password"
                value={lineSecret}
                onChange={(e) => setLineSecret(e.target.value)}
                placeholder={lineSecretSet ? '已設定（留空保持不變）' : '貼上 Channel Secret（用於驗證 webhook）'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-group">Group ID</Label>
              <Input
                id="line-group"
                type="text"
                value={lineGroupId}
                onChange={(e) => setLineGroupId(e.target.value)}
                placeholder="Bot 加入群組後自動填入，或手動輸入"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">儲存 LINE 設定</Button>
              {lineSaved && (
                <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Open `http://localhost:5173/settings`. Check schedule card, email form, LINE form. The Input fields should use the shadcn styled border-focus.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Settings.tsx
git commit -m "feat: migrate Settings page to shadcn Card/Input/Label"
```

---

## Task 8: Migrate AlgorithmLibrary

**Files:**
- Modify: `web/src/pages/AlgorithmLibrary.tsx`

- [ ] **Step 1: Replace AlgorithmLibrary with Card/Button/Input**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { parsePresets } from '../data/signals';
import type { AlgorithmTemplate, ConditionTree } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmLibrary() {
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [editing, setEditing] = useState<AlgorithmTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
  }, []);

  function startNew() {
    setEditing(null);
    setNewName('');
    setConditions(emptyTree);
    setMode('preset');
    setShowForm(true);
  }

  function startEdit(t: AlgorithmTemplate) {
    setEditing(t);
    setNewName(t.name);
    setConditions(t.conditions);
    const presets = parsePresets(t.conditions);
    setMode(t.conditions.conditions.length === 0 || presets !== null ? 'preset' : 'advanced');
    setShowForm(true);
  }

  async function handleSave() {
    if (!newName.trim()) return;
    if (editing) {
      await api.updateAlgorithmTemplate(editing.id, newName.trim(), conditions);
      setTemplates((prev) => prev.map((t) =>
        t.id === editing.id ? { ...t, name: newName.trim(), conditions } : t
      ));
    } else {
      const created = await api.createAlgorithmTemplate(newName.trim(), conditions);
      setTemplates((prev) => [...prev, created]);
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowForm(false); }, 1500);
  }

  async function handleDelete(id: string) {
    await api.deleteAlgorithmTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editing?.id === id) setShowForm(false);
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground mb-1">算法庫</h1>
        <p className="text-sm text-muted-foreground">管理可跨群組共用的算法模板</p>
      </div>

      <div className="flex flex-col gap-2.5 mb-4">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center gap-3">
              <div className="flex-1">
                <span className="font-bold text-foreground text-sm">{t.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {t.conditions.conditions.length} 個條件
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => startEdit(t)}>編輯</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)}>刪除</Button>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              尚無算法模板，點下方建立第一個
            </CardContent>
          </Card>
        )}
      </div>

      {!showForm && (
        <Button onClick={startNew}>+ 新增模板</Button>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-[13px] font-semibold text-foreground mb-3">
              {editing ? `編輯：${editing.name}` : '新增模板'}
            </p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="模板名稱（如「動能型」）"
              className="mb-4"
            />
            {mode === 'preset'
              ? <PresetSignalPicker value={conditions} onChange={setConditions} />
              : <ConditionBuilder conditions={conditions} onChange={setConditions} />
            }
            <div className="flex items-center gap-3 mt-4">
              <Button onClick={handleSave}>儲存</Button>
              {saved && <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => setShowForm(false)}
              >
                取消
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
              >
                {mode === 'preset' ? '⚙ 進階模式' : '← 回到訊號選擇'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Open `http://localhost:5173/algorithm-library`. Template list should use Cards. Click "新增模板" — form card should appear with Input.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/AlgorithmLibrary.tsx
git commit -m "feat: migrate AlgorithmLibrary to shadcn Card/Button/Input"
```

---

## Task 9: Migrate AlgorithmEditor

**Files:**
- Modify: `web/src/pages/AlgorithmEditor.tsx`

- [ ] **Step 1: Replace AlgorithmEditor with Card/Button**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { AlgorithmTemplatePicker } from '../components/AlgorithmTemplatePicker';
import { parsePresets } from '../data/signals';
import type { AlgorithmState, AlgorithmTemplate, ConditionTree, WatchlistItem } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stock, setStock] = useState<WatchlistItem | null>(null);
  const [algoState, setAlgoState] = useState<AlgorithmState>({ source: 'custom', conditions: emptyTree });
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getWatchlist().then((list) => setStock(list.find((s) => s.id === id) ?? null));
    api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
    api.getAlgorithm(id)
      .then((state) => {
        setAlgoState(state);
        if (state.source === 'custom') {
          setConditions(state.conditions);
          const presets = parsePresets(state.conditions);
          setMode(state.conditions.conditions.length === 0 || presets !== null ? 'preset' : 'advanced');
        }
      })
      .catch(() => {
        setAlgoState({ source: 'custom', conditions: emptyTree });
        setConditions(emptyTree);
        setMode('preset');
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSelectTemplate(templateId: string | null) {
    if (!id) return;
    await api.setWatchlistAlgorithmTemplate(id, templateId);
    const refreshed = await api.getAlgorithm(id);
    setAlgoState(refreshed);
    if (refreshed.source === 'custom') setConditions(refreshed.conditions);
  }

  async function handleSave() {
    if (!id) return;
    if (algoState.source === 'custom') await api.saveAlgorithm(id, conditions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="text-primary mb-4 px-0 hover:bg-transparent"
        onClick={() => navigate(-1)}
      >
        ← 返回清單
      </Button>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">算法設定</h1>
        {stock && (
          <p className="text-sm text-muted-foreground">{stock.symbol} {stock.name}</p>
        )}
      </div>

      <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3.5 py-2.5 mb-4 relative">
        <span className="text-xs text-muted-foreground font-medium mr-1">算法來源：</span>
        <span className={`text-xs font-semibold ${algoState.source === 'template' ? 'text-violet-700' : 'text-foreground'}`}>
          {algoState.source === 'template'
            ? `模板：${algoState.templateName ?? '(未命名)'}`
            : '自訂'}
        </span>
        <div className="ml-auto relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTemplatePickerOpen((o) => !o)}
          >
            連結模板 ▾
          </Button>
          {templatePickerOpen && (
            <AlgorithmTemplatePicker
              templates={templates}
              selectedTemplateId={algoState.templateId}
              onSelect={handleSelectTemplate}
              onClose={() => setTemplatePickerOpen(false)}
              onCreateNew={() => navigate('/algorithm-library')}
            />
          )}
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-5">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground text-[13px]">載入中...</div>
          ) : algoState.source === 'template' ? (
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
              <div className="text-xs text-violet-700 font-semibold mb-2">
                模板：{algoState.templateName ?? '(未命名)'}（即時同步）
              </div>
              {algoState.conditions.conditions.length === 0 ? (
                <div className="text-xs text-muted-foreground">此模板尚未設定條件</div>
              ) : (
                <pre className="m-0 text-xs text-violet-700 font-mono">
                  {JSON.stringify(algoState.conditions, null, 2)}
                </pre>
              )}
            </div>
          ) : mode === 'preset' ? (
            <PresetSignalPicker value={conditions} onChange={setConditions} />
          ) : (
            <ConditionBuilder conditions={conditions} onChange={setConditions} />
          )}
        </CardContent>
      </Card>

      {algoState.source === 'custom' && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Button onClick={handleSave}>儲存算法</Button>
          {saved && <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
          >
            {mode === 'preset' ? '⚙ 進階模式（自訂條件數值）' : '← 回到訊號選擇'}
          </Button>
        </div>
      )}

      {algoState.source === 'custom' && (
        <details>
          <summary className="cursor-pointer text-muted-foreground text-xs select-none">查看 JSON</summary>
          <pre className="bg-muted/40 border border-border rounded-lg px-4 py-4 text-xs overflow-auto mt-2 text-foreground">
            {JSON.stringify(conditions, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to a watchlist item's algorithm page (e.g. via `/us-stocks` → 設定算法). Back button, template source row, and conditions card should all render without inline styles.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/AlgorithmEditor.tsx
git commit -m "feat: migrate AlgorithmEditor to shadcn Card/Button"
```

---

## Task 10: Migrate App.tsx Navbar (final)

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Replace inline navbar styles with Tailwind**

Replace the entire file with:

```tsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { TwStocks } from './pages/TwStocks';
import { TwStocksNew } from './pages/TwStocksNew';
import { UsStocks } from './pages/UsStocks';
import { Crypto } from './pages/Crypto';
import { Fx } from './pages/Fx';
import { AlgorithmEditor } from './pages/AlgorithmEditor';
import { AlgorithmLibrary } from './pages/AlgorithmLibrary';
import { Settings } from './pages/Settings';
import { Recommendations } from './pages/Recommendations';
import { cn } from '@/lib/utils';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background font-sans">
        <nav className="flex items-center bg-card border-b border-border px-6 sticky top-0 z-[100] shadow-xs">
          <span className="font-extrabold text-primary text-[15px] mr-8 py-3.5">
            Market Pulse
          </span>
          {[
            { to: '/', label: '首頁', exact: true },
            { to: '/tw-stocks', label: '台股', exact: false },
            { to: '/tw-stocks-new', label: '台股(新)', exact: false },
            { to: '/us-stocks', label: '美股', exact: false },
            { to: '/crypto', label: '加密貨幣', exact: false },
            { to: '/fx', label: '匯率', exact: false },
            { to: '/recommendations', label: '推薦', exact: false },
            { to: '/settings', label: '設定', exact: false },
            { to: '/algorithm-library', label: '算法庫', exact: false },
          ].map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'py-3.5 px-4 text-[13px] no-underline transition-colors border-b-2',
                  isActive
                    ? 'text-primary font-semibold border-primary'
                    : 'text-muted-foreground font-normal border-transparent'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="max-w-[900px] mx-auto px-6 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tw-stocks/*" element={<TwStocks />} />
            <Route path="/tw-stocks-new/*" element={<TwStocksNew />} />
            <Route path="/us-stocks/*" element={<UsStocks />} />
            <Route path="/crypto/*" element={<Crypto />} />
            <Route path="/fx/*" element={<Fx />} />
            <Route path="/watchlist/:id/algorithm" element={<AlgorithmEditor />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/algorithm-library" element={<AlgorithmLibrary />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Verify the full site**

Open `http://localhost:5173/` and navigate through every route:
- `/` — Home
- `/us-stocks` — Watchlist + SubTabNav
- `/crypto` — Watchlist
- `/fx` — Watchlist
- `/recommendations` — table + pool toggle
- `/settings` — three card sections
- `/algorithm-library` — template list
- `/tw-stocks` — old page (should be unchanged)

Navbar should show indigo active underline, muted inactive links, white background with subtle border.

- [ ] **Step 3: Build check**

```bash
cd web && npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: migrate App.tsx navbar to Tailwind — completes shadcn migration"
```

---

## Post-Migration: Update design.md status

- [ ] **Step 1: Mark all files as migrated in design.md**

In `docs/superpowers/specs/2026-06-08-shadcn-migration-design.md`, update the Migration Status table — change all `⬜ 待遷移` to `✅ 已完成`.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-08-shadcn-migration-design.md
git commit -m "docs: mark shadcn migration complete in design.md"
```
