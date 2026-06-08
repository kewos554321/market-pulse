# Shared Asset Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicated page shell code across TwStocks/UsStocks/Crypto/Fx, unify all four to a 3-tab structure (追蹤清單 → 推薦 → 訊號歷史), and extract the repeated stable-height pagination pattern into a shared hook.

**Architecture:** A new `AssetPage` shell component handles SubTabNav + Routes for all four asset types, receiving a `WatchlistComponent` prop so TwStocks can keep its full-featured `Watchlist` while the others use `AssetWatchlist`. A `useStableListHeight` hook replaces the three-copy `listRef + listMinHeight` block. `Recommendations` gains an `assetType` prop and renders a "coming soon" state for non-TW assets.

**Tech Stack:** React 18, TypeScript 5, React Router v6, Vite (type-check via `tsc --noEmit`)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `web/src/types.ts` | Export shared `AssetType` union |
| Create | `web/src/lib/useStableListHeight.ts` | Stable-height hook |
| Modify | `web/src/components/AssetWatchlist.tsx` | Use hook + import `AssetType` from types |
| Modify | `web/src/components/AssetSignals.tsx` | Use hook + import `AssetType` from types |
| Modify | `web/src/pages/Watchlist.tsx` | Add `WatchlistProps` interface + use hook |
| Modify | `web/src/pages/Recommendations.tsx` | Add optional `assetType` prop |
| Create | `web/src/components/AssetPage.tsx` | Shared page shell |
| Modify | `web/src/pages/TwStocks.tsx` | Use `AssetPage` |
| Modify | `web/src/pages/UsStocks.tsx` | Use `AssetPage` |
| Modify | `web/src/pages/Crypto.tsx` | Use `AssetPage` |
| Modify | `web/src/pages/Fx.tsx` | Use `AssetPage` |
| Delete | `web/src/pages/Signals.tsx` | Dead code |

---

## Task 1: Add `AssetType` to `types.ts`

**Files:**
- Modify: `web/src/types.ts`

- [ ] **Step 1: Add the type export**

Open `web/src/types.ts` and add this line at the top, before the first `export interface`:

```ts
export type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts
git commit -m "feat: export AssetType from types.ts"
```

---

## Task 2: Create `useStableListHeight` hook

**Files:**
- Create: `web/src/lib/useStableListHeight.ts`

- [ ] **Step 1: Create the file**

`web/src/lib/useStableListHeight.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export function useStableListHeight<T>(pageItems: T[]) {
  const listRef = useRef<HTMLDivElement>(null);
  const [listMinHeight, setListMinHeight] = useState(0);

  useEffect(() => {
    if (listRef.current) {
      const h = listRef.current.scrollHeight;
      setListMinHeight((prev) => Math.max(prev, h));
    }
    // pageItems identity changes only when page or underlying array changes (usePagination uses useMemo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems]);

  const resetHeight = useCallback(() => setListMinHeight(0), []);

  return { listRef, listMinHeight, resetHeight };
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/useStableListHeight.ts
git commit -m "feat: add useStableListHeight hook"
```

---

## Task 3: Refactor `AssetWatchlist` to use the hook

**Files:**
- Modify: `web/src/components/AssetWatchlist.tsx`

- [ ] **Step 1: Replace the three boilerplate lines + two effects with the hook**

Replace the current content of `web/src/components/AssetWatchlist.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AssetSearch } from './AssetSearch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Pager } from './Pager';
import { usePagination } from '../lib/usePagination';
import { useStableListHeight } from '../lib/useStableListHeight';
import type { AssetType } from '../types';
import type { WatchlistItem } from '../types';

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

  const { page, setPage, pageItems, totalPages } = usePagination(items, 10);
  const { listRef, listMinHeight, resetHeight } = useStableListHeight(pageItems);

  useEffect(() => {
    setPage(1);
    resetHeight();
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

      <div ref={listRef} className="flex flex-col gap-2.5" style={{ minHeight: listMinHeight || undefined }}>
        {items.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              還沒有追蹤的項目，從上方搜尋新增吧
            </CardContent>
          </Card>
        )}
        {pageItems.map((item) => (
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

      <Pager page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssetWatchlist.tsx
git commit -m "refactor: use useStableListHeight in AssetWatchlist"
```

---

## Task 4: Refactor `AssetSignals` to use the hook

**Files:**
- Modify: `web/src/components/AssetSignals.tsx`

- [ ] **Step 1: Replace boilerplate**

Replace the current content of `web/src/components/AssetSignals.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Pager } from './Pager';
import { usePagination } from '../lib/usePagination';
import { useStableListHeight } from '../lib/useStableListHeight';
import type { AssetType } from '../types';
import type { Signal } from '../types';

interface Props {
  assetType: AssetType;
}

export function AssetSignals({ assetType }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(100, assetType).then(setSignals).catch(console.error);
  }, [assetType]);

  const { page, setPage, pageItems, totalPages } = usePagination(signals, 20);
  const { listRef, listMinHeight, resetHeight } = useStableListHeight(pageItems);

  useEffect(() => {
    setPage(1);
    resetHeight();
  }, [assetType]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">訊號歷史</h1>
        <p className="text-sm text-muted-foreground">系統觸發過的買賣訊號紀錄</p>
      </div>
      <div ref={listRef} className="flex flex-col gap-2.5" style={{ minHeight: listMinHeight || undefined }}>
        {signals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              目前沒有觸發訊號
            </CardContent>
          </Card>
        ) : pageItems.map((s) => (
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

      <Pager page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssetSignals.tsx
git commit -m "refactor: use useStableListHeight in AssetSignals"
```

---

## Task 5: Add `WatchlistProps` interface + hook to `Watchlist.tsx`

**Files:**
- Modify: `web/src/pages/Watchlist.tsx`

`Watchlist.tsx` will receive props from `AssetPage` but continues to hard-code `tw_stock` internally. The props are accepted to satisfy the shared `WatchlistProps` interface; they are prefixed with `_` to mark them intentionally unused.

- [ ] **Step 1: Add import and update function signature**

At the top of `web/src/pages/Watchlist.tsx`, add the new imports alongside the existing ones:

```tsx
import { useStableListHeight } from '../lib/useStableListHeight';
import type { AssetType } from '../types';
```

Change the function signature from:

```tsx
export function Watchlist() {
```

to:

```tsx
interface WatchlistProps {
  assetType: AssetType;
  label: string;
  description: string;
}

export function Watchlist({ assetType: _assetType, label: _label, description: _description }: WatchlistProps) {
```

- [ ] **Step 2: Replace the stable-height boilerplate with the hook**

Remove these lines (around lines 40-53 in the current file):

```tsx
  const listRef = useRef<HTMLDivElement>(null);
  const [listMinHeight, setListMinHeight] = useState(0);

  useEffect(() => {
    if (listRef.current) {
      const h = listRef.current.scrollHeight;
      setListMinHeight((prev) => Math.max(prev, h));
    }
  }, [pageItems]);

  // 切換群組時重置，讓新群組重新量測
  useEffect(() => {
    setListMinHeight(0);
  }, [activeGroupId]);
```

Replace with:

```tsx
  const { listRef, listMinHeight, resetHeight } = useStableListHeight(pageItems);

  useEffect(() => {
    resetHeight();
  }, [activeGroupId]);
```

Also remove `useRef` from the React import line since it's no longer used directly (the hook owns the ref):

```tsx
import { useEffect, useState } from 'react';
```

- [ ] **Step 3: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Watchlist.tsx
git commit -m "refactor: add WatchlistProps interface and useStableListHeight to Watchlist"
```

---

## Task 6: Add `assetType` prop to `Recommendations`

**Files:**
- Modify: `web/src/pages/Recommendations.tsx`

`Recommendations` is also used at the top-level `/recommendations` route in `App.tsx` without any props. Make `assetType` optional with a default of `'tw_stock'` to preserve that usage.

- [ ] **Step 1: Add the prop and guard**

At the top of `web/src/pages/Recommendations.tsx`, add the import:

```tsx
import type { AssetType } from '../types';
```

Change the function signature from:

```tsx
export function Recommendations() {
```

to:

```tsx
interface Props {
  assetType?: AssetType;
}

export function Recommendations({ assetType = 'tw_stock' }: Props) {
```

Then, immediately after the opening `<div>` of the return statement (before the `<div className="mb-5">` header), add the non-TW guard:

```tsx
  return (
    <div>
      {assetType !== 'tw_stock' ? (
        <div className="mb-5">
          <h1 className="text-xl font-bold text-foreground mb-1">推薦選股</h1>
          <p className="text-sm text-muted-foreground">推薦功能目前僅支援台股，其他資產類型開發中。</p>
        </div>
      ) : (
        <>
          {/* existing JSX starting from <div className="mb-5"> */}
          ...entire existing return body...
        </>
      )}
    </div>
  );
```

The full updated return looks like this (wrap existing JSX in the else branch):

```tsx
  return (
    <div>
      {assetType !== 'tw_stock' ? (
        <div className="mb-5">
          <h1 className="text-xl font-bold text-foreground mb-1">推薦選股</h1>
          <p className="text-sm text-muted-foreground">推薦功能目前僅支援台股，其他資產類型開發中。</p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Recommendations.tsx
git commit -m "feat: add assetType prop to Recommendations with non-TW guard"
```

---

## Task 7: Create `AssetPage` component

**Files:**
- Create: `web/src/components/AssetPage.tsx`

- [ ] **Step 1: Create the file**

`web/src/components/AssetPage.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from './SubTabNav';
import { AssetSignals } from './AssetSignals';
import { Recommendations } from '../pages/Recommendations';
import type { AssetType } from '../types';

interface WatchlistProps {
  assetType: AssetType;
  label: string;
  description: string;
}

interface Props {
  assetType: AssetType;
  basePath: string;
  label: string;
  description: string;
  WatchlistComponent: React.ComponentType<WatchlistProps>;
}

export function AssetPage({ assetType, basePath, label, description, WatchlistComponent }: Props) {
  const tabs = [
    { to: basePath, label: '追蹤清單' },
    { to: `${basePath}/recommendations`, label: '推薦' },
    { to: `${basePath}/signals`, label: '訊號歷史' },
  ];

  return (
    <div>
      <SubTabNav tabs={tabs} />
      <Routes>
        <Route
          index
          element={<WatchlistComponent assetType={assetType} label={label} description={description} />}
        />
        <Route path="recommendations" element={<Recommendations assetType={assetType} />} />
        <Route path="signals" element={<AssetSignals assetType={assetType} />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssetPage.tsx
git commit -m "feat: add AssetPage shell component"
```

---

## Task 8: Update all four page files to use `AssetPage`

**Files:**
- Modify: `web/src/pages/TwStocks.tsx`
- Modify: `web/src/pages/UsStocks.tsx`
- Modify: `web/src/pages/Crypto.tsx`
- Modify: `web/src/pages/Fx.tsx`

- [ ] **Step 1: Replace `TwStocks.tsx`**

```tsx
import { AssetPage } from '../components/AssetPage';
import { Watchlist } from './Watchlist';

export function TwStocks() {
  return (
    <AssetPage
      assetType="tw_stock"
      basePath="/tw-stocks"
      label="台股"
      description="管理你想追蹤的股票"
      WatchlistComponent={Watchlist}
    />
  );
}
```

- [ ] **Step 2: Replace `UsStocks.tsx`**

```tsx
import { AssetPage } from '../components/AssetPage';
import { AssetWatchlist } from '../components/AssetWatchlist';

export function UsStocks() {
  return (
    <AssetPage
      assetType="us_stock"
      basePath="/us-stocks"
      label="美股"
      description="管理你想追蹤的美國股票（S&P 500）"
      WatchlistComponent={AssetWatchlist}
    />
  );
}
```

- [ ] **Step 3: Replace `Crypto.tsx`**

```tsx
import { AssetPage } from '../components/AssetPage';
import { AssetWatchlist } from '../components/AssetWatchlist';

export function Crypto() {
  return (
    <AssetPage
      assetType="crypto"
      basePath="/crypto"
      label="幣種"
      description="追蹤主流加密貨幣（每小時掃描）"
      WatchlistComponent={AssetWatchlist}
    />
  );
}
```

- [ ] **Step 4: Replace `Fx.tsx`**

```tsx
import { AssetPage } from '../components/AssetPage';
import { AssetWatchlist } from '../components/AssetWatchlist';

export function Fx() {
  return (
    <AssetPage
      assetType="fx"
      basePath="/fx"
      label="貨幣對"
      description="追蹤各國匯率（USD、EUR、GBP、TWD、JPY、AUD、CHF）"
      WatchlistComponent={AssetWatchlist}
    />
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual browser check**

Start the dev server:

```bash
cd web && npm run dev
```

Verify:
- `/tw-stocks` — 追蹤清單 works, 推薦 tab shows tw_stock recommendations, 訊號歷史 works
- `/us-stocks` — all 3 tabs present, 推薦 shows "尚不支援" message
- `/crypto` — all 3 tabs present, 推薦 shows "尚不支援" message
- `/fx` — all 3 tabs present, 推薦 shows "尚不支援" message
- `/recommendations` (top-level nav) — still works, shows TW recommendations

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/TwStocks.tsx web/src/pages/UsStocks.tsx web/src/pages/Crypto.tsx web/src/pages/Fx.tsx
git commit -m "feat: migrate all asset pages to use AssetPage shell"
```

---

## Task 9: Delete dead code `Signals.tsx`

**Files:**
- Delete: `web/src/pages/Signals.tsx`

- [ ] **Step 1: Confirm no imports**

```bash
grep -r "Signals" web/src --include="*.tsx" --include="*.ts" -l
```

Expected output: only `AssetSignals.tsx` and any component that imports it. `Signals.tsx` (the old page) should not appear as an import target anywhere.

- [ ] **Step 2: Delete the file**

```bash
rm web/src/pages/Signals.tsx
```

- [ ] **Step 3: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A web/src/pages/Signals.tsx
git commit -m "chore: delete dead Signals.tsx (replaced by AssetSignals)"
```
