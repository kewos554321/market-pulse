# Email Group & Signal Context — Design Spec

**Date:** 2026-06-08  
**Status:** Draft

---

## Problem

The daily/hourly signal email currently shows each triggered stock with:
- Symbol + name
- Close price
- `觸發條件：條件符合` (hardcoded, meaningless)

Missing information:
1. **Which groups/tags the stock belongs to** — the user sets up groups (e.g., "科技股", "長期追蹤") and wants to know why a stock appeared
2. **Which conditions actually triggered** — currently always "條件符合"; the actual `ConditionTree` is stored in `conditions_snapshot` but never rendered

---

## Context

### Data already available

- `GET /watchlist?asset_type=X` returns each item with a `groups: [{id, name}]` array — no extra API calls needed
- `conditions_snapshot` on each triggered signal is the full `ConditionTree` JSON, which contains `indicator`, `op`, `value`, `period`, `direction` etc.
- `ConditionLeaf` indicators: `RSI`, `MA`, `CLOSE`, `VOLUME`, `KD_CROSS`, `MACD_CROSS`, `MA_CROSS`, `BB_LOWER`, `BB_UPPER`

### Current flow (`scheduler/src/index.ts`)

```
fetch /watchlist → filter enabled → for each item:
  fetch algorithm → evaluate indicators → if triggered → push to triggeredSignals
→ POST /signals
→ sendSignalEmail (groups = none, triggeredConditions = ['條件符合'])
```

---

## Design

### 1. Pass groups from watchlist response

`WatchlistItem` already has groups available from the API response; the interface in `index.ts` just doesn't include them. Extend it:

```ts
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
  groups: { id: string; name: string }[];   // ← add
}
```

When building `triggeredSignals`, include the group names:

```ts
triggeredSignals.push({
  // ...existing fields...
  groups: item.groups.map((g) => g.name),
});
```

### 2. Human-readable condition labels

Add a pure function `describeConditionTree(tree: ConditionTree): string[]` in `scheduler/src/notify.ts` (or a new `scheduler/src/condition-labels.ts`).

It walks the tree and converts each leaf to a short label:

| Indicator | Label example |
|-----------|--------------|
| `RSI < 30` | `RSI(14) < 30` |
| `CLOSE > MA(20)` | `收盤 > MA20` |
| `MA(5) > value` | `MA5 > 150` |
| `MACD_CROSS golden` | `MACD 黃金交叉` |
| `KD_CROSS golden` | `KD 黃金交叉` |
| `KD_CROSS dead` | `KD 死亡交叉` |
| `MA_CROSS golden` | `MA5/20 黃金交叉` |
| `BB_LOWER` | `收盤 ≤ 布林下軌` |
| `BB_UPPER` | `收盤 ≥ 布林上軌` |
| `VOLUME > MA_VOLUME * 2` | `成交量 > 均量×2` |

The function returns a flat `string[]` — AND/OR tree structure is flattened; the top-level operator can be shown as a prefix if desired (e.g., `AND: [...]`). For the email, listing leaf labels is sufficient.

### 3. Update `SignalSummary`

```ts
export interface SignalSummary {
  symbol: string;
  name: string;
  closePrice: number;
  triggeredConditions: string[];   // real labels, not '條件符合'
  groups: string[];                // group/tag names, may be empty
}
```

### 4. Email template update (`notify.ts`)

Each list item gains two new lines when data is present:

```
TSMC 台積電
收盤價：1000
群組：科技股、長期追蹤         ← new (only shown if groups.length > 0)
觸發條件：RSI(14) < 30、MA5/20 黃金交叉   ← real labels
```

HTML structure:

```html
<li>
  <strong>2330 台積電</strong><br/>
  收盤價：1000<br/>
  [if groups] 群組：科技股、長期追蹤<br/>
  觸發條件：RSI(14) &lt; 30、MA5/20 黃金交叉
</li>
```

---

## Affected Files

| File | Change |
|------|--------|
| `scheduler/src/index.ts` | Extend `WatchlistItem` with `groups`; pass group names and real condition labels to `sendSignalEmail` |
| `scheduler/src/notify.ts` | Add `groups` to `SignalSummary`; add `describeConditionTree`; update HTML template |
| `scheduler/src/types.ts` | No change needed |

No API changes required — the existing `GET /watchlist` response already includes groups.

---

## Out of Scope

- LINE message group/condition context (separate feature, similar approach)
- Per-recipient group filtering (showing only groups the recipient cares about)
- Changing how conditions are stored/evaluated

---

## Success Criteria

- Email shows group names for each triggered stock (empty = no bullet shown)
- `triggeredConditions` renders real indicator labels, not the hardcoded string
- No new API endpoints added
- No change to how signals are saved to DB
