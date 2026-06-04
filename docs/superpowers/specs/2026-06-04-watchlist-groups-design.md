# 追蹤清單群組功能 — 設計文件

**日期：** 2026-06-04
**範圍：** DB migration、API routes、前端 web/src

---

## 目標

讓使用者可以把追蹤的股票分組（如「AI概念」、「半導體」），並透過 Tab 快速過濾。一支股票可同時屬於多個群組。支援批量匯入：貼入一串代號，自動解析並加入指定群組。

---

## 設計決策

| 項目 | 決定 |
|---|---|
| 群組與股票關係 | 多對多（一支股票可加多個群組） |
| UI 呈現 | Watchlist 頁頂部 Tab 切換過濾 |
| 群組管理 | 在每張股票卡片上直接加/移除標籤 |
| 批量匯入 | 大文字框貼入代號，自動偵測分隔符，預覽後確認 |
| 代號解析 | 從現有 `stocks.json`（1,090 筆）查名稱，找不到跳過 |

---

## DB Schema（新增 migration）

**`api/migrations/0002_groups.sql`**

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

---

## API Routes（新增）

**掛載在 `api/src/index.ts`：`/groups`**

| Method | Path | 說明 |
|---|---|---|
| `GET /groups` | 列出所有群組（含每組股票數） |
| `POST /groups` | 建立群組 `{ name }` |
| `DELETE /groups/:id` | 刪除群組（不刪股票） |
| `GET /watchlist/:id/groups` | 取得某股票的群組清單 |
| `PUT /watchlist/:id/groups` | 設定某股票的群組（全量替換）`{ groupIds: string[] }` |

**GET /groups 回傳：**
```json
[{ "id": "...", "name": "AI概念", "count": 3 }]
```

**GET /watchlist 調整：**
在現有回傳中加入 `groups` 欄位（JOIN 查詢）：
```json
[{
  "id": "...", "symbol": "2330", "name": "台積電", "enabled": 1,
  "groups": [{ "id": "...", "name": "AI概念" }]
}]
```

---

## 前端架構

### 修改 types（`web/src/types.ts`）

```ts
export interface Group {
  id: string;
  name: string;
  count?: number;
}

// WatchlistItem 加入 groups
export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  created_at: string;
  groups: Group[];
}
```

### 修改 API client（`web/src/api/client.ts`）

新增方法：
- `getGroups(): Promise<Group[]>`
- `createGroup(name: string): Promise<Group>`
- `deleteGroup(id: string): Promise<void>`
- `setWatchlistGroups(watchlistId: string, groupIds: string[]): Promise<void>`

### 修改 Watchlist 頁（`web/src/pages/Watchlist.tsx`）

**1. Tab 列：**
- 「全部」tab 永遠顯示
- 每個 group 一個 tab
- `activeGroup: string | null`（null = 全部）
- 過濾邏輯：`items.filter(item => !activeGroup || item.groups.some(g => g.id === activeGroup))`

**2. 股票卡片新增 group 標籤區：**
- 已加入的 group 顯示藍色 badge，點 × 移除
- 「+ 群組」按鈕開啟 inline 下拉：
  - 顯示現有 group 清單（已加入打勾）
  - 輸入框可建立新 group
  - 選取/取消即時呼叫 `setWatchlistGroups`

**3. 批量匯入（每個 group tab 下顯示）：**
- 大文字框 + 「解析」按鈕
- 解析邏輯（純前端）：
  ```ts
  const codes = input.split(/[\s,，、;\n]+/).map(s => s.trim()).filter(Boolean);
  ```
- 從 `stocks.json` 查名稱，找不到標記「找不到代號」（跳過）
- 顯示預覽清單（新增 / 已在清單 / 找不到）
- 確認後：
  1. 不在清單的呼叫 `api.addStock(symbol, name)`
  2. 所有成功的呼叫 `api.setWatchlistGroups(id, [...currentGroups, activeGroupId])`

---

## 資料流

```
使用者點「AI概念」tab
  → 前端過濾 items，只顯示有 AI概念 group 的股票

使用者在 2330 卡片點「+ 群組」
  → 下拉顯示現有 groups
  → 選「AI概念」
  → 前端呼叫 PUT /watchlist/2330-id/groups，body: { groupIds: ["ai-group-id"] }
  → 卡片上出現藍色 badge「AI概念」

使用者在「AI概念」tab 貼入「2330 2317 2382」
  → 前端解析 3 個代號
  → 查 stocks.json：2330 台積電、2317 鴻海、2382 廣達
  → 顯示預覽（2330 已在清單，2317/2382 新增）
  → 確認
  → POST /watchlist x2（新增 2317、2382）
  → PUT /watchlist/:id/groups x3（全部加入 AI概念）
```

---

## 不在範圍內

- 群組排序（固定按建立時間）
- 群組改名
- 股票在清單內拖曳排序
- 每個群組獨立算法設定（算法仍是 per 股票）

---

## 成功標準

1. 建立群組「AI概念」，加入 2330、2317 後，點 Tab 只看到這兩支
2. 2330 可同時屬於「AI概念」和「半導體」
3. 貼入「2330 2317,2382」能正確解析 3 支並匯入
4. 刪除群組後股票仍在清單，只是沒有那個 tag
5. 「全部」tab 永遠顯示所有股票
