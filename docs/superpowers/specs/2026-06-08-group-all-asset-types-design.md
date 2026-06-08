# Group Architecture for All Asset Types

**Date:** 2026-06-08  
**Status:** Approved  
**Scope:** Add full group support (tabs, filter, assign, create/delete, bulk import, batch apply template) to US stocks, crypto, and exchange rates — matching the existing Taiwan stocks implementation.

---

## Background

Taiwan stocks (`tw_stock`) already have a complete group system in `Watchlist.tsx`:
- Group tabs navigation with active filter
- Assign items to groups via `GroupPicker`
- Create / delete groups
- Bulk import symbols into a group
- Batch apply algorithm template to a group

US stocks, crypto, and FX use `AssetWatchlist.tsx`, which has none of this. This spec covers extending group support to all four asset types.

---

## Key Decision: Per-Asset Groups

Groups will be **scoped per asset type**. A "Tech" group in US stocks is independent from a "Tech" group in Taiwan stocks.

- Requires adding an `asset_type` column to the `groups` table
- Existing Taiwan stock groups default to `asset_type = 'tw_stock'` (backward-compatible migration)
- The API filters groups by `asset_type` on read and write

This avoids cross-asset group pollution and keeps each asset page self-contained.

---

## Architecture

### 1. DB Migration

**File:** `api/migrations/0007_groups_asset_type.sql`

```sql
ALTER TABLE groups ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'tw_stock';
```

Existing rows become `tw_stock` groups automatically. No data loss.

### 2. API — `groups.ts`

**`GET /groups?asset_type=`**  
Add a `WHERE asset_type = ?` clause when the query param is present (required for all callers going forward).

**`POST /groups`**  
Accept `asset_type` in the request body and store it. Validation: must be one of `tw_stock | us_stock | crypto | fx`.

No changes needed to:
- `DELETE /groups/:id`
- `PUT /groups/:id/batch-apply-template`
- `PUT /watchlist/:id/groups`

### 3. Frontend — `api/client.ts`

```typescript
getGroups: (assetType: AssetType) => request(`/groups?asset_type=${assetType}`)
createGroup: (name: string, assetType: AssetType) =>
  request('/groups', { method: 'POST', body: { name, asset_type: assetType } })
```

### 4. Frontend — `BulkImport.tsx`

Add an `assetType: AssetType` prop. Use a lookup table to resolve the right symbol list:

```typescript
const DATA_BY_TYPE: Record<AssetType, { symbol: string; name: string }[]> = {
  tw_stock: stocksData,   // stocks.json
  us_stock: usStocksData, // us-stocks.json
  crypto: CRYPTO_LIST,    // data/crypto.ts
  fx: FX_PAIRS,           // data/fx.ts
};
```

Pass `assetType` to `api.addStock()` so new items are created with the correct type.

### 5. Frontend — Unified `Watchlist.tsx`

Merge `Watchlist.tsx` (Taiwan stocks, full group support) and `AssetWatchlist.tsx` (other assets, no groups) into a single component.

The unified component:
- Receives `assetType: AssetType` (already exists on both)
- Calls `api.getGroups(assetType)` — per-asset groups
- Renders the full group UI (tabs, filter, assign, create, delete, bulk import, batch apply template) for **all** asset types
- Search: `StockSearch` for `tw_stock`; `AssetSearch` for the rest
- Bulk import: `BulkImport` with the new `assetType` prop for all types

No conditional rendering of group features — all asset types get the full group experience.

### 6. `AssetPage.tsx`

Remove the `WatchlistComponent` prop. `AssetPage` renders `<Watchlist>` directly.

```typescript
// Before
interface Props {
  WatchlistComponent: React.ComponentType<WatchlistProps>;
  ...
}

// After
// AssetPage renders <Watchlist assetType={assetType} ... /> directly
```

### 7. Page Components

`TwStocks.tsx`, `UsStocks.tsx`, `Crypto.tsx`, `Fx.tsx` — remove the `WatchlistComponent` prop. No other changes.

### 8. Deleted File

`web/src/components/AssetWatchlist.tsx` — fully replaced by the unified `Watchlist.tsx`.

---

## File Change Summary

| Action | File |
|--------|------|
| Add    | `api/migrations/0007_groups_asset_type.sql` |
| Modify | `api/src/routes/groups.ts` |
| Modify | `web/src/api/client.ts` |
| Modify | `web/src/components/BulkImport.tsx` |
| Modify | `web/src/pages/Watchlist.tsx` (becomes unified) |
| Modify | `web/src/components/AssetPage.tsx` |
| Modify | `web/src/pages/TwStocks.tsx` |
| Modify | `web/src/pages/UsStocks.tsx` |
| Modify | `web/src/pages/Crypto.tsx` |
| Modify | `web/src/pages/Fx.tsx` |
| Delete | `web/src/components/AssetWatchlist.tsx` |
| Modify | `api/test/groups.test.ts` (add asset_type tests) |

---

## What Does NOT Change

- DB tables: `watchlist`, `watchlist_groups`, `algorithms`, `algorithm_templates` — no changes
- API routes: watchlist CRUD, signals, algorithms — no changes
- `GroupPicker.tsx` — no changes needed
- `AlgorithmTemplatePicker.tsx` — no changes needed
- The scheduler / fetcher layer — no changes

---

## Error Handling

- `POST /groups` with missing or invalid `asset_type` → 400
- `GET /groups` without `asset_type` → return all groups (backward compatible, but all internal callers should pass it)

---

## Testing

- `api/test/groups.test.ts`: add test cases for `asset_type` filtering — creating groups of different types and verifying `GET /groups?asset_type=` only returns the right subset
- Manual UI smoke test: create a group in each of the 4 asset pages, verify it does not appear in the other pages
