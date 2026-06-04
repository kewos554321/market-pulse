# 追蹤清單群組功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者將追蹤清單股票分組（多對多 tag），並透過頂部 Tab 過濾，支援卡片上直接加/移除群組，以及批量貼入代號匯入群組。

**Architecture:** DB 新增 `groups` + `watchlist_groups` 兩張表；API 新增 groups CRUD 路由、PUT /watchlist/:id/groups 路由、更新 GET /watchlist 回傳 groups；前端 Watchlist 頁加 Tab 列、卡片 group tags、inline picker、BulkImport 元件。

**Tech Stack:** Cloudflare D1 (SQLite)、Hono、React 18、TypeScript

---

## 檔案結構

| 動作 | 檔案 | 說明 |
|---|---|---|
| 新增 | `api/migrations/0002_groups.sql` | groups + watchlist_groups 表 |
| 新增 | `api/src/routes/groups.ts` | GET/POST/DELETE /groups |
| 修改 | `api/src/routes/watchlist.ts` | 加 PUT /:id/groups、更新 GET / |
| 修改 | `api/src/index.ts` | 註冊 groupRoutes |
| 修改 | `web/src/types.ts` | 加 Group interface、WatchlistItem.groups |
| 修改 | `web/src/api/client.ts` | 加 getGroups/createGroup/deleteGroup/setWatchlistGroups |
| 新增 | `web/src/components/GroupPicker.tsx` | inline 群組選擇下拉 |
| 新增 | `web/src/components/BulkImport.tsx` | 批量匯入表單 |
| 修改 | `web/src/pages/Watchlist.tsx` | Tab + group tags + wiring |

---

### Task 1: DB Migration

**Files:**
- Create: `api/migrations/0002_groups.sql`

- [ ] **Step 1: 建立 migration 檔**

```sql
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist_groups (
  watchlist_id TEXT NOT NULL REFERENCES watchlist(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (watchlist_id, group_id)
);
```

- [ ] **Step 2: 套用到本地**

```bash
cd /Users/kewos/Documents/projects/market-pulse/api
npx wrangler d1 migrations apply market-pulse --local
```

Expected: `✅ 0002_groups.sql`

- [ ] **Step 3: 套用到 production**

```bash
npm run migrate:prod
```

Expected: `✅ 0002_groups.sql`

- [ ] **Step 4: Commit**

```bash
git add api/migrations/0002_groups.sql
git commit -m "feat: add groups and watchlist_groups tables"
```

---

### Task 2: API — groups 路由

**Files:**
- Create: `api/src/routes/groups.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: 建立 groups.ts**

```ts
import { Hono } from 'hono';
import { Env } from '../types';

interface GroupRow {
  id: string;
  name: string;
  created_at: string;
  count: number;
}

export const groupRoutes = new Hono<{ Bindings: Env }>();

groupRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.created_at, COUNT(wg.watchlist_id) as count
     FROM groups g
     LEFT JOIN watchlist_groups wg ON g.id = wg.group_id
     GROUP BY g.id
     ORDER BY g.created_at ASC`
  ).all<GroupRow>();
  return c.json(results);
});

groupRoutes.post('/', async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)'
  ).bind(id, name.trim(), now).run();
  return c.json({ id, name: name.trim(), created_at: now, count: 0 }, 201);
});

groupRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 2: 在 index.ts 註冊**

在 `api/src/index.ts` 加入：

```ts
import { groupRoutes } from './routes/groups';
// ...
app.route('/groups', groupRoutes);
```

- [ ] **Step 3: 煙霧測試**

```bash
cd /Users/kewos/Documents/projects/market-pulse/api && npx wrangler dev
```

```bash
curl -s http://localhost:8787/groups -H "X-API-Key: dev-secret-key-change-in-prod"
```

Expected: `[]`

```bash
curl -s -X POST http://localhost:8787/groups \
  -H "X-API-Key: dev-secret-key-change-in-prod" \
  -H "Content-Type: application/json" \
  -d '{"name":"AI概念"}'
```

Expected: `{"id":"...","name":"AI概念","count":0,...}`

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/groups.ts api/src/index.ts
git commit -m "feat: add groups API routes"
```

---

### Task 3: API — watchlist groups 路由 + 更新 GET /watchlist

**Files:**
- Modify: `api/src/routes/watchlist.ts`

- [ ] **Step 1: 更新 GET / 加入 groups（在 watchlist.ts 頂部加 interface）**

在 `watchlistRoutes.get('/', ...)` 替換成：

```ts
watchlistRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT w.id, w.symbol, w.name, w.enabled, w.created_at,
      COALESCE(
        json_group_array(
          CASE WHEN g.id IS NOT NULL
            THEN json_object('id', g.id, 'name', g.name)
            ELSE NULL
          END
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'
      ) as groups
     FROM watchlist w
     LEFT JOIN watchlist_groups wg ON w.id = wg.watchlist_id
     LEFT JOIN groups g ON wg.group_id = g.id
     GROUP BY w.id
     ORDER BY w.created_at DESC`
  ).all<WatchlistRow & { groups: string }>();

  return c.json(results.map((r) => ({
    ...r,
    groups: JSON.parse(r.groups as string) as { id: string; name: string }[],
  })));
});
```

- [ ] **Step 2: 加入 PUT /:id/groups**

在 watchlist.ts 末尾加：

```ts
watchlistRoutes.put('/:id/groups', async (c) => {
  const { id } = c.req.param();
  const { groupIds } = await c.req.json<{ groupIds: string[] }>();
  if (!Array.isArray(groupIds)) return c.json({ error: 'groupIds array required' }, 400);

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare('DELETE FROM watchlist_groups WHERE watchlist_id = ?').bind(id),
    ...groupIds.map((gid) =>
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO watchlist_groups (watchlist_id, group_id) VALUES (?, ?)'
      ).bind(id, gid)
    ),
  ];
  await c.env.DB.batch(stmts);
  return c.json({ success: true });
});
```

在 watchlist.ts 頂部加 import type：

```ts
import type { D1PreparedStatement } from '@cloudflare/workers-types';
```

- [ ] **Step 3: 確認 GET /watchlist 回傳 groups**

```bash
curl -s http://localhost:8787/watchlist -H "X-API-Key: dev-secret-key-change-in-prod" | python3 -m json.tool | head -20
```

Expected: 每個 item 有 `"groups": []` 欄位

- [ ] **Step 4: 部署 API**

```bash
cd /Users/kewos/Documents/projects/market-pulse/api && npm run deploy
```

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/watchlist.ts
git commit -m "feat: add PUT /watchlist/:id/groups, include groups in GET /watchlist"
```

---

### Task 4: Web types + API client

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: 更新 types.ts**

加入 `Group` interface，更新 `WatchlistItem`：

```ts
export interface Group {
  id: string;
  name: string;
  count?: number;
}

// 更新 WatchlistItem（加 groups 欄位）
export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  created_at: string;
  groups: Group[];
}
```

- [ ] **Step 2: 更新 api/client.ts**

在 `export const api = {` 裡加：

```ts
getGroups: () => request<import('../types').Group[]>('/groups'),
createGroup: (name: string) =>
  request<import('../types').Group>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
deleteGroup: (id: string) => request<{ success: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
setWatchlistGroups: (watchlistId: string, groupIds: string[]) =>
  request<{ success: boolean }>(`/watchlist/${watchlistId}/groups`, {
    method: 'PUT',
    body: JSON.stringify({ groupIds }),
  }),
```

- [ ] **Step 3: TypeScript 編譯確認**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 4: Commit**

```bash
git add web/src/types.ts web/src/api/client.ts
git commit -m "feat: add Group type and groups API client methods"
```

---

### Task 5: GroupPicker 元件

**Files:**
- Create: `web/src/components/GroupPicker.tsx`

- [ ] **Step 1: 建立 GroupPicker.tsx**

```tsx
import { useState, useRef, useEffect } from 'react';
import type { Group } from '../types';

interface Props {
  groups: Group[];
  selectedGroupIds: string[];
  onToggle: (groupId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

export function GroupPicker({ groups, selectedGroupIds, onToggle, onCreate, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
  const canCreate = query.trim() && !groups.some((g) => g.name === query.trim());

  async function handleCreate() {
    if (!canCreate || creating) return;
    setCreating(true);
    await onCreate(query.trim());
    setQuery('');
    setCreating(false);
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
      background: '#fff', border: '1.5px solid #6366f1', borderRadius: '8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: '180px', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px' }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
          placeholder="搜尋或新增群組..."
          style={{
            width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px',
            padding: '6px 8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
        {filtered.map((g) => {
          const selected = selectedGroupIds.includes(g.id);
          return (
            <div
              key={g.id}
              onMouseDown={(e) => { e.preventDefault(); onToggle(g.id); }}
              style={{
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                cursor: 'pointer', fontSize: '12px',
                background: selected ? '#eff6ff' : 'transparent',
                color: selected ? '#6366f1' : '#374151',
              }}
            >
              <span style={{ fontSize: '10px', opacity: selected ? 1 : 0 }}>✓</span>
              {g.name}
            </div>
          );
        })}
        {canCreate && (
          <div
            onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
            style={{
              padding: '8px 12px', fontSize: '12px', color: '#6366f1',
              cursor: 'pointer', borderTop: '1px solid #f1f5f9',
              opacity: creating ? 0.5 : 1,
            }}
          >
            + 新增「{query.trim()}」
          </div>
        )}
        {filtered.length === 0 && !canCreate && (
          <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8' }}>
            沒有符合的群組
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 確認**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add web/src/components/GroupPicker.tsx
git commit -m "feat: add GroupPicker inline dropdown component"
```

---

### Task 6: BulkImport 元件

**Files:**
- Create: `web/src/components/BulkImport.tsx`

- [ ] **Step 1: 建立 BulkImport.tsx**

```tsx
import { useState } from 'react';
import stocksData from '../data/stocks.json';
import { api } from '../api/client';
import type { Group, WatchlistItem } from '../types';

interface StockEntry {
  symbol: string;
  name: string;
  status: 'new' | 'exists' | 'unknown';
  watchlistId?: string;
}

interface Props {
  activeGroup: Group;
  existingItems: WatchlistItem[];
  onComplete: (updated: WatchlistItem[]) => void;
  onClose: () => void;
}

const stocks = stocksData as { symbol: string; name: string }[];

function parseSymbols(input: string): string[] {
  return [...new Set(
    input.split(/[\s,，、;\n]+/).map((s) => s.trim()).filter(Boolean)
  )];
}

export function BulkImport({ activeGroup, existingItems, onComplete, onClose }: Props) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<StockEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  function handleParse() {
    const codes = parseSymbols(input);
    const entries: StockEntry[] = codes.map((symbol) => {
      const stock = stocks.find((s) => s.symbol === symbol);
      if (!stock) return { symbol, name: '—', status: 'unknown' as const };
      const existing = existingItems.find((i) => i.symbol === symbol);
      return {
        symbol,
        name: stock.name,
        status: existing ? 'exists' : 'new',
        watchlistId: existing?.id,
      };
    });
    setPreview(entries);
  }

  async function handleConfirm() {
    if (!preview) return;
    setLoading(true);
    const valid = preview.filter((e) => e.status !== 'unknown');
    const updated = [...existingItems];

    for (const entry of valid) {
      let watchlistId = entry.watchlistId;
      if (entry.status === 'new') {
        const item = await api.addStock(entry.symbol, entry.name);
        watchlistId = item.id;
        updated.unshift({ ...item, groups: [] });
      }
      if (watchlistId) {
        const item = updated.find((i) => i.id === watchlistId)!;
        const currentGroupIds = item.groups.map((g) => g.id);
        if (!currentGroupIds.includes(activeGroup.id)) {
          await api.setWatchlistGroups(watchlistId, [...currentGroupIds, activeGroup.id]);
          item.groups = [...item.groups, { id: activeGroup.id, name: activeGroup.name }];
        }
      }
    }
    setLoading(false);
    onComplete(updated);
    onClose();
  }

  const newCount = preview?.filter((e) => e.status === 'new').length ?? 0;
  const unknownCount = preview?.filter((e) => e.status === 'unknown').length ?? 0;

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '16px',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
        批量新增到「{activeGroup.name}」
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
        貼入股票代號，空白、逗號、換行皆可
      </div>

      {!preview ? (
        <>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如：2330 2317 2382 或貼上 Excel 欄位..."
            style={{
              width: '100%', height: '72px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
              padding: '10px 12px', fontSize: '13px', color: '#374151', resize: 'none',
              outline: 'none', boxSizing: 'border-box', marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleParse}
              disabled={!input.trim()}
              style={{
                background: input.trim() ? '#6366f1' : '#e2e8f0',
                color: input.trim() ? '#fff' : '#94a3b8',
                border: 'none', borderRadius: '8px', padding: '8px 16px',
                fontSize: '12px', fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              解析
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{
            background: '#f8fafc', borderRadius: '8px', padding: '12px',
            marginBottom: '10px', border: '1px solid #e2e8f0', maxHeight: '200px', overflowY: 'auto',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              解析結果（{preview.length} 支）
            </div>
            {preview.map((e) => (
              <div key={e.symbol} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1', minWidth: '36px' }}>{e.symbol}</span>
                <span style={{ fontSize: '12px', color: '#374151' }}>{e.name}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                  background: e.status === 'new' ? '#eff6ff' : e.status === 'exists' ? '#dcfce7' : '#fff1f2',
                  color: e.status === 'new' ? '#6366f1' : e.status === 'exists' ? '#166534' : '#ef4444',
                }}>
                  {e.status === 'new' ? '新增' : e.status === 'exists' ? '已在清單' : '找不到代號'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleConfirm}
              disabled={loading || preview.filter((e) => e.status !== 'unknown').length === 0}
              style={{
                background: '#6366f1', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '匯入中...' : `確認匯入${newCount > 0 ? `（${newCount} 支新增）` : ''}`}
            </button>
            <button
              onClick={() => setPreview(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
            >
              重新輸入
            </button>
            {unknownCount > 0 && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{unknownCount} 支找不到代號將略過</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 確認**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add web/src/components/BulkImport.tsx
git commit -m "feat: add BulkImport component for group batch stock import"
```

---

### Task 7: 更新 Watchlist.tsx

**Files:**
- Modify: `web/src/pages/Watchlist.tsx`

- [ ] **Step 1: 替換 Watchlist.tsx**

```tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StockSearch } from '../components/StockSearch';
import { GroupPicker } from '../components/GroupPicker';
import { BulkImport } from '../components/BulkImport';
import type { WatchlistItem, Group } from '../types';

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist().then(setItems).catch(console.error);
    api.getGroups().then(setGroups).catch(console.error);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const filteredItems = activeGroupId
    ? items.filter((item) => item.groups.some((g) => g.id === activeGroupId))
    : items;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addStock(selected.symbol, selected.name);
      const newItem = { ...item, groups: [] };
      if (activeGroupId) {
        await api.setWatchlistGroups(item.id, [activeGroupId]);
        newItem.groups = [activeGroup!];
      }
      setItems((prev) => [newItem, ...prev]);
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

  async function handleToggleGroup(item: WatchlistItem, groupId: string) {
    const currentIds = item.groups.map((g) => g.id);
    const newIds = currentIds.includes(groupId)
      ? currentIds.filter((id) => id !== groupId)
      : [...currentIds, groupId];
    await api.setWatchlistGroups(item.id, newIds);
    setItems((prev) => prev.map((i) => {
      if (i.id !== item.id) return i;
      const newGroups = newIds.map((id) => groups.find((g) => g.id === id)!).filter(Boolean);
      return { ...i, groups: newGroups };
    }));
  }

  async function handleCreateAndAssign(itemId: string, name: string) {
    const group = await api.createGroup(name);
    setGroups((prev) => [...prev, group]);
    const item = items.find((i) => i.id === itemId)!;
    const newIds = [...item.groups.map((g) => g.id), group.id];
    await api.setWatchlistGroups(itemId, newIds);
    setItems((prev) => prev.map((i) =>
      i.id === itemId ? { ...i, groups: [...i.groups, group] } : i
    ));
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>追蹤清單</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>管理你想追蹤的股票</p>
      </div>

      {/* Group tabs */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0', marginBottom: '16px', overflowX: 'auto' }}>
        {[{ id: null, name: '全部' }, ...groups].map((g) => {
          const isActive = g.id === activeGroupId;
          return (
            <button
              key={g.id ?? 'all'}
              onClick={() => { setActiveGroupId(g.id); setShowBulkImport(false); }}
              style={{
                padding: '10px 16px', fontSize: '13px', border: 'none', background: 'none',
                cursor: 'pointer', whiteSpace: 'nowrap',
                color: isActive ? '#6366f1' : '#94a3b8',
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
              }}
            >
              {g.name}
            </button>
          );
        })}
      </div>

      {/* Bulk import */}
      {activeGroupId && activeGroup && (
        <div style={{ marginBottom: '8px' }}>
          {showBulkImport ? (
            <BulkImport
              activeGroup={activeGroup}
              existingItems={items}
              onComplete={setItems}
              onClose={() => setShowBulkImport(false)}
            />
          ) : (
            <button
              onClick={() => setShowBulkImport(true)}
              style={{
                background: '#eff6ff', color: '#6366f1', border: 'none',
                borderRadius: '8px', padding: '7px 14px', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer', marginBottom: '8px',
              }}
            >
              ↑ 批量匯入到「{activeGroup.name}」
            </button>
          )}
        </div>
      )}

      {/* Add stock */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>新增股票</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <StockSearch onSelect={(symbol, name) => setSelected({ symbol, name })} />
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
              whiteSpace: 'nowrap',
            }}
          >
            新增
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{error}</p>}
      </div>

      {/* Stock list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredItems.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px solid #e2e8f0',
          }}>
            {activeGroupId ? `「${activeGroup?.name}」群組還沒有股票` : '還沒有追蹤的股票，從上方搜尋新增吧'}
          </div>
        )}
        {filteredItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff', borderRadius: '12px', padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              opacity: item.enabled ? 1 : 0.6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: item.enabled ? '#10b981' : '#d1d5db',
              }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                  style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                  設定算法
                </button>
                <button onClick={() => handleToggle(item)}
                  style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                  {item.enabled ? '暫停' : '啟用'}
                </button>
                <button onClick={() => handleDelete(item.id)}
                  style={{ background: '#fff0f0', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                  刪除
                </button>
              </div>
            </div>

            {/* Group tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', position: 'relative' }}>
              {item.groups.map((g) => (
                <span
                  key={g.id}
                  onClick={() => handleToggleGroup(item, g.id)}
                  style={{
                    fontSize: '11px', color: '#6366f1', background: '#eff6ff',
                    padding: '2px 8px', borderRadius: '99px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {g.name} ×
                </span>
              ))}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setPickerOpenFor(pickerOpenFor === item.id ? null : item.id)}
                  style={{
                    fontSize: '11px', color: '#94a3b8', background: 'none',
                    border: '1px dashed #d1d5db', borderRadius: '99px', padding: '2px 8px', cursor: 'pointer',
                  }}
                >
                  + 群組
                </button>
                {pickerOpenFor === item.id && (
                  <GroupPicker
                    groups={groups}
                    selectedGroupIds={item.groups.map((g) => g.id)}
                    onToggle={(gid) => handleToggleGroup(item, gid)}
                    onCreate={(name) => handleCreateAndAssign(item.id, name)}
                    onClose={() => setPickerOpenFor(null)}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 確認**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 3: 本地測試**

確保 API 在跑（`cd api && npx wrangler dev`），然後：

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npm run dev
```

打開 http://localhost:5173/watchlist 確認：
- Tab 列顯示「全部」
- 每張卡片下方有「+ 群組」按鈕
- 點「+ 群組」開下拉，輸入「AI概念」按 Enter 建立
- 建立後卡片出現藍色 badge，Tab 列出現「AI概念」
- 點 Tab 切換到「AI概念」，點「批量匯入」，貼入代號測試

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Watchlist.tsx
git commit -m "feat: add group tabs, group tags on cards, inline picker to Watchlist"
```

---

### Task 8: Build + 部署

- [ ] **Step 1: Build**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web && npm run build 2>&1
```

Expected: `✓ built in ...ms`，無錯誤

- [ ] **Step 2: 部署前端**

```bash
npx wrangler pages deploy dist --project-name market-pulse-web --commit-dirty=true 2>&1
```

Expected: `Deployment complete!`

- [ ] **Step 3: Push**

```bash
git -C /Users/kewos/Documents/projects/market-pulse push
```
