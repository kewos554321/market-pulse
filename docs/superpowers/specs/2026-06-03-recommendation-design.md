# 推薦功能設計文件

**日期：** 2026-06-03
**狀態：** 已確認，待實作

---

## 功能概述

新增兩個子功能：
1. **推薦選股** — Scheduler 每日掃描自訂股票池（預設前 50 大市值台股，上限 120 支），對每支股票評估內建策略，將符合的結果存入 D1，前端透過 API 顯示今日推薦。
2. **策略模板** — 演算法編輯器新增「套用模板」下拉選單，提供 4 個內建策略一鍵套用到現有條件設定。

---

## 架構

### 資料庫（D1）

新增兩張表：

```sql
-- 推薦掃描股票池
CREATE TABLE recommendation_stocks (
  symbol     TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0  -- 1=前50大預設, 0=使用者自訂
);

-- 每日推薦結果
CREATE TABLE recommendations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  name        TEXT NOT NULL,
  close_price REAL NOT NULL,
  strategies  TEXT NOT NULL,   -- JSON array, e.g. ["黃金交叉","RSI超賣反彈"]
  created_at  TEXT NOT NULL
);
```

前 50 大預設股票於 migration 時寫入（`is_default=1`）。

### Cloudflare Worker API（新增路由）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/recommendations` | 取得最新一日推薦清單 |
| GET | `/recommendation-stocks` | 取得目前股票池清單 |
| POST | `/recommendation-stocks` | 新增股票（驗證總數 ≤ 120） |
| DELETE | `/recommendation-stocks/:symbol` | 移除股票 |

### Scheduler 流程（擴充）

原有的自選股掃描流程不變，完成後額外執行：

1. 呼叫 `GET /recommendation-stocks` 取得股票池清單
2. 對每支股票抓 OHLCV 資料（TWSE → fallback FinMind）
3. 計算技術指標
4. 對 4 個內建策略逐一評估
5. 收集符合至少一個策略的股票
6. 呼叫 API 寫入 `recommendations` 表（以今日日期整批寫入）

---

## 內建策略定義

| 策略名稱 | 條件邏輯 |
|----------|----------|
| 黃金交叉 | MA5 > MA20，且前一日 MA5 ≤ 前一日 MA20 |
| RSI 超賣反彈 | RSI14 < 30 |
| MACD 翻多 | MACD 黃金交叉（MACD 線由下穿過訊號線） |
| KD 黃金交叉 | KD 黃金交叉（K 線由下穿過 D 線） |

策略以靜態物件定義在 Scheduler 程式碼中，不需資料庫儲存。

---

## 前端 UI

### 新增「推薦」頁（`/recommendations`）

- 導覽列新增「推薦」入口
- 顯示掃描日期
- 每支符合股票顯示：代號、名稱、收盤價、符合的策略標籤（可多個）
- 每筆右側有「加入追蹤清單」按鈕（若已在清單中則灰化顯示）

### 設定頁新增「推薦股票池」區塊

- 顯示目前股票池清單（代號、名稱、是否為預設）
- 可刪除任一股票（包含預設股票）
- 搜尋欄輸入台股代號與名稱，按「新增」加入（總數上限 120，超過則顯示錯誤）
- 顯示目前股票數 / 上限（例如 `50 / 120`）

### 演算法編輯器新增「套用模板」

- 頁面頂部新增下拉選單，列出 4 個內建策略
- 選擇後彈出確認對話框：「套用模板將覆蓋現有條件，確定嗎？」
- 確認後填入對應的條件設定

---

## 邊界條件與錯誤處理

- 推薦頁在今日資料尚未產生時，顯示最近一次的推薦結果並標示日期；若完全無資料（首次執行前），顯示「尚無推薦資料，請等待排程執行」
- 新增股票池超過 120 筆時，API 回傳 400 並顯示錯誤訊息
- Scheduler 掃描股票池時若單支股票資料不足，跳過並繼續（與現有自選股邏輯一致）
- 「加入追蹤清單」若股票已存在，顯示「已在追蹤清單中」

---

## 不在此範圍內

- 使用者自訂策略模板的建立與儲存（未來再做）
- 推薦結果的歷史查詢（只顯示最新一日）
- 推薦結果的 email 通知
