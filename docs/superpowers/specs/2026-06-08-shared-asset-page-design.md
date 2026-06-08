# Shared Asset Page — Design Spec

**Date:** 2026-06-08  
**Status:** Approved

## Problem

`UsStocks`, `Crypto`, and `Fx` are structurally identical page shells that each duplicate the same SubTabNav + Routes pattern. They also lack a Recommendations tab that TwStocks already has. The `listRef + listMinHeight` stable-height pattern is copy-pasted across three components. `Signals.tsx` is dead code superseded by `AssetSignals`.

## Goal

- Eliminate the 3-way page shell duplication with a shared `AssetPage` component
- Align all four asset pages (TwStocks, UsStocks, Crypto, Fx) to the same 3-tab structure: 追蹤清單 → 推薦 → 訊號歷史
- Extract `useStableListHeight` hook
- Delete `Signals.tsx`

## Out of Scope

- Migrating `Watchlist.tsx` from inline styles to Tailwind/base-ui
- Backend support for recommendations on non-TW assets
- Adding group management to `AssetWatchlist`

---

## Architecture

### `AssetPage` component

New file: `web/src/components/AssetPage.tsx`

```tsx
interface AssetPageConfig {
  assetType: 'tw_stock' | 'us_stock' | 'crypto' | 'fx';
  basePath: string;
  label: string;
  description: string;
  WatchlistComponent: React.ComponentType<WatchlistProps>;
}
```

Renders `SubTabNav` with three fixed tabs and a `Routes` block:

| Route | Element |
|-------|---------|
| index | `<WatchlistComponent assetType label description />` |
| `recommendations` | `<Recommendations assetType />` |
| `signals` | `<AssetSignals assetType />` |
| `*` | `<Navigate to={basePath} />` |

`AssetPage` holds no data state — it is a pure shell.

### Tab structure (all four assets)

```
追蹤清單  →  {basePath}
推薦      →  {basePath}/recommendations
訊號歷史  →  {basePath}/signals
```

### Page file changes

Each page file becomes a one-liner that passes config to `AssetPage`:

```tsx
// UsStocks.tsx
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

`TwStocks.tsx` passes `WatchlistComponent={Watchlist}` to keep the existing group/bulk-import behaviour intact.

### `WatchlistProps` interface

Both `Watchlist` and `AssetWatchlist` must satisfy:

```tsx
interface WatchlistProps {
  assetType: 'tw_stock' | 'us_stock' | 'crypto' | 'fx';
  label: string;
  description: string;
}
```

`Watchlist.tsx` currently hard-codes `assetType = 'tw_stock'` and ignores `label`/`description`. The props are added to its interface but the internal logic is not changed.

### `Recommendations` — `assetType` prop

```tsx
interface Props {
  assetType: 'tw_stock' | 'us_stock' | 'crypto' | 'fx';
}
```

When `assetType !== 'tw_stock'`, render an explicit empty state instead of the data view:

> 推薦功能目前僅支援台股，其他資產類型開發中。

No backend changes required.

---

## `useStableListHeight` hook

New file: `web/src/lib/useStableListHeight.ts`

```ts
function useStableListHeight<T>(deps: T[]): {
  listRef: React.RefObject<HTMLDivElement>;
  listMinHeight: number;
  resetHeight: () => void;
}
```

- Measures `listRef.current.scrollHeight` after each render triggered by `deps`
- Keeps a high-water-mark (`Math.max`) to prevent layout jumping during pagination
- `resetHeight()` resets the high-water-mark to 0 (used when filter/group changes)

Replaces the identical `listRef + listMinHeight` block currently duplicated in:
- `AssetWatchlist.tsx`
- `AssetSignals.tsx`
- `Watchlist.tsx`

---

## File Change Summary

| Action | File |
|--------|------|
| Create | `web/src/components/AssetPage.tsx` |
| Create | `web/src/lib/useStableListHeight.ts` |
| Modify | `web/src/pages/TwStocks.tsx` |
| Modify | `web/src/pages/UsStocks.tsx` |
| Modify | `web/src/pages/Crypto.tsx` |
| Modify | `web/src/pages/Fx.tsx` |
| Modify | `web/src/pages/Recommendations.tsx` |
| Modify | `web/src/components/AssetWatchlist.tsx` |
| Modify | `web/src/components/AssetSignals.tsx` |
| Modify | `web/src/pages/Watchlist.tsx` |
| Delete | `web/src/pages/Signals.tsx` |
