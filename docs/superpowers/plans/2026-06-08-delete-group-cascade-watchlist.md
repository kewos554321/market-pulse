# Delete Group → Cascade Delete Orphan Watchlist Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 刪除群組時，自動刪除僅屬於該群組（無其他 tag）的 watchlist 標的。

**Architecture:** 後端 `DELETE /groups/:id` 先查孤兒標的 IDs，再依序刪群組（cascade 清 junction table）、刪孤兒標的，並在 response 回傳 `deletedWatchlistIds`；前端 `handleDeleteGroup` 用該陣列同步清除 items state。

**Tech Stack:** Hono (Cloudflare Workers), D1 (SQLite), Vitest, React

---

## Files

| Action | File |
|--------|------|
| Modify | `api/src/routes/groups.ts` |
| Modify | `web/src/api/client.ts` |
| Modify | `web/src/pages/Watchlist.tsx` |
| Create | `api/test/groups.test.ts` |

---

## Task 1: Backend — DELETE /groups/:id 加上孤兒標的刪除邏輯

**Files:**
- Modify: `api/src/routes/groups.ts`
- Create: `api/test/groups.test.ts`

- [ ] **Step 1: 建立 test 檔，寫 4 個失敗測試**

建立 `api/test/groups.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { groupRoutes } from '../src/routes/groups';
import { mockDB, makeEnv, req } from './helpers';

function makeApp() {
  const app = new Hono();
  app.route('/groups', groupRoutes);
  return app;
}

describe('DELETE /groups/:id', () => {
  it('returns 404 when group not found', async () => {
    const app = makeApp();
    // queue: [orphan query → empty, delete group → 0 changes]
    const env = makeEnv(mockDB([{ all: [] }, { changes: 0 }]));
    const res = await req(app, 'DELETE', '/groups/missing-id', env);
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Not found');
  });

  it('deletes group with no orphans, returns empty deletedWatchlistIds', async () => {
    const app = makeApp();
    // queue: [orphan query → empty, delete group → 1 change]
    const env = makeEnv(mockDB([{ all: [] }, { changes: 1 }]));
    const res = await req(app, 'DELETE', '/groups/g-1', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; deletedWatchlistIds: string[] };
    expect(body.success).toBe(true);
    expect(body.deletedWatchlistIds).toEqual([]);
  });

  it('deletes group and orphan watchlist items, returns their IDs', async () => {
    const app = makeApp();
    // queue: [orphan query → 2 items, delete group → 1, delete orphans → 2]
    const env = makeEnv(mockDB([
      { all: [{ id: 'w-1' }, { id: 'w-2' }] },
      { changes: 1 },
      { changes: 2 },
    ]));
    const res = await req(app, 'DELETE', '/groups/g-1', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; deletedWatchlistIds: string[] };
    expect(body.success).toBe(true);
    expect(body.deletedWatchlistIds).toEqual(['w-1', 'w-2']);
  });

  it('does not delete watchlist items that belong to other groups', async () => {
    const app = makeApp();
    // orphan query returns empty (items have other groups) → no orphan delete call
    const env = makeEnv(mockDB([{ all: [] }, { changes: 1 }]));
    const res = await req(app, 'DELETE', '/groups/g-1', env);
    const body = await res.json() as { deletedWatchlistIds: string[] };
    expect(body.deletedWatchlistIds).toEqual([]);
  });
});
```

- [ ] **Step 2: 確認測試失敗**

```bash
cd /Users/kewos/Documents/projects/market-pulse/api
npx vitest run test/groups.test.ts
```

預期：全部 4 個 FAIL（`groupRoutes.delete` 尚未更新，回傳 `{ success: true }` 而沒有 `deletedWatchlistIds`）

- [ ] **Step 3: 更新 `api/src/routes/groups.ts` 的 delete handler**

將現有的 `groupRoutes.delete('/:id', ...)` 整段取代：

```ts
groupRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  // Find watchlist items that only belong to this group
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
```

- [ ] **Step 4: 確認測試通過**

```bash
cd /Users/kewos/Documents/projects/market-pulse/api
npx vitest run test/groups.test.ts
```

預期：4 個 PASS

- [ ] **Step 5: 跑全部 API 測試，確認沒有 regression**

```bash
cd /Users/kewos/Documents/projects/market-pulse/api
npx vitest run
```

預期：全部 PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/routes/groups.ts api/test/groups.test.ts
git commit -m "feat: cascade delete orphan watchlist items when group is deleted"
```

---

## Task 2: Frontend — API client 型別更新 + handleDeleteGroup 同步 state

**Files:**
- Modify: `web/src/api/client.ts:68` (deleteGroup 這行)
- Modify: `web/src/pages/Watchlist.tsx` (handleDeleteGroup function)

- [ ] **Step 1: 更新 `web/src/api/client.ts` 的 `deleteGroup` 回傳型別**

找到這一行：
```ts
deleteGroup: (id: string) => request<{ success: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
```

改為：
```ts
deleteGroup: (id: string) => request<{ success: boolean; deletedWatchlistIds: string[] }>(`/groups/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: 更新 `web/src/pages/Watchlist.tsx` 的 `handleDeleteGroup`**

找到現有的：
```ts
async function handleDeleteGroup(groupId: string) {
  await api.deleteGroup(groupId);
  setGroups((prev) => prev.filter((g) => g.id !== groupId));
  if (activeGroupId === groupId) setActiveGroupId(null);
}
```

改為：
```ts
async function handleDeleteGroup(groupId: string) {
  const { deletedWatchlistIds } = await api.deleteGroup(groupId);
  setGroups((prev) => prev.filter((g) => g.id !== groupId));
  setItems((prev) => prev.filter((i) => !deletedWatchlistIds.includes(i.id)));
  if (activeGroupId === groupId) setActiveGroupId(null);
}
```

- [ ] **Step 3: TypeScript 型別檢查**

```bash
cd /Users/kewos/Documents/projects/market-pulse/web
npx tsc --noEmit
```

預期：0 errors

- [ ] **Step 4: Commit**

```bash
git add web/src/api/client.ts web/src/pages/Watchlist.tsx
git commit -m "feat: remove orphan watchlist items from state after group deletion"
```

---

## Task 3: 手動驗證

- [ ] **Step 1: 啟動 dev server**

```bash
cd /Users/kewos/Documents/projects/market-pulse
# 依專案現有啟動方式（web + api）
```

- [ ] **Step 2: 建立測試資料**

1. 新增 2 個群組：`GroupA`、`GroupB`
2. 新增 3 個標的：`2330 台積電`、`2317 鴻海`、`2454 聯發科`
3. 把 `台積電` 加入 `GroupA` 和 `GroupB`
4. 把 `鴻海` 只加入 `GroupA`
5. `聯發科` 不加入任何群組

- [ ] **Step 3: 刪除 GroupA，驗證結果**

預期：
- `台積電` **仍然存在**（還有 GroupB）
- `鴻海` **被自動刪除**（只屬於 GroupA）
- `聯發科` **仍然存在**（本來就沒有群組）
- GroupA tab 消失，切換到「全部」view

- [ ] **Step 4: 確認 Network response**

開 DevTools → Network，找到 `DELETE /api/groups/...` 的 response：
```json
{
  "success": true,
  "deletedWatchlistIds": ["<鴻海的 id>"]
}
```
