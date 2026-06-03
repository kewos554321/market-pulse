# 語意化訊號選擇器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將算法編輯器從下拉模板改為格狀訊號選擇介面，使用者只需點選語意化訊號（如「收盤突破均線」），系統自動轉換成 ConditionTree，底部保留「進階模式」按鈕切換回現有 ConditionBuilder。

**Architecture:** 新增 `signals.ts` 定義 7 種訊號及其與 ConditionTree 的雙向轉換邏輯；新增 `PresetSignalPicker` 元件實作格狀 UI；更新 `AlgorithmEditor` 以 preset/advanced 兩種模式切換，載入時自動判斷模式。DB 格式不變，仍存 ConditionTree。

**Tech Stack:** React 18, TypeScript, 無額外套件

---

## 檔案結構

| 動作 | 檔案 | 說明 |
|---|---|---|
| 新增 | `web/src/data/signals.ts` | 7 種訊號定義、buildTree、parsePresets |
| 新增 | `web/src/components/PresetSignalPicker.tsx` | 格狀選訊號 UI 元件 |
| 修改 | `web/src/pages/AlgorithmEditor.tsx` | 替換 STRATEGY_TEMPLATES，加 mode 切換 |

---

### Task 1: signals.ts — 訊號定義與雙向轉換

**Files:**
- Create: `web/src/data/signals.ts`

- [ ] **Step 1: 建立 signals.ts**

```ts
import type { ConditionLeaf, ConditionTree } from '../types';

export interface SignalParam {
  key: string;
  label: string;
  options: { value: number; label: string }[];
  default: number;
}

export interface SignalDef {
  id: string;
  name: string;
  description: string;
  params: SignalParam[];
  toCondition: (params: Record<string, number>) => ConditionLeaf;
  matchCondition: (leaf: ConditionLeaf) => Record<string, number> | null;
}

const MA_PERIOD_PARAM: SignalParam = {
  key: 'period',
  label: '均線週期',
  options: [
    { value: 5, label: 'MA5' },
    { value: 10, label: 'MA10' },
    { value: 20, label: 'MA20' },
    { value: 60, label: 'MA60' },
  ],
  default: 20,
};

export const SIGNALS: SignalDef[] = [
  {
    id: 'ma-breakout',
    name: '收盤突破均線',
    description: '收盤價向上穿越移動平均線',
    params: [MA_PERIOD_PARAM],
    toCondition: (p) => ({ indicator: 'CLOSE', op: '>', ref: 'MA', period: p.period }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'CLOSE' && leaf.op === '>' && leaf.ref === 'MA' && leaf.period != null)
        return { period: leaf.period };
      return null;
    },
  },
  {
    id: 'ma-breakdown',
    name: '收盤跌破均線',
    description: '收盤價向下穿越移動平均線',
    params: [MA_PERIOD_PARAM],
    toCondition: (p) => ({ indicator: 'CLOSE', op: '<', ref: 'MA', period: p.period }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'CLOSE' && leaf.op === '<' && leaf.ref === 'MA' && leaf.period != null)
        return { period: leaf.period };
      return null;
    },
  },
  {
    id: 'rsi-oversold',
    name: 'RSI 超賣',
    description: 'RSI(14) < 30，可能超跌反彈',
    params: [],
    toCondition: () => ({ indicator: 'RSI', period: 14, op: '<', value: 30 }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'RSI' && leaf.op === '<' && leaf.value === 30) return {};
      return null;
    },
  },
  {
    id: 'rsi-overbought',
    name: 'RSI 超買',
    description: 'RSI(14) > 70，可能過熱回落',
    params: [],
    toCondition: () => ({ indicator: 'RSI', period: 14, op: '>', value: 70 }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'RSI' && leaf.op === '>' && leaf.value === 70) return {};
      return null;
    },
  },
  {
    id: 'kd-golden',
    name: 'KD 黃金交叉',
    description: 'K 線由下往上穿越 D 線，短期買入訊號',
    params: [],
    toCondition: () => ({ indicator: 'KD_CROSS', direction: 'golden' }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'KD_CROSS' && leaf.direction === 'golden') return {};
      return null;
    },
  },
  {
    id: 'kd-dead',
    name: 'KD 死亡交叉',
    description: 'K 線由上往下穿越 D 線，短期賣出訊號',
    params: [],
    toCondition: () => ({ indicator: 'KD_CROSS', direction: 'dead' }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'KD_CROSS' && leaf.direction === 'dead') return {};
      return null;
    },
  },
  {
    id: 'macd-golden',
    name: 'MACD 黃金交叉',
    description: 'MACD 線穿越訊號線向上',
    params: [],
    toCondition: () => ({ indicator: 'MACD_CROSS', direction: 'golden' }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'MACD_CROSS' && leaf.direction === 'golden') return {};
      return null;
    },
  },
];

export interface SignalSelection {
  signalId: string;
  params: Record<string, number>;
}

export function buildTree(selections: SignalSelection[]): ConditionTree {
  return {
    operator: 'OR',
    conditions: selections.map(({ signalId, params }) => {
      const def = SIGNALS.find((s) => s.id === signalId)!;
      return def.toCondition(params);
    }),
  };
}

export function parsePresets(tree: ConditionTree): SignalSelection[] | null {
  if (tree.operator !== 'OR') return null;
  if (tree.conditions.length === 0) return [];
  const selections: SignalSelection[] = [];
  for (const condition of tree.conditions) {
    if ('operator' in condition) return null;
    let matched = false;
    for (const def of SIGNALS) {
      const params = def.matchCondition(condition);
      if (params !== null) {
        selections.push({ signalId: def.id, params });
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return selections;
}
```

- [ ] **Step 2: TypeScript 編譯確認**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add web/src/data/signals.ts
git commit -m "feat: add signals.ts with 7 preset signal definitions"
```

---

### Task 2: PresetSignalPicker 元件

**Files:**
- Create: `web/src/components/PresetSignalPicker.tsx`

- [ ] **Step 1: 建立 PresetSignalPicker.tsx**

```tsx
import { useState } from 'react';
import { SIGNALS, buildTree, parsePresets } from '../data/signals';
import type { SignalSelection } from '../data/signals';
import type { ConditionTree } from '../types';

interface Props {
  value: ConditionTree;
  onChange: (tree: ConditionTree) => void;
}

export function PresetSignalPicker({ value, onChange }: Props) {
  const [selections, setSelections] = useState<SignalSelection[]>(
    () => parsePresets(value) ?? []
  );

  function isSelected(signalId: string) {
    return selections.some((s) => s.signalId === signalId);
  }

  function getParams(signalId: string): Record<string, number> {
    return selections.find((s) => s.signalId === signalId)?.params ?? {};
  }

  function toggleSignal(signalId: string) {
    const def = SIGNALS.find((s) => s.id === signalId)!;
    let next: SignalSelection[];
    if (isSelected(signalId)) {
      next = selections.filter((s) => s.signalId !== signalId);
    } else {
      const defaultParams: Record<string, number> = {};
      def.params.forEach((p) => { defaultParams[p.key] = p.default; });
      next = [...selections, { signalId, params: defaultParams }];
    }
    setSelections(next);
    onChange(buildTree(next));
  }

  function updateParam(signalId: string, key: string, val: number) {
    const next = selections.map((s) =>
      s.signalId === signalId ? { ...s, params: { ...s.params, [key]: val } } : s
    );
    setSelections(next);
    onChange(buildTree(next));
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {SIGNALS.map((def) => {
          const selected = isSelected(def.id);
          const params = getParams(def.id);
          return (
            <div
              key={def.id}
              onClick={() => toggleSignal(def.id)}
              style={{
                padding: '14px', borderRadius: '8px', cursor: 'pointer',
                border: `1.5px solid ${selected ? '#6366f1' : 'transparent'}`,
                background: selected ? '#eff6ff' : '#f8fafc',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                  background: selected ? '#6366f1' : 'transparent',
                  border: selected ? 'none' : '1.5px solid #d1d5db',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: selected ? '#6366f1' : '#374151' }}>
                  {def.name}
                </span>
              </div>
              <p style={{ margin: selected && def.params.length > 0 ? '0 0 8px' : 0, fontSize: '11px', color: selected ? '#64748b' : '#94a3b8' }}>
                {def.description}
              </p>
              {selected && def.params.map((param) => (
                <select
                  key={param.key}
                  value={params[param.key] ?? param.default}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); updateParam(def.id, param.key, Number(e.target.value)); }}
                  style={{
                    fontSize: '11px', border: '1px solid #c7d2fe', borderRadius: '4px',
                    padding: '3px 6px', color: '#374151', background: '#fff', width: '100%',
                  }}
                >
                  {param.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ))}
            </div>
          );
        })}
      </div>

      {selections.length > 0 ? (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '4px' }}>
            已選訊號（觸發任一即通知）
          </div>
          {selections.map((s) => {
            const def = SIGNALS.find((d) => d.id === s.signalId)!;
            const paramLabel = def.params.map((p) => {
              const opt = p.options.find((o) => o.value === s.params[p.key]);
              return opt?.label ?? s.params[p.key];
            }).join(', ');
            return (
              <div key={s.signalId} style={{ fontSize: '12px', color: '#374151' }}>
                ✓ {def.name}{paramLabel ? ` (${paramLabel})` : ''}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: '16px', textAlign: 'center', color: '#94a3b8',
          fontSize: '13px', border: '1px dashed #e2e8f0', borderRadius: '8px',
        }}>
          請選擇至少一個訊號
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 編譯確認**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add web/src/components/PresetSignalPicker.tsx
git commit -m "feat: add PresetSignalPicker grid component"
```

---

### Task 3: 更新 AlgorithmEditor.tsx

**Files:**
- Modify: `web/src/pages/AlgorithmEditor.tsx`

- [ ] **Step 1: 替換 AlgorithmEditor.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { parsePresets } from '../data/signals';
import type { ConditionTree, WatchlistItem } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stock, setStock] = useState<WatchlistItem | null>(null);
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getWatchlist().then((list) => setStock(list.find((s) => s.id === id) ?? null));
    api.getAlgorithm(id)
      .then((algo) => {
        setConditions(algo.conditions);
        setMode(parsePresets(algo.conditions) !== null ? 'preset' : 'advanced');
      })
      .catch(() => {
        setConditions(emptyTree);
        setMode('preset');
      });
  }, [id]);

  async function handleSave() {
    if (!id) return;
    await api.saveAlgorithm(id, conditions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <button
        onClick={() => navigate('/watchlist')}
        style={{
          background: 'none', border: 'none', color: '#6366f1', fontSize: '13px',
          cursor: 'pointer', padding: '0', marginBottom: '16px', fontWeight: 500,
        }}
      >
        ← 返回清單
      </button>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
          算法設定
        </h1>
        {stock && (
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            {stock.symbol} {stock.name}
          </p>
        )}
      </div>

      <div style={{
        background: '#fff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
        marginBottom: '16px',
      }}>
        {mode === 'preset' ? (
          <PresetSignalPicker value={conditions} onChange={setConditions} />
        ) : (
          <ConditionBuilder conditions={conditions} onChange={setConditions} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          style={{
            background: '#6366f1', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '10px 24px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          儲存算法
        </button>
        {saved && (
          <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>
        )}
        <button
          onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
          style={{
            background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px',
            cursor: 'pointer', padding: '0', marginLeft: 'auto',
          }}
        >
          {mode === 'preset' ? '⚙ 進階模式（自訂條件數值）' : '← 回到訊號選擇'}
        </button>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '12px', userSelect: 'none' }}>
          查看 JSON
        </summary>
        <pre style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
          padding: '16px', fontSize: '12px', overflow: 'auto', marginTop: '8px', color: '#374151',
        }}>
          {JSON.stringify(conditions, null, 2)}
        </pre>
      </details>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 編譯確認**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 3: 本地測試**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npm run dev
```

打開 http://localhost:5173/watchlist，點任一股票的「設定算法」，確認：
- 預設顯示 7 個訊號格子
- 點「收盤突破均線」→ 藍框 + 顯示均線週期下拉
- 下方摘要顯示「已選訊號」
- 按「⚙ 進階模式」切換到 ConditionBuilder
- 按「← 回到訊號選擇」切換回來
- 舊的 CLOSE > 0 條件載入時自動進入進階模式（parsePresets 無法解析）

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/AlgorithmEditor.tsx
git commit -m "feat: replace template dropdown with PresetSignalPicker grid"
```

---

### Task 4: Build + 部署

**Files:**
- No file changes

- [ ] **Step 1: Build**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npm run build 2>&1
```

Expected: `✓ built in ...ms`，無錯誤

- [ ] **Step 2: 部署**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx wrangler pages deploy dist --project-name market-pulse-web --commit-dirty=true 2>&1
```

Expected: `Deployment complete!`

- [ ] **Step 3: Push**

```bash
git push
```
