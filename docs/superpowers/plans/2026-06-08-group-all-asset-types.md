# Group Architecture for All Asset Types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the full group system (tabs, filter, assign, bulk import, batch apply template) to US stocks, crypto, and FX — currently only Taiwan stocks have it.

**Architecture:** Add `asset_type` to the `groups` DB table (per-asset scoping), update the API to filter/create groups by asset type, then merge `pages/Watchlist.tsx` and `components/AssetWatchlist.tsx` into a new unified `components/Watchlist.tsx` that works for all four asset types.

**Tech Stack:** Cloudflare D1 (SQLite), Hono API (TypeScript), React (inline styles + Tailwind), Vitest

---

## File Map

| Action | Path |
|--------|------|
| Create | `api/migrations/0007_groups_asset_type.sql` |
| Modify | `api/src/routes/groups.ts` |
| Modify | `api/test/groups.test.ts` |
| Modify | `web/src/api/client.ts` |
| Modify | `web/src/components/BulkImport.tsx` |
| **Create** | `web/src/components/Watchlist.tsx` ← unified (new file in components/) |
| Modify | `web/src/components/AssetPage.tsx` |
| Modify | `web/src/pages/TwStocks.tsx` |
| Modify | `web/src/pages/UsStocks.tsx` |
| Modify | `web/src/pages/Crypto.tsx` |
| Modify | `web/src/pages/Fx.tsx` |
| **Delete** | `web/src/components/AssetWatchlist.tsx` |
| **Delete** | `web/src/pages/Watchlist.tsx` (moved to components/) |

---

## Task 1: DB Migration — add `asset_type` to `groups`

The `groups` table currently has `name TEXT NOT NULL UNIQUE`. With per-asset groups, "Tech" can exist independently in `us_stock` and `tw_stock`, so the constraint must become `UNIQUE(name, asset_type)`. SQLite requires recreating the table to change a constraint.

**Files:**
- Create: `api/migrations/0007_groups_asset_type.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- api/migrations/0007_groups_asset_type.sql
PRAGMA foreign_keys=OFF;

ALTER TABLE groups RENAME TO groups_old;

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'tw_stock',
  created_at TEXT NOT NULL,
  UNIQUE(name, asset_type)
);

INSERT INTO groups (id, name, asset_type, created_at)
  SELECT id, name, 'tw_stock', created_at FROM groups_old;

DROP TABLE groups_old;

PRAGMA foreign_keys=ON;
```

- [ ] **Step 2: Apply migration locally**

```bash
cd api
npm run migrate:local
```

Expected: `✅ Applied 1 migration` (or similar success output, no errors)

---

## Task 2: Write failing API tests for `asset_type`

**Files:**
- Modify: `api/test/groups.test.ts`

- [ ] **Step 1: Add failing tests for GET filter and POST asset_type**

Open `api/test/groups.test.ts` and append these two `describe` blocks after the existing `DELETE` tests:

```typescript
describe('GET /groups', () => {
  it('returns all groups when no asset_type filter', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{
      all: [
        { id: 'g-1', name: 'Tech', asset_type: 'tw_stock', created_at: '2024-01-01', count: 2 },
        { id: 'g-2', name: 'Crypto', asset_type: 'crypto', created_at: '2024-01-02', count: 1 },
      ],
    }]));
    const res = await req(app, 'GET', '/groups', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; name: string }[];
    expect(body).toHaveLength(2);
  });

  it('filters groups by asset_type query param', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{
      all: [
        { id: 'g-2', name: 'Crypto', asset_type: 'crypto', created_at: '2024-01-02', count: 1 },
      ],
    }]));
    const res = await req(app, 'GET', '/groups?asset_type=crypto', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; name: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('g-2');
  });
});

describe('POST /groups', () => {
  it('creates a group with explicit asset_type', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'POST', '/groups', env, { name: 'Tech', asset_type: 'us_stock' });
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string; count: number };
    expect(body.name).toBe('Tech');
    expect(body.count).toBe(0);
  });

  it('defaults asset_type to tw_stock when not provided', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'POST', '/groups', env, { name: 'Bancorp' });
    expect(res.status).toBe(201);
  });

  it('rejects unknown asset_type', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([]));
    const res = await req(app, 'POST', '/groups', env, { name: 'X', asset_type: 'bonds' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid asset_type');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd api
npm test
```

Expected: `GET /groups` and `POST /groups` describe blocks show failures (route logic not yet updated).

---

## Task 3: Implement API changes to make tests pass

**Files:**
- Modify: `api/src/routes/groups.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { Hono } from 'hono';
import { Env } from '../types';

const VALID_ASSET_TYPES = ['tw_stock', 'us_stock', 'crypto', 'fx'];

interface GroupRow {
  id: string;
  name: string;
  asset_type: string;
  created_at: string;
  count: number;
}

export const groupRoutes = new Hono<{ Bindings: Env }>();

groupRoutes.get('/', async (c) => {
  const assetType = c.req.query('asset_type');
  const whereClause = assetType ? 'WHERE g.asset_type = ?' : '';
  const query = `
    SELECT g.id, g.name, g.asset_type, g.created_at, COUNT(wg.watchlist_id) as count
    FROM groups g
    LEFT JOIN watchlist_groups wg ON g.id = wg.group_id
    ${whereClause}
    GROUP BY g.id
    ORDER BY g.created_at ASC`;
  const { results } = assetType
    ? await c.env.DB.prepare(query).bind(assetType).all<GroupRow>()
    : await c.env.DB.prepare(query).all<GroupRow>();
  return c.json(results.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    count: r.count,
  })));
});

groupRoutes.post('/', async (c) => {
  const { name, asset_type = 'tw_stock' } = await c.req.json<{ name: string; asset_type?: string }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  if (!VALID_ASSET_TYPES.includes(asset_type)) return c.json({ error: 'invalid asset_type' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO groups (id, name, asset_type, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, name.trim(), asset_type, now).run();
  return c.json({ id, name: name.trim(), created_at: now, count: 0 }, 201);
});

groupRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const { results: orphans } = await c.env.DB.prepare(
    `SELECT w.id FROM watchlist w
     JOIN watchlist_groups wg ON w.id = wg.watchlist_id
     WHERE wg.group_id = ?
     AND (SELECT COUNT(*) FROM watchlist_groups WHERE watchlist_id = w.id) = 1`
  ).bind(id).all<{ id: string }>();

  const result = await c.env.DB.prepare(
    'DELETE FROM groups WHERE id = ?'
  ).bind(id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);

  const deletedWatchlistIds = orphans.map((r) => r.id);

  if (deletedWatchlistIds.length > 0) {
    const placeholders = deletedWatchlistIds.map(() => '?').join(', ');
    await c.env.DB.prepare(
      `DELETE FROM watchlist WHERE id IN (${placeholders})`
    ).bind(...deletedWatchlistIds).run();
  }

  return c.json({ success: true, deletedWatchlistIds });
});

groupRoutes.put('/:id/batch-apply-template', async (c) => {
  const { id } = c.req.param();
  const { templateId } = await c.req.json<{ templateId: string | null }>();

  await c.env.DB.prepare(
    `UPDATE watchlist SET algorithm_template_id = ?
     WHERE id IN (SELECT watchlist_id FROM watchlist_groups WHERE group_id = ?)`
  ).bind(templateId ?? null, id).run();

  return c.json({ success: true });
});
```

- [ ] **Step 2: Run tests — confirm they all pass**

```bash
cd api
npm test
```

Expected: All tests pass, including the new GET/POST describe blocks.

- [ ] **Step 3: Commit**

```bash
git add api/migrations/0007_groups_asset_type.sql api/src/routes/groups.ts api/test/groups.test.ts
git commit -m "feat: scope groups by asset_type with per-asset filtering"
```

---

## Task 4: Update frontend `api/client.ts`

**Files:**
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Update `getGroups` and `createGroup` signatures**

Find these two lines in `web/src/api/client.ts`:

```typescript
  getGroups: () => request<import('../types').Group[]>('/groups'),
  createGroup: (name: string) =>
    request<import('../types').Group>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
```

Replace with:

```typescript
  getGroups: (assetType: import('../types').AssetType) =>
    request<import('../types').Group[]>(`/groups?asset_type=${assetType}`),
  createGroup: (name: string, assetType: import('../types').AssetType) =>
    request<import('../types').Group>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, asset_type: assetType }),
    }),
```

---

## Task 5: Generalize `BulkImport.tsx`

**Files:**
- Modify: `web/src/components/BulkImport.tsx`

- [ ] **Step 1: Replace the file contents**

```typescript
import { useState } from 'react';
import stocksData from '../data/stocks.json';
import usStocksData from '../data/us-stocks.json';
import { CRYPTO_LIST } from '../data/crypto';
import { FX_PAIRS } from '../data/fx';
import { api } from '../api/client';
import type { AssetType, Group, WatchlistItem } from '../types';

interface AssetEntry {
  symbol: string;
  name: string;
  status: 'new' | 'exists' | 'unknown';
  watchlistId?: string;
}

interface Props {
  assetType: AssetType;
  activeGroup: Group;
  existingItems: WatchlistItem[];
  onComplete: (updated: WatchlistItem[]) => void;
  onClose: () => void;
}

const ASSET_DATA: Record<AssetType, { symbol: string; name: string }[]> = {
  tw_stock: stocksData as { symbol: string; name: string }[],
  us_stock: usStocksData as { symbol: string; name: string }[],
  crypto: CRYPTO_LIST,
  fx: FX_PAIRS,
};

function parseSymbols(input: string): string[] {
  return [...new Set(
    input.split(/[\s,，、;\n]+/).map((s) => s.trim()).filter(Boolean)
  )];
}

export function BulkImport({ assetType, activeGroup, existingItems, onComplete, onClose }: Props) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<AssetEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const assets = ASSET_DATA[assetType];

  function handleParse() {
    const codes = parseSymbols(input);
    const entries: AssetEntry[] = codes.map((symbol) => {
      const asset = assets.find((a) => a.symbol === symbol);
      if (!asset) return { symbol, name: '—', status: 'unknown' as const };
      const existing = existingItems.find((i) => i.symbol === symbol);
      return {
        symbol,
        name: asset.name,
        status: existing ? ('exists' as const) : ('new' as const),
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
        const item = await api.addStock(entry.symbol, entry.name, assetType);
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
        貼入代號，空白、逗號、換行皆可
      </div>

      {!preview ? (
        <>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="貼上代號..."
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
              解析結果（{preview.length} 筆）
            </div>
            {preview.map((e) => (
              <div key={e.symbol} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1', minWidth: '60px' }}>{e.symbol}</span>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleConfirm}
              disabled={loading || preview.filter((e) => e.status !== 'unknown').length === 0}
              style={{
                background: '#6366f1', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '匯入中...' : `確認匯入${newCount > 0 ? `（${newCount} 筆新增）` : ''}`}
            </button>
            <button
              onClick={() => setPreview(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
            >
              重新輸入
            </button>
            {unknownCount > 0 && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{unknownCount} 筆找不到代號將略過</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Task 6: Create unified `components/Watchlist.tsx`

This replaces both `pages/Watchlist.tsx` (Taiwan stocks, full groups) and `components/AssetWatchlist.tsx` (others, no groups). All four asset types get the same group experience. `AssetSearch` is used for all types — it already handles `tw_stock`.

**Files:**
- Create: `web/src/components/Watchlist.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AssetSearch } from './AssetSearch';
import { GroupPicker } from './GroupPicker';
import { BulkImport } from './BulkImport';
import { AlgorithmTemplatePicker } from './AlgorithmTemplatePicker';
import { Pager } from './Pager';
import { usePagination } from '../lib/usePagination';
import { useStableListHeight } from '../lib/useStableListHeight';
import type { AssetType, WatchlistItem, Group, AlgorithmTemplate } from '../types';

interface Props {
  assetType: AssetType;
  label: string;
  description: string;
}

export function Watchlist({ assetType, label, description }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [batchApplying, setBatchApplying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.getWatchlist(assetType).then(setItems),
      api.getGroups(assetType).then(setGroups),
      api.getAlgorithmTemplates().then(setTemplates),
    ]).catch(console.error).finally(() => setIsLoading(false));
  }, [assetType]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const filteredItems = activeGroupId
    ? items.filter((item) => item.groups.some((g) => g.id === activeGroupId))
    : items;

  const { page, setPage, pageItems, totalPages } = usePagination(filteredItems, 10);
  const { listRef, listMinHeight, resetHeight } = useStableListHeight(pageItems);

  useEffect(() => {
    resetHeight();
    setConfirmDeleteGroupId(null);
  }, [activeGroupId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addStock(selected.symbol, selected.name, assetType);
      const existingGroupIds = item.groups.map((g) => g.id);

      let finalGroups = item.groups;
      if (activeGroupId && activeGroup && !existingGroupIds.includes(activeGroupId)) {
        const newGroupIds = [...existingGroupIds, activeGroupId];
        await api.setWatchlistGroups(item.id, newGroupIds);
        finalGroups = [...item.groups, activeGroup];
      }

      const updatedItem = { ...item, groups: finalGroups };
      setItems((prev) =>
        prev.some((i) => i.id === item.id)
          ? prev.map((i) => (i.id === item.id ? updatedItem : i))
          : [updatedItem, ...prev]
      );
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
    const group = await api.createGroup(name, assetType);
    setGroups((prev) => [...prev, group]);
    const item = items.find((i) => i.id === itemId)!;
    const newIds = [...item.groups.map((g) => g.id), group.id];
    await api.setWatchlistGroups(itemId, newIds);
    setItems((prev) => prev.map((i) =>
      i.id === itemId ? { ...i, groups: [...i.groups, group] } : i
    ));
  }

  async function handleDeleteGroup(groupId: string) {
    const { deletedWatchlistIds } = await api.deleteGroup(groupId);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setItems((prev) => prev.filter((i) => !deletedWatchlistIds.includes(i.id)));
    if (activeGroupId === groupId) setActiveGroupId(null);
  }

  async function handleBatchApplyTemplate(templateId: string | null) {
    if (!activeGroupId) return;
    setBatchApplying(true);
    const tmpl = templates.find((t) => t.id === templateId) ?? null;
    await api.batchApplyTemplate(activeGroupId, templateId);
    setItems((prev) => prev.map((item) => {
      if (!filteredItems.some((f) => f.id === item.id)) return item;
      return {
        ...item,
        algorithm_template_id: templateId,
        algorithmTemplate: tmpl ? { id: tmpl.id, name: tmpl.name } : null,
      };
    }));
    setBatchApplying(false);
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: '24px', height: '24px', border: '2px solid #e2e8f0', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>載入中...</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>追蹤清單</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{description}</p>
      </div>

      {/* Group tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', flex: 1, minWidth: 0 }}>
          <button
            onClick={() => { setActiveGroupId(null); setShowBulkImport(false); setPage(1); }}
            style={{
              padding: '10px 16px', fontSize: '13px', border: 'none', background: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
              color: activeGroupId === null ? '#6366f1' : '#94a3b8',
              fontWeight: activeGroupId === null ? 600 : 400,
              borderBottom: activeGroupId === null ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            全部
          </button>
          {groups.map((g) => {
            const isActive = g.id === activeGroupId;
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <button
                  onClick={() => { setActiveGroupId(g.id); setShowBulkImport(false); setPage(1); }}
                  style={{
                    padding: '10px 12px 10px 16px', fontSize: '13px', border: 'none', background: 'none',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    color: isActive ? '#6366f1' : '#94a3b8',
                    fontWeight: isActive ? 600 : 400,
                    borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                  }}
                >
                  {g.name}
                </button>
              </div>
            );
          })}
          {showNewGroupInput ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newGroupName.trim()) return;
                const group = await api.createGroup(newGroupName.trim(), assetType);
                setGroups((prev) => [...prev, group]);
                setActiveGroupId(group.id);
                setNewGroupName('');
                setShowNewGroupInput(false);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px' }}
            >
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); } }}
                placeholder="群組名稱..."
                style={{
                  border: '1.5px solid #6366f1', borderRadius: '6px', padding: '4px 8px',
                  fontSize: '12px', outline: 'none', width: '100px',
                }}
              />
              <button type="submit" style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                建立
              </button>
              <button type="button" onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                取消
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewGroupInput(true)}
              style={{
                padding: '10px 12px', fontSize: '12px', border: 'none', background: 'none',
                cursor: 'pointer', color: '#94a3b8', whiteSpace: 'nowrap',
                borderBottom: '2px solid transparent',
              }}
            >
              + 新增群組
            </button>
          )}
        </div>

        {/* Batch apply template — only shown when a group is active */}
        {activeGroupId && activeGroup && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setBatchPickerOpen((o) => !o)}
              disabled={batchApplying}
              style={{
                padding: '6px 12px', margin: '6px 8px', fontSize: '12px', fontWeight: 600,
                color: '#6366f1', background: '#eff6ff', border: 'none', borderRadius: '8px',
                cursor: 'pointer', whiteSpace: 'nowrap', opacity: batchApplying ? 0.6 : 1,
              }}
            >
              {batchApplying ? '套用中...' : '⚙ 批次套用模板 ▾'}
            </button>
            {batchPickerOpen && (
              <AlgorithmTemplatePicker
                templates={templates}
                selectedTemplateId={null}
                onSelect={(templateId) => { handleBatchApplyTemplate(templateId); }}
                onClose={() => setBatchPickerOpen(false)}
                onCreateNew={() => navigate('/algorithm-library')}
              />
            )}
          </div>
        )}
      </div>

      {/* Bulk import + delete group */}
      {activeGroupId && activeGroup && (
        <div style={{ marginBottom: '8px' }}>
          {showBulkImport ? (
            <BulkImport
              assetType={assetType}
              activeGroup={activeGroup}
              existingItems={items}
              onComplete={setItems}
              onClose={() => setShowBulkImport(false)}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setShowBulkImport(true)}
                style={{
                  background: '#eff6ff', color: '#6366f1', border: 'none',
                  borderRadius: '8px', padding: '7px 14px', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                ↑ 批量匯入到「{activeGroup.name}」
              </button>
              {confirmDeleteGroupId === activeGroupId ? (
                <>
                  <span style={{ fontSize: '12px', color: '#374151' }}>
                    確定刪除「{activeGroup.name}」？
                    <span style={{ color: '#94a3b8' }}> 只屬於此群組的標的也會一起刪除</span>
                  </span>
                  <button
                    onClick={() => { handleDeleteGroup(activeGroupId); setConfirmDeleteGroupId(null); }}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    確定刪除
                  </button>
                  <button
                    onClick={() => setConfirmDeleteGroupId(null)}
                    style={{ background: 'none', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDeleteGroupId(activeGroupId)}
                  style={{
                    background: 'none', color: '#ef4444', border: '1px solid #fecaca',
                    borderRadius: '8px', padding: '7px 14px', fontSize: '12px',
                    fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  刪除群組
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add item */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>新增{label}</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <AssetSearch assetType={assetType} onSelect={(symbol, name) => setSelected({ symbol, name })} />
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

      {/* Item list */}
      <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: listMinHeight || undefined }}>
        {filteredItems.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px solid #e2e8f0',
          }}>
            {activeGroupId
              ? `「${activeGroup?.name}」群組還沒有項目，點上方批量匯入或新增後指定群組`
              : `還沒有追蹤的${label}，從上方搜尋新增吧`}
          </div>
        )}
        {pageItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff', borderRadius: '12px', padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              opacity: item.enabled ? 1 : 0.6, transition: 'opacity 0.15s',
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {item.algorithmTemplate ? (
                  <span style={{
                    fontSize: '11px', padding: '2px 10px', borderRadius: '99px', border: '1px solid',
                    background: '#eff6ff', color: '#6366f1', borderColor: '#c7d2fe',
                  }}>
                    模板：{item.algorithmTemplate.name}
                  </span>
                ) : (
                  <span style={{
                    fontSize: '11px', background: '#f8fafc', color: '#64748b',
                    padding: '2px 10px', borderRadius: '99px', border: '1px solid #e2e8f0',
                  }}>
                    自訂算法
                  </span>
                )}
                <button
                  onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                  style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
                  設定算法
                </button>
                <button
                  onClick={() => handleToggle(item)}
                  style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
                  {item.enabled ? '暫停' : '啟用'}
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{ background: '#fff0f0', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
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
                    border: '1px dashed #d1d5db', borderRadius: '99px',
                    padding: '2px 8px', cursor: 'pointer',
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

      <Pager page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
```

---

## Task 7: Simplify `AssetPage.tsx` — remove `WatchlistComponent` prop

`AssetPage` will now render `Watchlist` directly instead of accepting it as a prop.

**Files:**
- Modify: `web/src/components/AssetPage.tsx`

- [ ] **Step 1: Replace the file contents**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from './SubTabNav';
import { AssetSignals } from './AssetSignals';
import { Watchlist } from './Watchlist';
import type { AssetType } from '../types';

interface Props {
  assetType: AssetType;
  basePath: string;
  label: string;
  description: string;
}

export function AssetPage({ assetType, basePath, label, description }: Props) {
  const tabs = [
    { to: basePath, label: '追蹤清單' },
    { to: `${basePath}/signals`, label: '訊號歷史' },
  ];

  return (
    <div>
      <SubTabNav tabs={tabs} />
      <Routes>
        <Route
          index
          element={<Watchlist assetType={assetType} label={label} description={description} />}
        />
        <Route path="signals" element={<AssetSignals assetType={assetType} />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </div>
  );
}
```

---

## Task 8: Update page components and delete dead files

**Files:**
- Modify: `web/src/pages/TwStocks.tsx`
- Modify: `web/src/pages/UsStocks.tsx`
- Modify: `web/src/pages/Crypto.tsx`
- Modify: `web/src/pages/Fx.tsx`
- Delete: `web/src/components/AssetWatchlist.tsx`
- Delete: `web/src/pages/Watchlist.tsx`

- [ ] **Step 1: Update `web/src/pages/TwStocks.tsx`**

```typescript
import { AssetPage } from '../components/AssetPage';

export function TwStocks() {
  return (
    <AssetPage
      assetType="tw_stock"
      basePath="/tw-stocks"
      label="台股"
      description="管理你想追蹤的股票"
    />
  );
}
```

- [ ] **Step 2: Update `web/src/pages/UsStocks.tsx`**

```typescript
import { AssetPage } from '../components/AssetPage';

export function UsStocks() {
  return (
    <AssetPage
      assetType="us_stock"
      basePath="/us-stocks"
      label="美股"
      description="管理你想追蹤的美國股票（S&P 500）"
    />
  );
}
```

- [ ] **Step 3: Update `web/src/pages/Crypto.tsx`**

```typescript
import { AssetPage } from '../components/AssetPage';

export function Crypto() {
  return (
    <AssetPage
      assetType="crypto"
      basePath="/crypto"
      label="幣種"
      description="追蹤主流加密貨幣（每小時掃描）"
    />
  );
}
```

- [ ] **Step 4: Update `web/src/pages/Fx.tsx`**

```typescript
import { AssetPage } from '../components/AssetPage';

export function Fx() {
  return (
    <AssetPage
      assetType="fx"
      basePath="/fx"
      label="貨幣對"
      description="追蹤各國匯率（USD、EUR、GBP、TWD、JPY、AUD、CHF）"
    />
  );
}
```

- [ ] **Step 5: Delete dead files**

```bash
rm web/src/components/AssetWatchlist.tsx
rm web/src/pages/Watchlist.tsx
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
cd web
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit all frontend changes**

```bash
git add web/src/api/client.ts \
        web/src/components/BulkImport.tsx \
        web/src/components/Watchlist.tsx \
        web/src/components/AssetPage.tsx \
        web/src/pages/TwStocks.tsx \
        web/src/pages/UsStocks.tsx \
        web/src/pages/Crypto.tsx \
        web/src/pages/Fx.tsx
git rm web/src/components/AssetWatchlist.tsx web/src/pages/Watchlist.tsx
git commit -m "feat: extend group architecture to all asset types (us_stock, crypto, fx)"
```

---

## Task 9: Smoke test all four pages

- [ ] **Step 1: Start the dev server**

```bash
cd web
npm run dev
```

- [ ] **Step 2: Test each asset page in order**

For each of the four pages (台股 `/tw-stocks`, 美股 `/us-stocks`, 加密貨幣 `/crypto`, 匯率 `/fx`):

1. Navigate to the watchlist tab
2. Verify group tabs appear (全部 + + 新增群組)
3. Click `+ 新增群組`, type a group name, press 建立 — group tab should appear
4. Add an item (search + 新增) — item appears in the list
5. On the item, click `+ 群組` — GroupPicker opens, toggle the new group
6. Click the group tab — only that item appears
7. Click `↑ 批量匯入到「...」` — BulkImport panel opens, paste a symbol, parse, confirm
8. Click `⚙ 批次套用模板` — template picker opens
9. Click `刪除群組` → confirm — group removed, orphan items removed

- [ ] **Step 3: Verify groups stay isolated across asset types**

1. Create a group named "Test" in 台股
2. Navigate to 美股
3. Verify "Test" group does NOT appear in 美股's group tabs

---

*Self-review: spec coverage checked — all requirements (per-asset groups, bulk import, batch template, unified component, migration) are covered. No placeholders. Type signatures consistent across tasks (`AssetType` used in client.ts, BulkImport, Watchlist, and groups.ts). `createGroup(name, assetType)` called consistently in Tasks 5 and 6.*
