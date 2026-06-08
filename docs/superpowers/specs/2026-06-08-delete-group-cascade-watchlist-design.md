# Delete Group → Cascade Delete Orphan Watchlist Items

**Date:** 2026-06-08  
**Status:** Proposed

## Problem

當使用者刪除一個群組（tag）時，屬於該群組且沒有其他群組的標的（watchlist item）會變成「孤兒」—— 沒有任何 tag 的標的。使用者希望這些孤兒標的能自動一起刪除。

## Scope

- 僅刪除「**原本只屬於這個群組**」且刪除後「**沒有任何剩餘群組**」的標的。
- 從未被加入任何群組的標的**不受影響**（這些標的在刪除群組前本來就沒有 tag，不該被波及）。
- 只影響 `DELETE /groups/:id` 這支 API 的行為。

## Data Model

```
watchlist        groups         watchlist_groups
─────────        ──────         ────────────────
id               id             watchlist_id  → watchlist.id (CASCADE)
symbol           name           group_id      → groups.id (CASCADE)
name             created_at
enabled
asset_type
```

`watchlist_groups` 已設 `ON DELETE CASCADE`：刪除 group 時，對應的 junction rows 會自動消失。

## Design

### Backend — `DELETE /groups/:id`

**Step 1:** 刪除群組之前，先找出「只屬於這個群組」的 watchlist item IDs：

```sql
SELECT w.id
FROM watchlist w
JOIN watchlist_groups wg ON w.id = wg.watchlist_id
WHERE wg.group_id = :groupId
AND (
  SELECT COUNT(*) FROM watchlist_groups WHERE watchlist_id = w.id
) = 1
```

**Step 2:** 刪除群組（`DELETE FROM groups WHERE id = ?`）。  
→ cascade 自動清除 `watchlist_groups` 中屬於這個群組的 rows。

**Step 3:** 刪除 Step 1 查到的 watchlist items（`DELETE FROM watchlist WHERE id IN (...)`）。  
→ cascade 自動清除這些 items 的 `algorithms`、`signals`、`watchlist_groups` rows。

**Response** 改為回傳刪除的 watchlist IDs，讓前端同步狀態：

```json
{ "success": true, "deletedWatchlistIds": ["id1", "id2"] }
```

如果沒有孤兒標的，`deletedWatchlistIds` 為空陣列。

### Frontend — `handleDeleteGroup`

目前：
```ts
async function handleDeleteGroup(groupId: string) {
  await api.deleteGroup(groupId);
  setGroups(prev => prev.filter(g => g.id !== groupId));
  if (activeGroupId === groupId) setActiveGroupId(null);
}
```

改為：
```ts
async function handleDeleteGroup(groupId: string) {
  const { deletedWatchlistIds } = await api.deleteGroup(groupId);
  setGroups(prev => prev.filter(g => g.id !== groupId));
  setItems(prev => prev.filter(i => !deletedWatchlistIds.includes(i.id)));
  if (activeGroupId === groupId) setActiveGroupId(null);
}
```

### API Client — `deleteGroup`

```ts
deleteGroup: (id: string) =>
  request<{ success: boolean; deletedWatchlistIds: string[] }>(`/groups/${id}`, { method: 'DELETE' }),
```

## Files to Change

| File | Change |
|------|--------|
| `api/src/routes/groups.ts` | Step 1-3 邏輯、回傳 `deletedWatchlistIds` |
| `web/src/api/client.ts` | `deleteGroup` 回傳型別加上 `deletedWatchlistIds` |
| `web/src/pages/Watchlist.tsx` | `handleDeleteGroup` 用回傳值過濾 `items` |

## Error Handling

- 若 Step 1 查不到資料或群組不存在 → 維持現有 404 回傳。
- 若 Step 3 刪除 watchlist 失敗 → 因為 D1 batch 是 transactional，整批回滾（群組也不會被刪）。
- 前端若 `deletedWatchlistIds` 缺失（向後相容）→ 視為空陣列，僅清除群組。

## Non-goals

- **不**自動刪除從未有任何群組的標的。
- **不**提供 UI 確認（刪除群組時不額外詢問「也要刪除 N 個標的嗎？」）。  
  若未來需要確認 dialog，作為獨立功能追加。
- **不**修改 `handleToggleGroup`（手動移除 tag 時不觸發自動刪除標的）。

## Testing

- 刪除群組，其中有標的同時屬於其他群組 → 那些標的**不**被刪。
- 刪除群組，其中有標的只屬於這個群組 → 那些標的**被刪**。
- 刪除群組，群組內沒有標的 → 正常刪除，`deletedWatchlistIds: []`。
- 從未屬於任何群組的標的 → 不受影響。
