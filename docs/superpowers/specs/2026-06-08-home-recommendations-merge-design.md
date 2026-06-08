# 首頁整合推薦選股設計文件

## 背景

推薦頁面（`/recommendations`）功能單一，導覽列佔一個 tab 卻不常用；首頁目前只有近期訊號，內容稀薄。將推薦結果整合到首頁，可減少導覽項目、讓首頁資訊更豐富。

## 範圍

- 導覽列：移除「首頁」與「推薦」兩個 nav item，Logo 改為可點擊首頁連結
- 首頁：整合推薦選股（上）與近期訊號（下）兩個區塊
- 設定頁：新增「管理股票池」區塊
- 移除：`/recommendations` 路由、`Recommendations.tsx`

## 導覽列

**改動前：** `Market Pulse（文字）｜首頁｜台股｜美股｜加密貨幣｜匯率｜推薦｜設定｜算法庫`

**改動後：** `Market Pulse（Link → /）｜台股｜美股｜加密貨幣｜匯率｜設定｜算法庫`

- `App.tsx` 中的 `<span>Market Pulse</span>` 改為 `<Link to="/">`，樣式維持不變
- nav items 陣列移除 `{ to: '/', label: '首頁' }` 與 `{ to: '/recommendations', label: '推薦' }`

## 首頁（`Home.tsx`）

兩個區塊由上而下排列，各自是獨立的 `<Card>`：

### 區塊一：推薦選股

- 標題「推薦選股」，副標「每日排程掃描結果」
- 顯示掃描日期
- 表格欄位：代號、名稱、收盤價、符合策略（Badge）、加入追蹤（Button）
- 空狀態：「尚無推薦資料，請等待排程執行。」或「今日無符合策略的標的。」
- 資料來源：`api.getRecommendations()`、`api.getWatchlist()`
- 「加入追蹤」邏輯與原 Recommendations 頁相同（`api.addStock`、`addedSymbols` state）

### 區塊二：近期訊號

- 標題「近期訊號」
- 顯示最近 10 筆觸發訊號
- 資料來源：`api.getSignals(10)`
- 空狀態：「目前沒有觸發訊號。」

兩個區塊的資料獨立 fetch，互不影響。

## 設定頁（`Settings.tsx`）

新增「管理股票池」區塊，內容從 `Recommendations.tsx` 搬移：

- 展開/收合 Button，顯示「管理股票池」+ 計數（n / 120 支）
- 展開後顯示：
  - 新增股票表單（代號、名稱輸入框 + 新增 Button + 錯誤提示）
  - 股票清單表格（代號、名稱、類型 Badge、移除 Button）
- 資料來源：`api.getRecommendationStocks()`、`api.addRecommendationStock()`、`api.deleteRecommendationStock()`

## 移除

- `web/src/pages/Recommendations.tsx` — 整個刪除
- `App.tsx` — 移除 `import { Recommendations }` 與 `<Route path="/recommendations" element={<Recommendations />} />`

## 不在範圍內

- 推薦演算法、API、排程邏輯不動
- 其他頁面（台股、美股、加密貨幣、匯率、算法庫）不動
- 設定頁現有內容不動，只新增股票池區塊
