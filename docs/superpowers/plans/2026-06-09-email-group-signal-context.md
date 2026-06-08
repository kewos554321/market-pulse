# Email Group & Signal Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each triggered stock's group/tag names and real condition labels in the signal alert email (instead of the hardcoded `條件符合`).

**Architecture:** All required data is already available — the `/watchlist` response includes `groups`, and `conditions_snapshot` holds the full `ConditionTree`. We add a pure `describeConditionTree` function to convert the tree to human-readable labels, extend `SignalSummary` with a `groups` field, and update the email template.

**Tech Stack:** TypeScript, Vitest (scheduler/test/), Resend (email), Hono API (Cloudflare Workers)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `scheduler/src/notify.ts` | Modify | Add `groups` to `SignalSummary`; add exported `describeConditionTree`; update HTML template |
| `scheduler/src/index.ts` | Modify | Extend `WatchlistItem` with `groups`; pass group names + condition labels to `sendSignalEmail` and LINE |
| `scheduler/test/notify.test.ts` | Create | Unit tests for `describeConditionTree` |

---

### Task 1: Add `describeConditionTree` with tests (TDD)

**Files:**
- Create: `scheduler/test/notify.test.ts`
- Modify: `scheduler/src/notify.ts`

- [ ] **Step 1: Write the failing tests**

Create `scheduler/test/notify.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { describeConditionTree } from '../src/notify';

describe('describeConditionTree', () => {
  it('RSI leaf with op and value', () => {
    expect(describeConditionTree({ indicator: 'RSI', op: '<', value: 30 }))
      .toEqual(['RSI(14) < 30']);
  });

  it('CLOSE with MA ref', () => {
    expect(describeConditionTree({ indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 }))
      .toEqual(['收盤 > MA20']);
  });

  it('CLOSE with absolute value', () => {
    expect(describeConditionTree({ indicator: 'CLOSE', op: '>=', value: 150 }))
      .toEqual(['收盤 >= 150']);
  });

  it('MA with period and value', () => {
    expect(describeConditionTree({ indicator: 'MA', period: 5, op: '>', value: 100 }))
      .toEqual(['MA5 > 100']);
  });

  it('MA defaults to period 20', () => {
    expect(describeConditionTree({ indicator: 'MA', op: '>', value: 50 }))
      .toEqual(['MA20 > 50']);
  });

  it('VOLUME with MA_VOLUME ref', () => {
    expect(describeConditionTree({ indicator: 'VOLUME', op: '>', ref: 'MA_VOLUME', multiplier: 2 }))
      .toEqual(['成交量 > 均量×2']);
  });

  it('VOLUME with absolute value', () => {
    expect(describeConditionTree({ indicator: 'VOLUME', op: '>', value: 5000 }))
      .toEqual(['成交量 > 5000']);
  });

  it('MACD_CROSS golden', () => {
    expect(describeConditionTree({ indicator: 'MACD_CROSS', direction: 'golden' }))
      .toEqual(['MACD 黃金交叉']);
  });

  it('MACD_CROSS dead', () => {
    expect(describeConditionTree({ indicator: 'MACD_CROSS', direction: 'dead' }))
      .toEqual(['MACD 死亡交叉']);
  });

  it('KD_CROSS golden', () => {
    expect(describeConditionTree({ indicator: 'KD_CROSS', direction: 'golden' }))
      .toEqual(['KD 黃金交叉']);
  });

  it('KD_CROSS dead', () => {
    expect(describeConditionTree({ indicator: 'KD_CROSS', direction: 'dead' }))
      .toEqual(['KD 死亡交叉']);
  });

  it('MA_CROSS golden', () => {
    expect(describeConditionTree({ indicator: 'MA_CROSS', direction: 'golden' }))
      .toEqual(['MA5/20 黃金交叉']);
  });

  it('MA_CROSS dead', () => {
    expect(describeConditionTree({ indicator: 'MA_CROSS', direction: 'dead' }))
      .toEqual(['MA5/20 死亡交叉']);
  });

  it('BB_LOWER', () => {
    expect(describeConditionTree({ indicator: 'BB_LOWER' }))
      .toEqual(['收盤 ≤ 布林下軌']);
  });

  it('BB_UPPER', () => {
    expect(describeConditionTree({ indicator: 'BB_UPPER' }))
      .toEqual(['收盤 ≥ 布林上軌']);
  });

  it('AND tree flattens all leaf labels', () => {
    expect(describeConditionTree({
      operator: 'AND',
      conditions: [
        { indicator: 'RSI', op: '<', value: 30 },
        { indicator: 'MACD_CROSS', direction: 'golden' },
      ],
    })).toEqual(['RSI(14) < 30', 'MACD 黃金交叉']);
  });

  it('OR tree flattens all leaf labels', () => {
    expect(describeConditionTree({
      operator: 'OR',
      conditions: [
        { indicator: 'KD_CROSS', direction: 'golden' },
        { indicator: 'BB_LOWER' },
      ],
    })).toEqual(['KD 黃金交叉', '收盤 ≤ 布林下軌']);
  });

  it('nested tree flattens recursively', () => {
    expect(describeConditionTree({
      operator: 'AND',
      conditions: [
        { indicator: 'RSI', op: '<', value: 30 },
        {
          operator: 'OR',
          conditions: [
            { indicator: 'MACD_CROSS', direction: 'golden' },
            { indicator: 'BB_LOWER' },
          ],
        },
      ],
    })).toEqual(['RSI(14) < 30', 'MACD 黃金交叉', '收盤 ≤ 布林下軌']);
  });
});
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd scheduler && npm test -- notify
```

Expected: all tests FAIL with "describeConditionTree is not exported from notify"

- [ ] **Step 3: Add `describeConditionTree` to `scheduler/src/notify.ts`**

Add these imports and the function **before** the existing `sendSignalEmail` export:

```ts
import type { ConditionLeaf, ConditionTree } from './types.js';

type Condition = ConditionLeaf | ConditionTree;

function isTree(c: Condition): c is ConditionTree {
  return 'operator' in c;
}

function describeLeaf(c: ConditionLeaf): string {
  switch (c.indicator) {
    case 'RSI':
      return `RSI(14) ${c.op} ${c.value}`;
    case 'CLOSE':
      if (c.ref === 'MA') return `收盤 ${c.op} MA${c.period ?? 20}`;
      return `收盤 ${c.op} ${c.value}`;
    case 'MA':
      return `MA${c.period ?? 20} ${c.op} ${c.value}`;
    case 'VOLUME':
      if (c.ref === 'MA_VOLUME') return `成交量 ${c.op} 均量×${c.multiplier ?? 1}`;
      return `成交量 ${c.op} ${c.value}`;
    case 'MACD_CROSS':
      return c.direction === 'golden' ? 'MACD 黃金交叉' : 'MACD 死亡交叉';
    case 'KD_CROSS':
      return c.direction === 'golden' ? 'KD 黃金交叉' : 'KD 死亡交叉';
    case 'MA_CROSS':
      return c.direction === 'golden' ? 'MA5/20 黃金交叉' : 'MA5/20 死亡交叉';
    case 'BB_LOWER':
      return '收盤 ≤ 布林下軌';
    case 'BB_UPPER':
      return '收盤 ≥ 布林上軌';
    default:
      return (c as ConditionLeaf).indicator;
  }
}

export function describeConditionTree(condition: Condition): string[] {
  if (isTree(condition)) {
    return condition.conditions.flatMap((c) => describeConditionTree(c));
  }
  return [describeLeaf(condition)];
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd scheduler && npm test -- notify
```

Expected: all 19 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scheduler/src/notify.ts scheduler/test/notify.test.ts
git commit -m "feat: add describeConditionTree for human-readable condition labels"
```

---

### Task 2: Update `SignalSummary` and email template

**Files:**
- Modify: `scheduler/src/notify.ts`

- [ ] **Step 1: Update `SignalSummary` interface**

In `scheduler/src/notify.ts`, change:

```ts
export interface SignalSummary {
  symbol: string;
  name: string;
  closePrice: number;
  triggeredConditions: string[];
}
```

to:

```ts
export interface SignalSummary {
  symbol: string;
  name: string;
  closePrice: number;
  triggeredConditions: string[];
  groups: string[];
}
```

- [ ] **Step 2: Update the email HTML template**

In `scheduler/src/notify.ts`, replace the `listHtml` map block:

```ts
// Old:
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
```

with:

```ts
// New:
const listHtml = signals
  .map(
    (s) => `
    <li style="margin-bottom:12px">
      <strong>${s.symbol} ${s.name}</strong><br/>
      收盤價：${s.closePrice}<br/>
      ${s.groups.length > 0 ? `群組：${s.groups.join('、')}<br/>` : ''}
      觸發條件：${s.triggeredConditions.join('、')}
    </li>`
  )
  .join('');
```

- [ ] **Step 3: Run all tests to ensure nothing is broken**

```bash
cd scheduler && npm test
```

Expected: all existing tests PASS (TypeScript will catch the missing `groups` field in the next task)

- [ ] **Step 4: Commit**

```bash
git add scheduler/src/notify.ts
git commit -m "feat: add groups field to SignalSummary and update email template"
```

---

### Task 3: Wire groups and condition labels in `index.ts`

**Files:**
- Modify: `scheduler/src/index.ts`

- [ ] **Step 1: Extend `WatchlistItem` to include groups**

In `scheduler/src/index.ts`, change:

```ts
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
}
```

to:

```ts
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
  groups: { id: string; name: string }[];
}
```

- [ ] **Step 2: Import `describeConditionTree` from notify**

Add `describeConditionTree` to the existing import from `./notify.js`:

```ts
// Old:
import { sendSignalEmail } from './notify.js';

// New:
import { sendSignalEmail, describeConditionTree } from './notify.js';
```

- [ ] **Step 3: Add `groups` and `triggeredConditions` to the `triggeredSignals` push**

In `runWatchlistScan`, change the type definition of `triggeredSignals`:

```ts
// Old:
const triggeredSignals: {
  watchlist_id: string;
  symbol: string;
  close_price: number;
  conditions_snapshot: unknown;
  name: string;
}[] = [];
```

to:

```ts
// New:
const triggeredSignals: {
  watchlist_id: string;
  symbol: string;
  close_price: number;
  conditions_snapshot: unknown;
  name: string;
  groups: string[];
  triggeredConditions: string[];
}[] = [];
```

- [ ] **Step 4: Pass groups and condition labels when pushing a triggered signal**

In `runWatchlistScan`, change the `.push(...)` call:

```ts
// Old:
triggeredSignals.push({
  watchlist_id: item.id,
  symbol: item.symbol,
  close_price: closePrice,
  conditions_snapshot: algo.conditions,
  name: item.name,
});
```

to:

```ts
// New:
triggeredSignals.push({
  watchlist_id: item.id,
  symbol: item.symbol,
  close_price: closePrice,
  conditions_snapshot: algo.conditions,
  name: item.name,
  groups: item.groups.map((g) => g.name),
  triggeredConditions: describeConditionTree(algo.conditions),
});
```

- [ ] **Step 5: Update `sendSignalEmail` call to pass real data**

In `runWatchlistScan`, change:

```ts
// Old:
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
```

to:

```ts
// New:
await sendSignalEmail(
  RESEND_API_KEY,
  notifyEmails,
  today,
  triggeredSignals.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    closePrice: s.close_price,
    triggeredConditions: s.triggeredConditions,
    groups: s.groups,
  }))
);
```

- [ ] **Step 6: Update `sendLineGroupMessage` call similarly**

In `runWatchlistScan`, change:

```ts
// Old:
await sendLineGroupMessage(
  lineToken,
  lineGroupId,
  today,
  triggeredSignals.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    closePrice: s.close_price,
    triggeredConditions: ['條件符合'],
  }))
);
```

to:

```ts
// New:
await sendLineGroupMessage(
  lineToken,
  lineGroupId,
  today,
  triggeredSignals.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    closePrice: s.close_price,
    triggeredConditions: s.triggeredConditions,
    groups: s.groups,
  }))
);
```

Note: `scheduler/src/line.ts` imports `SignalSummary` directly from `notify.ts`, so it automatically gets the `groups` field. The LINE message text only renders `triggeredConditions` (no group display needed for LINE — text format constraint). Passing real `triggeredConditions` here replaces the hardcoded `'條件符合'` in LINE messages too.

- [ ] **Step 7: Run all tests**

```bash
cd scheduler && npm test
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add scheduler/src/index.ts
git commit -m "feat: wire group names and real condition labels into signal emails"
```
