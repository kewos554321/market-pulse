# Watchlist Client-side Pagination Design

**Date:** 2026-06-05
**Scope:** `web/src/pages/Watchlist.tsx` only — no API changes required.

---

## Overview

Add client-side pagination to the Watchlist page. All data is already loaded from the API in one request; pagination slices the in-memory list for display. No server-side changes are needed.

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

Reuse existing button style: `background: #f1f5f9`, `color: #374151`, `border: none`, `borderRadius: 6px`, `padding: 6px 12px`, `fontSize: 12px`. Disabled state: `opacity: 0.4`, `cursor: not-allowed`.

---

## Out of Scope

- Search and filter (explicitly excluded)
- Server-side pagination
- Pagination on Signals, Recommendations, or AlgorithmLibrary pages
- Extracting a shared `usePagination` hook or `<Pagination>` component
