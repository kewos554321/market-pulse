# Group Algorithm Inheritance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an algorithm template library and group-level default algorithm inheritance so stocks automatically use their group's algorithm unless individually overridden.

**Architecture:** New `algorithm_templates` table stores named reusable templates. Groups reference a template via `algorithm_template_id`. Each watchlist item has `algorithm_source_group_id` pointing to the group it inherits from (null = custom). The algorithm GET endpoint resolves the inheritance chain at runtime, enabling live updates when a group's template changes.

**Tech Stack:** Cloudflare Workers + Hono (API), D1 (SQLite), React + TypeScript (frontend), Vite

---

## File Map

**Create:**
- `api/migrations/0005_algorithm_templates.sql`
- `api/src/routes/algorithm-templates.ts`
- `web/src/components/AlgorithmTemplatePicker.tsx`
- `web/src/pages/AlgorithmLibrary.tsx`

**Modify:**
- `api/src/types.ts` — add `AlgorithmTemplateRow`, update `WatchlistRow`
- `api/src/routes/groups.ts` — add `PUT /:id/algorithm-template`, update `GET /` to include template
- `api/src/routes/watchlist.ts` — add `PUT /:id/algorithm-source`, include `algorithm_source_group_id` in GET
- `api/src/routes/algorithms.ts` — update `GET /:id/algorithm` to resolve inheritance
- `api/src/index.ts` — mount `algorithmTemplateRoutes`
- `web/src/types.ts` — add `AlgorithmTemplate`, `AlgorithmState`, update `Group`, `WatchlistItem`, `Algorithm`
- `web/src/api/client.ts` — add 6 new methods
- `web/src/pages/Watchlist.tsx` — add group template button, algorithm source badges, auto-set on add
- `web/src/pages/AlgorithmEditor.tsx` — add source selector, read-only inherited mode, override button
- `web/src/App.tsx` — add `/algorithm-library` route and nav link

---

## Task 1: DB Migration

**Files:**
- Create: `api/migrations/0005_algorithm_templates.sql`

- [ ] **Step 1: Create migration file**

```sql
CREATE TABLE IF NOT EXISTS algorithm_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  conditions TEXT NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE groups ADD COLUMN algorithm_template_id TEXT REFERENCES algorithm_templates(id) ON DELETE SET NULL;

ALTER TABLE watchlist ADD COLUMN algorithm_source_group_id TEXT REFERENCES groups(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Apply migration to local D1**

```bash
cd api
npx wrangler d1 migrations apply market-pulse-db --local
```

Expected output: `✅ Applied 1 migration`

- [ ] **Step 3: Verify schema**

```bash
npx wrangler d1 execute market-pulse-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected: `algorithm_templates` appears in the list.

- [ ] **Step 4: Commit**

```bash
git add api/migrations/0005_algorithm_templates.sql
git commit -m "feat: add algorithm_templates table and FK columns for inheritance"
```

---

## Task 2: API Types

**Files:**
- Modify: `api/src/types.ts`

- [ ] **Step 1: Add `AlgorithmTemplateRow` and update `WatchlistRow`**

In `api/src/types.ts`, add after `AlgorithmRow`:

```ts
export interface AlgorithmTemplateRow {
  id: string;
  name: string;
  conditions: string;
  created_at: string;
  updated_at: string;
}
```

Update `WatchlistRow` to add the new column:

```ts
export interface WatchlistRow {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
  created_at: string;
  algorithm_source_group_id: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add api/src/types.ts
git commit -m "feat: add AlgorithmTemplateRow type and algorithm_source_group_id to WatchlistRow"
```

---

## Task 3: Algorithm Templates API Route

**Files:**
- Create: `api/src/routes/algorithm-templates.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Create `api/src/routes/algorithm-templates.ts`**

```ts
import { Hono } from 'hono';
import { Env, AlgorithmTemplateRow } from '../types';

export const algorithmTemplateRoutes = new Hono<{ Bindings: Env }>();

algorithmTemplateRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM algorithm_templates ORDER BY created_at ASC'
  ).all<AlgorithmTemplateRow>();
  return c.json(results.map((r) => ({ ...r, conditions: JSON.parse(r.conditions) })));
});

algorithmTemplateRoutes.post('/', async (c) => {
  const { name, conditions } = await c.req.json<{ name: string; conditions: unknown }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  if (!conditions) return c.json({ error: 'conditions required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO algorithm_templates (id, name, conditions, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name.trim(), JSON.stringify(conditions), now, now).run();

  return c.json({ id, name: name.trim(), conditions, created_at: now, updated_at: now }, 201);
});

algorithmTemplateRoutes.put('/:id', async (c) => {
  const { id } = c.req.param();
  const { name, conditions } = await c.req.json<{ name?: string; conditions?: unknown }>();
  if (!name?.trim() && !conditions) return c.json({ error: 'name or conditions required' }, 400);

  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (name?.trim()) { fields.push('name = ?'); values.push(name.trim()); }
  if (conditions) { fields.push('conditions = ?'); values.push(JSON.stringify(conditions)); }
  values.push(id);

  const result = await c.env.DB.prepare(
    `UPDATE algorithm_templates SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

algorithmTemplateRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare(
    'DELETE FROM algorithm_templates WHERE id = ?'
  ).bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 2: Mount in `api/src/index.ts`**

Add import and route:

```ts
import { algorithmTemplateRoutes } from './routes/algorithm-templates';
```

After `app.route('/groups', groupRoutes);` add:

```ts
app.route('/algorithm-templates', algorithmTemplateRoutes);
```

- [ ] **Step 3: Manual test — create a template**

```bash
curl -s -X POST http://localhost:8787/algorithm-templates \
  -H "X-API-Key: dev" \
  -H "Content-Type: application/json" \
  -d '{"name":"動能型","conditions":{"operator":"AND","conditions":[{"indicator":"RSI","period":14,"op":"<","value":30}]}}' | jq .
```

Expected: `{ "id": "...", "name": "動能型", "conditions": {...}, "created_at": "...", "updated_at": "..." }`

- [ ] **Step 4: Manual test — list templates**

```bash
curl -s http://localhost:8787/algorithm-templates -H "X-API-Key: dev" | jq .
```

Expected: array with the template created above.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/algorithm-templates.ts api/src/index.ts
git commit -m "feat: add algorithm templates CRUD API"
```

---

## Task 4: Groups API — Algorithm Template Endpoint

**Files:**
- Modify: `api/src/routes/groups.ts`

- [ ] **Step 1: Update `GroupRow` interface and `GET /` query to include template**

Replace the file content:

```ts
import { Hono } from 'hono';
import { Env } from '../types';

interface GroupRow {
  id: string;
  name: string;
  created_at: string;
  count: number;
  algorithm_template_id: string | null;
  template_name: string | null;
}

export const groupRoutes = new Hono<{ Bindings: Env }>();

groupRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.created_at, COUNT(wg.watchlist_id) as count,
            g.algorithm_template_id,
            at.name as template_name
     FROM groups g
     LEFT JOIN watchlist_groups wg ON g.id = wg.group_id
     LEFT JOIN algorithm_templates at ON g.algorithm_template_id = at.id
     GROUP BY g.id
     ORDER BY g.created_at ASC`
  ).all<GroupRow>();
  return c.json(results.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    count: r.count,
    algorithmTemplate: r.algorithm_template_id
      ? { id: r.algorithm_template_id, name: r.template_name! }
      : null,
  })));
});

groupRoutes.post('/', async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)'
  ).bind(id, name.trim(), now).run();
  return c.json({ id, name: name.trim(), created_at: now, count: 0, algorithmTemplate: null }, 201);
});

groupRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

groupRoutes.put('/:id/algorithm-template', async (c) => {
  const { id } = c.req.param();
  const { templateId } = await c.req.json<{ templateId: string | null }>();

  const result = await c.env.DB.prepare(
    'UPDATE groups SET algorithm_template_id = ? WHERE id = ?'
  ).bind(templateId ?? null, id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 2: Manual test — set group algorithm template**

First create a group, then set its template (use IDs from previous tests):

```bash
# Create a group
GROUP_ID=$(curl -s -X POST http://localhost:8787/groups \
  -H "X-API-Key: dev" -H "Content-Type: application/json" \
  -d '{"name":"AI概念"}' | jq -r '.id')

# Get template ID
TMPL_ID=$(curl -s http://localhost:8787/algorithm-templates \
  -H "X-API-Key: dev" | jq -r '.[0].id')

# Set template
curl -s -X PUT "http://localhost:8787/groups/$GROUP_ID/algorithm-template" \
  -H "X-API-Key: dev" -H "Content-Type: application/json" \
  -d "{\"templateId\":\"$TMPL_ID\"}" | jq .
```

Expected: `{ "success": true }`

- [ ] **Step 3: Verify GET /groups includes template**

```bash
curl -s http://localhost:8787/groups -H "X-API-Key: dev" | jq .
```

Expected: `[{ ..., "algorithmTemplate": { "id": "...", "name": "動能型" } }]`

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/groups.ts
git commit -m "feat: add PUT /groups/:id/algorithm-template and include template in GET /groups"
```

---

## Task 5: Watchlist API — Algorithm Source Endpoint

**Files:**
- Modify: `api/src/routes/watchlist.ts`

- [ ] **Step 1: Update GET `/` and GET `/:id` to include `algorithm_source_group_id`**

In the SELECT query in both `watchlistRoutes.get('/')` and `watchlistRoutes.get('/:id')`, add `w.algorithm_source_group_id` to the selected columns. The query already selects `w.id, w.symbol, w.name, w.enabled, w.asset_type, w.created_at` — extend both to:

```ts
// In watchlistRoutes.get('/')
const query = `
  SELECT w.id, w.symbol, w.name, w.enabled, w.asset_type, w.created_at,
    w.algorithm_source_group_id,
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
  ${whereClause}
  GROUP BY w.id
  ORDER BY w.created_at DESC
`;
```

Apply the same change to `watchlistRoutes.get('/:id')` (same SELECT structure, with `WHERE w.id = ?`).

- [ ] **Step 2: Add `PUT /:id/algorithm-source` endpoint**

After the `watchlistRoutes.put('/:id/groups', ...)` handler, add:

```ts
watchlistRoutes.put('/:id/algorithm-source', async (c) => {
  const { id } = c.req.param();
  const { sourceGroupId } = await c.req.json<{ sourceGroupId: string | null }>();

  const result = await c.env.DB.prepare(
    'UPDATE watchlist SET algorithm_source_group_id = ? WHERE id = ?'
  ).bind(sourceGroupId ?? null, id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 3: Update `POST /` to accept and store `algorithm_source_group_id`**

The `POST /` handler currently doesn't set `algorithm_source_group_id`. Update it to accept an optional `sourceGroupId` param and insert it:

```ts
watchlistRoutes.post('/', async (c) => {
  const { symbol, name, asset_type = 'tw_stock', sourceGroupId = null } = await c.req.json<{
    symbol: string;
    name: string;
    asset_type?: string;
    sourceGroupId?: string | null;
  }>();
  if (!symbol || !name) return c.json({ error: 'symbol and name required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO watchlist (id, symbol, name, enabled, asset_type, algorithm_source_group_id, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)'
  ).bind(id, symbol.trim(), name.trim(), asset_type, sourceGroupId, now).run();

  await c.env.DB.prepare(
    'INSERT INTO algorithms (id, watchlist_id, conditions, updated_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, '{"operator":"AND","conditions":[]}', now).run();

  return c.json({
    id, symbol: symbol.trim(), name: name.trim(),
    enabled: 1, asset_type, groups: [],
    algorithm_source_group_id: sourceGroupId,
    created_at: now,
  }, 201);
});
```

- [ ] **Step 4: Manual test — set algorithm source**

```bash
# Get a watchlist item ID
ITEM_ID=$(curl -s http://localhost:8787/watchlist -H "X-API-Key: dev" | jq -r '.[0].id')
GROUP_ID=$(curl -s http://localhost:8787/groups -H "X-API-Key: dev" | jq -r '.[0].id')

curl -s -X PUT "http://localhost:8787/watchlist/$ITEM_ID/algorithm-source" \
  -H "X-API-Key: dev" -H "Content-Type: application/json" \
  -d "{\"sourceGroupId\":\"$GROUP_ID\"}" | jq .
```

Expected: `{ "success": true }`

Verify it persists:
```bash
curl -s http://localhost:8787/watchlist -H "X-API-Key: dev" | jq '.[0].algorithm_source_group_id'
```

Expected: the group ID string.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/watchlist.ts
git commit -m "feat: add PUT /watchlist/:id/algorithm-source and algorithm_source_group_id in GET /watchlist"
```

---

## Task 6: Algorithm GET — Resolve Inheritance

**Files:**
- Modify: `api/src/routes/algorithms.ts`

- [ ] **Step 1: Update `GET /:id/algorithm` to resolve inheritance chain**

Replace `api/src/routes/algorithms.ts` with:

```ts
import { Hono } from 'hono';
import { Env, AlgorithmRow, AlgorithmTemplateRow } from '../types';

export const algorithmRoutes = new Hono<{ Bindings: Env }>();

algorithmRoutes.get('/:id/algorithm', async (c) => {
  const { id } = c.req.param();

  const watchlistRow = await c.env.DB.prepare(
    'SELECT algorithm_source_group_id FROM watchlist WHERE id = ?'
  ).bind(id).first<{ algorithm_source_group_id: string | null }>();

  if (!watchlistRow) return c.json({ error: 'Not found' }, 404);

  if (watchlistRow.algorithm_source_group_id) {
    const groupRow = await c.env.DB.prepare(
      `SELECT g.id, g.name, g.algorithm_template_id, at.name as template_name, at.conditions
       FROM groups g
       LEFT JOIN algorithm_templates at ON g.algorithm_template_id = at.id
       WHERE g.id = ?`
    ).bind(watchlistRow.algorithm_source_group_id).first<{
      id: string; name: string;
      algorithm_template_id: string | null;
      template_name: string | null;
      conditions: string | null;
    }>();

    const conditions = groupRow?.conditions
      ? JSON.parse(groupRow.conditions)
      : { operator: 'AND', conditions: [] };

    return c.json({
      source: 'group',
      sourceGroupId: watchlistRow.algorithm_source_group_id,
      sourceGroupName: groupRow?.name ?? '',
      templateName: groupRow?.template_name ?? null,
      conditions,
    });
  }

  const row = await c.env.DB.prepare(
    'SELECT * FROM algorithms WHERE watchlist_id = ?'
  ).bind(id).first<AlgorithmRow>();

  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({
    source: 'custom',
    conditions: JSON.parse(row.conditions),
  });
});

algorithmRoutes.put('/:id/algorithm', async (c) => {
  const { id } = c.req.param();
  const { conditions } = await c.req.json<{ conditions: unknown }>();
  if (!conditions) return c.json({ error: 'conditions required' }, 400);

  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    'UPDATE algorithms SET conditions = ?, updated_at = ? WHERE watchlist_id = ?'
  ).bind(JSON.stringify(conditions), now, id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
```

- [ ] **Step 2: Manual test — inherited algorithm**

```bash
# Use the item ID that was set to inherit from group in Task 5
curl -s "http://localhost:8787/watchlist/$ITEM_ID/algorithm" \
  -H "X-API-Key: dev" | jq .
```

Expected:
```json
{
  "source": "group",
  "sourceGroupId": "...",
  "sourceGroupName": "AI概念",
  "templateName": "動能型",
  "conditions": { "operator": "AND", "conditions": [{ "indicator": "RSI", ... }] }
}
```

- [ ] **Step 3: Manual test — custom algorithm**

```bash
# Reset source to null, then fetch
curl -s -X PUT "http://localhost:8787/watchlist/$ITEM_ID/algorithm-source" \
  -H "X-API-Key: dev" -H "Content-Type: application/json" \
  -d '{"sourceGroupId":null}' | jq .

curl -s "http://localhost:8787/watchlist/$ITEM_ID/algorithm" \
  -H "X-API-Key: dev" | jq '.source'
```

Expected: `"custom"`

- [ ] **Step 4: Commit**

```bash
git add api/src/routes/algorithms.ts
git commit -m "feat: resolve group algorithm inheritance in GET /watchlist/:id/algorithm"
```

---

## Task 7: Frontend Types and API Client

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Update `web/src/types.ts`**

Add `AlgorithmTemplate` and `AlgorithmState` interfaces, and update `Group`, `WatchlistItem`, `Algorithm`:

```ts
export interface AlgorithmTemplate {
  id: string;
  name: string;
  conditions: ConditionTree;
  updated_at: string;
}

export interface AlgorithmState {
  source: 'group' | 'custom';
  sourceGroupId?: string;
  sourceGroupName?: string;
  templateName?: string | null;
  conditions: ConditionTree;
}
```

Update `Group`:
```ts
export interface Group {
  id: string;
  name: string;
  count?: number;
  algorithmTemplate: { id: string; name: string } | null;
}
```

Update `WatchlistItem`:
```ts
export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type?: string;
  created_at: string;
  groups: Group[];
  algorithm_source_group_id: string | null;
}
```

`Algorithm` is no longer directly used (replaced by `AlgorithmState` in AlgorithmEditor), but keep it for backward compatibility. The `getAlgorithm` API client method will return `AlgorithmState` going forward.

- [ ] **Step 2: Update `web/src/api/client.ts`**

Change the return type of `getAlgorithm`:
```ts
getAlgorithm: (id: string) => request<import('../types').AlgorithmState>(`/watchlist/${id}/algorithm`),
```

Add new methods at the end of the `api` object (before the closing `}`):

```ts
  getAlgorithmTemplates: () =>
    request<import('../types').AlgorithmTemplate[]>('/algorithm-templates'),
  createAlgorithmTemplate: (name: string, conditions: import('../types').ConditionTree) =>
    request<import('../types').AlgorithmTemplate>('/algorithm-templates', {
      method: 'POST',
      body: JSON.stringify({ name, conditions }),
    }),
  updateAlgorithmTemplate: (id: string, name: string, conditions: import('../types').ConditionTree) =>
    request<{ success: boolean }>(`/algorithm-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, conditions }),
    }),
  deleteAlgorithmTemplate: (id: string) =>
    request<{ success: boolean }>(`/algorithm-templates/${id}`, { method: 'DELETE' }),
  setGroupAlgorithmTemplate: (groupId: string, templateId: string | null) =>
    request<{ success: boolean }>(`/groups/${groupId}/algorithm-template`, {
      method: 'PUT',
      body: JSON.stringify({ templateId }),
    }),
  setWatchlistAlgorithmSource: (watchlistId: string, sourceGroupId: string | null) =>
    request<{ success: boolean }>(`/watchlist/${watchlistId}/algorithm-source`, {
      method: 'PUT',
      body: JSON.stringify({ sourceGroupId }),
    }),
  addStockWithSource: (symbol: string, name: string, assetType = 'tw_stock', sourceGroupId: string | null = null) =>
    request<import('../types').WatchlistItem>('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol, name, asset_type: assetType, sourceGroupId }),
    }),
```

- [ ] **Step 3: Commit**

```bash
git add web/src/types.ts web/src/api/client.ts
git commit -m "feat: add AlgorithmTemplate and AlgorithmState types, new API client methods"
```

---

## Task 8: AlgorithmTemplatePicker Component

**Files:**
- Create: `web/src/components/AlgorithmTemplatePicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef } from 'react';
import type { AlgorithmTemplate, Group } from '../types';

interface Props {
  templates: AlgorithmTemplate[];
  group: Group;
  onSelect: (templateId: string | null) => void;
  onClose: () => void;
  onCreateNew: () => void;
}

export function AlgorithmTemplatePicker({ templates, group, onSelect, onClose, onCreateNew }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', right: 0, zIndex: 200,
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '8px', minWidth: '240px',
        marginTop: '4px',
      }}
    >
      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        選擇算法模板
      </div>
      {templates.map((t) => {
        const isActive = group.algorithmTemplate?.id === t.id;
        return (
          <div
            key={t.id}
            onClick={() => { onSelect(t.id); onClose(); }}
            style={{
              padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
              background: isActive ? '#f5f3ff' : 'transparent',
              border: isActive ? '1.5px solid #c4b5fd' : '1.5px solid transparent',
              marginBottom: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#4338ca' : '#374151' }}>{t.name}</span>
              {isActive && <span style={{ fontSize: '11px', color: '#7c3aed' }}>✓ 目前套用</span>}
            </div>
          </div>
        );
      })}
      {templates.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8' }}>尚無模板</div>
      )}
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '4px' }}>
        <div
          onClick={() => { onCreateNew(); onClose(); }}
          style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#6366f1', fontWeight: 500 }}
        >
          + 建立新模板
        </div>
        {group.algorithmTemplate && (
          <div
            onClick={() => { onSelect(null); onClose(); }}
            style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#ef4444' }}
          >
            移除群組預設算法
          </div>
        )}
      </div>
      <div style={{ padding: '6px 12px', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
        套用後，「繼承群組」的股票自動更新。已自訂的股票不受影響。
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/AlgorithmTemplatePicker.tsx
git commit -m "feat: add AlgorithmTemplatePicker component"
```

---

## Task 9: Watchlist Page Modifications

**Files:**
- Modify: `web/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add imports and state for templates and picker**

At the top of `Watchlist.tsx`, add the import:
```tsx
import { AlgorithmTemplatePicker } from '../components/AlgorithmTemplatePicker';
import type { AlgorithmTemplate } from '../types';
```

Inside the `Watchlist` function, add state alongside existing state:
```tsx
const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
const [templatePickerOpenFor, setTemplatePickerOpenFor] = useState<string | null>(null); // group id
```

In the `useEffect`, add template loading:
```tsx
api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
```

- [ ] **Step 2: Update `handleAdd` to pass `sourceGroupId`**

Replace the existing `handleAdd` function:

```tsx
async function handleAdd(e: React.FormEvent) {
  e.preventDefault();
  if (!selected) return;
  setError('');
  try {
    const item = await api.addStockWithSource(
      selected.symbol, selected.name, 'tw_stock',
      activeGroupId ?? null
    );
    const newItem = { ...item, groups: [] };
    if (activeGroupId && activeGroup) {
      await api.setWatchlistGroups(item.id, [activeGroupId]);
      newItem.groups = [activeGroup];
    }
    setItems((prev) => [newItem, ...prev]);
    setSelected(null);
  } catch (err) {
    setError(String(err));
  }
}
```

- [ ] **Step 3: Add `handleSetGroupTemplate` handler**

```tsx
async function handleSetGroupTemplate(groupId: string, templateId: string | null) {
  await api.setGroupAlgorithmTemplate(groupId, templateId);
  const templateObj = templates.find((t) => t.id === templateId) ?? null;
  setGroups((prev) => prev.map((g) =>
    g.id === groupId
      ? { ...g, algorithmTemplate: templateObj ? { id: templateObj.id, name: templateObj.name } : null }
      : g
  ));
}
```

- [ ] **Step 4: Add group template button in the tab bar**

In the group tabs section, after the `+ 新增群組` button area and before the closing `</div>`, add the template picker button. Find the block just before the closing `</div>` of the tab bar and add:

```tsx
{activeGroupId && activeGroup && (
  <div style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
    <button
      onClick={() => setTemplatePickerOpenFor(templatePickerOpenFor === activeGroupId ? null : activeGroupId)}
      style={{
        padding: '6px 12px', margin: '6px 8px', fontSize: '12px', fontWeight: 600,
        color: '#6366f1', background: '#eff6ff', border: 'none', borderRadius: '8px',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      ⚙ {activeGroup.algorithmTemplate ? `群組算法：${activeGroup.algorithmTemplate.name} ▾` : '未設預設算法 ▾'}
    </button>
    {templatePickerOpenFor === activeGroupId && (
      <AlgorithmTemplatePicker
        templates={templates}
        group={activeGroup}
        onSelect={(templateId) => handleSetGroupTemplate(activeGroupId, templateId)}
        onClose={() => setTemplatePickerOpenFor(null)}
        onCreateNew={() => navigate('/algorithm-library')}
      />
    )}
  </div>
)}
```

- [ ] **Step 5: Add algorithm source badge to stock cards**

In the stock card render, find the `<div style={{ display: 'flex', gap: '8px' }}>` that contains the action buttons (設定算法, 暫停, 刪除). Before that div, add the algorithm source badge:

```tsx
{(() => {
  const srcGroup = item.algorithm_source_group_id
    ? groups.find((g) => g.id === item.algorithm_source_group_id)
    : null;
  if (!srcGroup) {
    return (
      <span style={{ fontSize: '11px', background: '#f8fafc', color: '#64748b', padding: '2px 10px', borderRadius: '99px', border: '1px solid #e2e8f0' }}>
        自訂算法
      </span>
    );
  }
  const hasTemplate = !!srcGroup.algorithmTemplate;
  return (
    <span style={{
      fontSize: '11px', padding: '2px 10px', borderRadius: '99px', border: '1px solid',
      background: hasTemplate ? '#eff6ff' : '#fffbeb',
      color: hasTemplate ? '#6366f1' : '#d97706',
      borderColor: hasTemplate ? '#c7d2fe' : '#fde68a',
    }}>
      繼承：{srcGroup.name}{!hasTemplate ? '（未設模板）' : ''}
    </span>
  );
})()}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/Watchlist.tsx
git commit -m "feat: add group algorithm template picker and algorithm source badges in Watchlist"
```

---

## Task 10: AlgorithmEditor Modifications

**Files:**
- Modify: `web/src/pages/AlgorithmEditor.tsx`

- [ ] **Step 1: Update state to use `AlgorithmState`**

Replace the existing state and useEffect in `AlgorithmEditor`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { parsePresets } from '../data/signals';
import type { AlgorithmState, ConditionTree, WatchlistItem } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stock, setStock] = useState<WatchlistItem | null>(null);
  const [algoState, setAlgoState] = useState<AlgorithmState>({ source: 'custom', conditions: emptyTree });
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getWatchlist().then((list) => setStock(list.find((s) => s.id === id) ?? null));
    api.getAlgorithm(id)
      .then((state) => {
        setAlgoState(state);
        if (state.source === 'custom') {
          setConditions(state.conditions);
          const presets = parsePresets(state.conditions);
          setMode(state.conditions.conditions.length === 0 || presets !== null ? 'preset' : 'advanced');
        }
      })
      .catch(() => {
        setAlgoState({ source: 'custom', conditions: emptyTree });
        setConditions(emptyTree);
        setMode('preset');
      })
      .finally(() => setLoading(false));
  }, [id]);
```

- [ ] **Step 2: Add source switch and save handlers**

Add these handlers inside the component (after state declarations):

```tsx
async function handleSwitchSource(sourceGroupId: string | null) {
  if (!id) return;
  await api.setWatchlistAlgorithmSource(id, sourceGroupId);
  const refreshed = await api.getAlgorithm(id);
  setAlgoState(refreshed);
  if (refreshed.source === 'custom') {
    setConditions(refreshed.conditions);
  }
}

async function handleSave() {
  if (!id) return;
  if (algoState.source === 'custom') {
    await api.saveAlgorithm(id, conditions);
  }
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
}
```

- [ ] **Step 3: Add source selector UI**

Replace the `return (` JSX — specifically add the source selector bar right after the stock name header `<div style={{ marginBottom: '20px' }}>...</div>` and before the algorithm card `<div style={{ background: '#fff', borderRadius: '12px' ...`:

```tsx
{/* Source selector */}
{stock && stock.groups.length > 0 && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
  }}>
    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginRight: '4px' }}>算法來源：</span>
    {stock.groups.map((g) => (
      <button
        key={g.id}
        onClick={() => handleSwitchSource(g.id)}
        style={{
          padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', border: 'none',
          background: algoState.source === 'group' && algoState.sourceGroupId === g.id ? '#6366f1' : '#f1f5f9',
          color: algoState.source === 'group' && algoState.sourceGroupId === g.id ? '#fff' : '#374151',
        }}
      >
        繼承 {g.name}
      </button>
    ))}
    <button
      onClick={() => handleSwitchSource(null)}
      style={{
        padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        cursor: 'pointer', border: 'none',
        background: algoState.source === 'custom' ? '#6366f1' : '#f1f5f9',
        color: algoState.source === 'custom' ? '#fff' : '#374151',
      }}
    >
      自訂
    </button>
  </div>
)}
```

- [ ] **Step 4: Show inherited conditions read-only when source is group**

Inside the algorithm card `<div style={{ background: '#fff', borderRadius: '12px', ... }}>`, replace the entire content block (the `loading ? ... : mode === 'preset' ? ... : ...` ternary) with:

```tsx
{loading ? (
  <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>載入中...</div>
) : algoState.source === 'group' ? (
  <div>
    <div style={{
      background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '10px',
      padding: '12px 16px', marginBottom: '12px',
    }}>
      <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginBottom: '8px' }}>
        來自「{algoState.sourceGroupName}」預設{algoState.templateName ? `：${algoState.templateName}` : '（尚未設模板）'}
      </div>
      {algoState.conditions.conditions.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>此群組尚未設定算法模板</div>
      ) : (
        <pre style={{ margin: 0, fontSize: '12px', color: '#4338ca', fontFamily: 'monospace' }}>
          {JSON.stringify(algoState.conditions, null, 2)}
        </pre>
      )}
    </div>
    <button
      onClick={() => handleSwitchSource(null)}
      style={{
        fontSize: '12px', color: '#6366f1', background: 'none',
        border: '1px solid #6366f1', borderRadius: '6px',
        padding: '6px 14px', cursor: 'pointer',
      }}
    >
      覆蓋為自訂 →
    </button>
  </div>
) : mode === 'preset' ? (
  <PresetSignalPicker value={conditions} onChange={setConditions} />
) : (
  <ConditionBuilder conditions={conditions} onChange={setConditions} />
)}
```

- [ ] **Step 5: Hide save/mode-switch buttons when source is group**

Find the `<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>` that contains 儲存算法 button, and wrap it:

```tsx
{algoState.source === 'custom' && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
    {/* existing 儲存算法 button, saved indicator, mode-switch button */}
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/AlgorithmEditor.tsx
git commit -m "feat: add algorithm source selector and inherited read-only mode in AlgorithmEditor"
```

---

## Task 11: Algorithm Library Page and Route

**Files:**
- Create: `web/src/pages/AlgorithmLibrary.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `web/src/pages/AlgorithmLibrary.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { parsePresets } from '../data/signals';
import type { AlgorithmTemplate, ConditionTree } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmLibrary() {
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [editing, setEditing] = useState<AlgorithmTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
  }, []);

  function startNew() {
    setEditing(null);
    setNewName('');
    setConditions(emptyTree);
    setMode('preset');
    setShowForm(true);
  }

  function startEdit(t: AlgorithmTemplate) {
    setEditing(t);
    setNewName(t.name);
    setConditions(t.conditions);
    const presets = parsePresets(t.conditions);
    setMode(t.conditions.conditions.length === 0 || presets !== null ? 'preset' : 'advanced');
    setShowForm(true);
  }

  async function handleSave() {
    if (!newName.trim()) return;
    if (editing) {
      await api.updateAlgorithmTemplate(editing.id, newName.trim(), conditions);
      setTemplates((prev) => prev.map((t) =>
        t.id === editing.id ? { ...t, name: newName.trim(), conditions } : t
      ));
    } else {
      const created = await api.createAlgorithmTemplate(newName.trim(), conditions);
      setTemplates((prev) => [...prev, created]);
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowForm(false); }, 1500);
  }

  async function handleDelete(id: string) {
    await api.deleteAlgorithmTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editing?.id === id) setShowForm(false);
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>算法庫</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>管理可跨群組共用的算法模板</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {templates.map((t) => (
          <div key={t.id} style={{
            background: '#fff', borderRadius: '12px', padding: '16px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{t.name}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                  {t.conditions.conditions.length} 個條件
                </span>
              </div>
              <button
                onClick={() => startEdit(t)}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                編輯
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                style={{ background: '#fff0f0', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                刪除
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px solid #e2e8f0' }}>
            尚無算法模板，點下方建立第一個
          </div>
        )}
      </div>

      {!showForm && (
        <button
          onClick={startNew}
          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          + 新增模板
        </button>
      )}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
            {editing ? `編輯：${editing.name}` : '新增模板'}
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="模板名稱（如「動能型」）"
            style={{ border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', width: '100%', marginBottom: '16px', outline: 'none', boxSizing: 'border-box' }}
          />
          {mode === 'preset'
            ? <PresetSignalPicker value={conditions} onChange={setConditions} />
            : <ConditionBuilder conditions={conditions} onChange={setConditions} />
          }
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={handleSave}
              style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              儲存
            </button>
            {saved && <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>}
            <button
              onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', marginLeft: 'auto' }}
            >
              取消
            </button>
            <button
              onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
            >
              {mode === 'preset' ? '⚙ 進階模式' : '← 回到訊號選擇'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route and nav link in `web/src/App.tsx`**

Add import:
```tsx
import { AlgorithmLibrary } from './pages/AlgorithmLibrary';
```

Add nav link to the nav array (after `{ to: '/settings', label: '設定', exact: false }`):
```tsx
{ to: '/algorithm-library', label: '算法庫', exact: false },
```

Add route inside `<Routes>` (after the `/watchlist/:id/algorithm` route):
```tsx
<Route path="/algorithm-library" element={<AlgorithmLibrary />} />
```

- [ ] **Step 3: Manual smoke test — full flow in browser**

1. Open the app in browser (`npm run dev` from `web/`)
2. Go to **算法庫** → 新增模板 → 命名「動能型」→ 選 RSI < 30 → 儲存 ✓
3. Go to a watchlist (e.g. 台股) → 建立群組「AI概念」
4. 在「AI概念」tab → 點「⚙ 未設預設算法 ▾」→ 選「動能型」→ tab 按鈕更新為「⚙ 群組算法：動能型 ▾」 ✓
5. 新增一支股票到「AI概念」→ 卡片顯示「繼承：AI概念」藍色 badge ✓
6. 點「設定算法」→ 頂部顯示「繼承 AI概念 | 自訂」→ 條件 read-only ✓
7. 點「覆蓋為自訂」→ 編輯器解鎖 → 修改條件 → 儲存 ✓
8. 回到卡片 → badge 變灰「自訂算法」 ✓
9. 回到算法庫 → 編輯「動能型」改條件 → 儲存 ✓
10. 回到 AI概念 tab → 該股票仍顯示「自訂算法」（不受影響） ✓

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/AlgorithmLibrary.tsx web/src/App.tsx
git commit -m "feat: add AlgorithmLibrary page and route"
```
