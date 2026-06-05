# Group 算法繼承功能 — 設計文件

**日期：** 2026-06-05
**範圍：** DB migration、API routes、前端 web/src

---

## 目標

讓使用者可以在 group 層級設定預設算法模板，底下的股票自動繼承，個別股票需要微調時再覆蓋為自訂。算法模板獨立管理，可跨多個 group 重用。

---

## 設計決策

| 項目 | 決定 |
|---|---|
| 算法模板 | 獨立實體，有名稱（動能型、穩健型...），可跨 group 重用 |
| Group 預設 | 每個 group 可指向一個算法模板（nullable） |
| Stock 繼承 | 每支股票選擇「繼承哪個 group」或「自訂」 |
| 繼承方式 | 活繼承：group 換模板後，所有繼承該 group 的股票自動更新 |
| 自訂覆蓋 | 股票切換為「自訂」後斷開繼承鏈，存在現有 algorithms 表 |
| 多 group 衝突 | 股票明確選擇繼承哪個 group，不自動推斷 |

---

## DB Schema

### 新增 `algorithm_templates` 表（新 migration）

```sql
CREATE TABLE IF NOT EXISTS algorithm_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  conditions TEXT NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 修改 `groups` 表

```sql
ALTER TABLE groups
  ADD COLUMN algorithm_template_id TEXT REFERENCES algorithm_templates(id) ON DELETE SET NULL;
```

### 修改 `watchlist` 表

```sql
ALTER TABLE watchlist
  ADD COLUMN algorithm_source_group_id TEXT REFERENCES groups(id) ON DELETE SET NULL;
-- NULL = 自訂算法；有值 = 活繼承指定 group 的模板
```

`algorithms` 表不變，僅在 `source = 'custom'` 時使用。

---

## 繼承解析邏輯

```
GET /watchlist/:id/algorithm 的有效條件：
  if watchlist.algorithm_source_group_id 有值:
    group = groups[source_group_id]
    if group.algorithm_template_id 有值:
      template = algorithm_templates[template_id]
      return { source: 'group', sourceGroupName: group.name,
               templateName: template.name, conditions: template.conditions }
    else:
      return { source: 'group', sourceGroupName: group.name,
               templateName: null, conditions: emptyTree }
  else:
    row = algorithms[watchlist_id]
    return { source: 'custom', conditions: row.conditions }
```

---

## API Routes

### 新增：`/algorithm-templates`

| Method | Path | 說明 |
|---|---|---|
| `GET /algorithm-templates` | 列出所有模板 |
| `POST /algorithm-templates` | 建立 `{ name, conditions }` |
| `PUT /algorithm-templates/:id` | 更新名稱或條件 |
| `DELETE /algorithm-templates/:id` | 刪除（使用此模板的 group 自動 SET NULL） |

**GET 回傳：**
```json
[{ "id": "...", "name": "動能型", "conditions": {...}, "updated_at": "..." }]
```

### 修改：`/groups`

新增：
```
PUT /groups/:id/algorithm-template   body: { templateId: string | null }
```

`GET /groups` 回傳加入：
```json
[{ "id": "...", "name": "AI概念", "count": 3,
   "algorithmTemplate": { "id": "...", "name": "動能型" } | null }]
```

### 修改：`/watchlist`

新增：
```
PUT /watchlist/:id/algorithm-source   body: { sourceGroupId: string | null }
-- null = 切換為自訂（不影響 algorithms 表的現有資料）
```

`GET /watchlist` 回傳每個 item 加入：
```json
{ "algorithmSourceGroupId": "group-id" | null }
```

### 修改：`GET /watchlist/:id/algorithm`（現有）

回傳格式擴充：
```json
{
  "source": "group",
  "sourceGroupId": "...",
  "sourceGroupName": "AI概念",
  "templateName": "動能型",
  "conditions": { ... }
}
```
或：
```json
{
  "source": "custom",
  "conditions": { ... }
}
```

`PUT /watchlist/:id/algorithm`（現有）維持不變，只在 `source = 'custom'` 時呼叫。

---

## 前端架構

### 新增檔案

**`web/src/pages/AlgorithmLibrary.tsx`**
- 列出所有模板：名稱、條件摘要、使用中的 group 數量
- 操作：新增模板、點進去編輯（同款 ConditionBuilder 介面）、刪除
- 入口：頂部 Nav 加「算法庫」連結

**`web/src/components/AlgorithmTemplatePicker.tsx`**
- Dropdown 元件，列出現有模板（目前套用的標記 ✓）
- 最下方「+ 建立新模板」選項（跳到 AlgorithmLibrary）
- 選取後呼叫 `PUT /groups/:id/algorithm-template`

### 修改現有檔案

**`web/src/pages/Watchlist.tsx`**
- Group tab 右側加「⚙ 群組預設算法：{templateName} ▾」按鈕，僅在非「全部」tab 顯示
- 無模板時顯示「⚙ 未設預設算法」
- 點擊展開 `AlgorithmTemplatePicker`
- 股票卡片加算法來源 badge：
  - 藍色「繼承：{groupName}」— 繼承中且 group 已設模板
  - 黃色「繼承：{groupName}（未設模板）」— 繼承中但 group 尚未設模板
  - 灰色「自訂算法」— 自訂
- 新增股票時：在 group tab 下新增 → 自動設 `algorithm_source_group_id` 為該 group；在「全部」tab 下新增 → `algorithm_source_group_id` 為 null

**`web/src/pages/AlgorithmEditor.tsx`**
- 頂部加來源選擇列：依股票所屬 groups 動態產生「繼承 {groupName}」按鈕 + 「自訂」按鈕
- 「繼承」狀態：conditions read-only 顯示模板內容，有「覆蓋為自訂 →」按鈕
- 「自訂」狀態：現有 ConditionBuilder 正常可編輯
- 儲存邏輯：
  - 繼承 → `PUT /watchlist/:id/algorithm-source { sourceGroupId }`
  - 自訂 → `PUT /watchlist/:id/algorithm-source { sourceGroupId: null }` + `PUT /watchlist/:id/algorithm`
  - 「覆蓋為自訂」→ 自動切換並解鎖編輯器

**`web/src/types.ts`**
```ts
export interface AlgorithmTemplate {
  id: string;
  name: string;
  conditions: ConditionTree;
  updated_at: string;
}

// Group 加入
export interface Group {
  id: string;
  name: string;
  count?: number;
  algorithmTemplate: { id: string; name: string } | null;
}

// WatchlistItem 加入
export interface WatchlistItem {
  // ...現有欄位...
  algorithmSourceGroupId: string | null;
}

// AlgorithmEditor 用
export interface AlgorithmState {
  source: 'group' | 'custom';
  sourceGroupId?: string;
  sourceGroupName?: string;
  templateName?: string | null;
  conditions: ConditionTree;
}
```

**`web/src/api/client.ts`** 新增方法：
- `getAlgorithmTemplates(): Promise<AlgorithmTemplate[]>`
- `createAlgorithmTemplate(name: string, conditions: ConditionTree): Promise<AlgorithmTemplate>`
- `updateAlgorithmTemplate(id: string, name: string, conditions: ConditionTree): Promise<void>`
- `deleteAlgorithmTemplate(id: string): Promise<void>`
- `setGroupAlgorithmTemplate(groupId: string, templateId: string | null): Promise<void>`
- `setWatchlistAlgorithmSource(watchlistId: string, sourceGroupId: string | null): Promise<void>`

---

## 資料流

```
使用者在「AI概念」tab 點「⚙ 未設預設算法」
  → AlgorithmTemplatePicker 展開
  → 選「動能型」
  → 前端呼叫 PUT /groups/ai-id/algorithm-template { templateId: "momentum-id" }
  → Tab 按鈕更新為「⚙ 群組預設算法：動能型 ▾」

使用者在「AI概念」tab 新增 2382（廣達）
  → 新增時自動設 algorithm_source_group_id = ai-group-id
  → 股票卡片顯示「繼承：AI概念」badge

使用者進入 2330 AlgorithmEditor
  → 頂部顯示「繼承 AI概念 ✓ | 繼承 0050成分股 | 自訂」
  → 條件 read-only 顯示動能型內容
  → 點「覆蓋為自訂」→ 編輯器解鎖
  → 修改條件後儲存
  → 呼叫 PUT /watchlist/2330-id/algorithm-source { sourceGroupId: null }
  → 呼叫 PUT /watchlist/2330-id/algorithm { conditions: {...} }
  → 卡片 badge 變灰「自訂算法」

使用者將「動能型」模板條件從 RSI<30 改為 RSI<25
  → PUT /algorithm-templates/momentum-id
  → 所有「繼承 AI概念」的股票（除了已自訂的 2330）下次取算法時自動得到新條件
```

---

## 不在範圍內

- 算法模板的版本歷史
- 模板套用的批量回滾
- group 改模板時主動通知使用者有哪些股票受影響（只在 Picker 底部顯示說明文字）
- 股票同時繼承多個 group（每次只能選一個繼承來源）

---

## 成功標準

1. 建立「動能型」模板，套到「AI概念」group，新加入的股票自動繼承
2. 修改「動能型」條件，所有繼承的股票（未自訂）立即反映新條件
3. 2330 進入 AlgorithmEditor 可看到「繼承 AI概念 | 繼承 0050成分股 | 自訂」三個來源選項
4. 2330 切換為自訂後，修改儲存，group 模板再改也不影響 2330
5. 刪除「動能型」模板後，AI概念 group 的預設自動清空，股票仍存在
