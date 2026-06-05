# Watchlist Client-side Pagination Design

**Date:** 2026-06-05
**Scope:** `web/` — Tailwind CSS + shadcn/ui setup, then `web/src/pages/Watchlist.tsx` pagination.

---

## Overview

Two parts:
1. **Install Tailwind CSS + shadcn/ui** into `web/` — replaces hand-written inline styles going forward.
2. **Add client-side pagination** to the Watchlist page using shadcn/ui's `<Pagination>` and `<Select>` components. All data is loaded from the API in one request; pagination slices the in-memory list for display. No server-side changes are needed.

## UI Framework

| Package | Purpose |
|---|---|
| `tailwindcss` + `@tailwindcss/vite` | Utility-first CSS, replaces inline styles |
| `shadcn/ui` | Component primitives built on Radix UI (accessible by default) |

Components used for pagination:
- `shadcn/ui Pagination` — prev/next buttons + page info
- `shadcn/ui Select` — page size selector (10 / 20 / 50)

---

## State

Two new state variables added to `Watchlist.tsx`:

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `currentPage` | `number` | `1` | Active page index (1-based) |
| `pageSize` | `number` | `20` | Items displayed per page |

---

## Derived Values

```ts
const totalPages = Math.ceil(filteredItems.length / pageSize);
const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
```

`filteredItems` is the existing group-tab-filtered list. `pagedItems` replaces `filteredItems` in the render loop.

---

## Reset Rules

`currentPage` resets to `1` when:
- The active group tab changes (`activeGroupId` changes)
- `pageSize` changes

After a delete, if `currentPage > totalPages`, clamp to `Math.max(1, totalPages)`.

---

## UI — Pagination Bar

Placed **below** the stock list. Layout (left to right):

```
[每頁 [10▾]] [← 上一頁] [第 1 / 3 頁（共 45 筆）] [下一頁 →]
```

### Behaviour

- **Page size selector:** `<select>` with options `10 / 20 / 50`. Changing resets to page 1.
- **上一頁:** disabled when `currentPage === 1`.
- **下一頁:** disabled when `currentPage === totalPages` or `totalPages === 0`.
- **Page info text:** `第 {currentPage} / {totalPages} 頁（共 {filteredItems.length} 筆）`
- Hidden entirely when `filteredItems.length === 0`.

### Style

Use shadcn/ui `<Pagination>` and `<Select>` components — accessibility (keyboard nav, ARIA, disabled states) handled by Radix UI underneath. Tailwind classes for layout/spacing.

---

## Out of Scope

- Migrating existing inline styles on other pages to Tailwind (only Watchlist pagination uses Tailwind/shadcn for now)
- Search and filter (explicitly excluded)
- Server-side pagination
- Pagination on Signals, Recommendations, or AlgorithmLibrary pages
- Extracting a shared `usePagination` hook
