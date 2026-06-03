# UI 優化 + 股票搜尋自動提示 — 設計文件

**日期：** 2026-06-03
**範圍：** 前端 web/src

---

## 目標

1. 將現有 UI 從純 inline style 升級為簡潔現代風格（卡片、主色、統一間距）
2. 在追蹤清單新增股票時提供即時搜尋提示（輸入代號或名稱 → 下拉選單）

---

## 設計決策

| 項目 | 決定 |
|---|---|
| UI 風格 | 簡潔現代：白底、圓角卡片、Indigo 主色（#6366f1） |
| 股票資料來源 | 內建 JSON（bundled），不打外部 API |
| 搜尋 UI | 單一搜尋框 + 下拉提示，選取後自動填代號和名稱 |
| 導覽列 | 保留頂部水平導覽，加 logo 和 active 底線指示器 |

---

## 架構

### 新增檔案

**`web/src/data/stocks.json`**
台灣上市股票清單，格式：
```json
[
  { "symbol": "2330", "name": "台積電", "market": "上市" },
  { "symbol": "2317", "name": "鴻海", "market": "上市" }
]
```
來源：從 TWSE OpenAPI `https://openapi.twse.com.tw/v1/opendata/t187ap03_L` 下載並手動存成靜態 JSON，靜態打包進前端，約 1,000 筆，< 100KB。更新頻率：有新股上市時手動更新。

**`web/src/components/StockSearch.tsx`**
單一搜尋框元件：
- `props: { onSelect: (symbol: string, name: string) => void }`
- 輸入時過濾 stocks.json（代號前綴 OR 名稱包含）
- 最多顯示 8 筆結果
- 鍵盤支援：↑↓ 選項、Enter 確認、Escape 關閉
- 點擊外部關閉下拉

### 修改檔案

**`web/src/App.tsx`**
- 加 logo 文字「Market Pulse」（Indigo 色）
- NavLink active 樣式改為底線指示器
- 加全域 CSS reset（`box-sizing: border-box`、`font-family`）

**`web/src/pages/Watchlist.tsx`**
- 移除雙欄輸入（symbol + name），改用 `StockSearch` 元件
- 股票列表從 `<table>` 改為卡片列表
- 追蹤中：綠點 badge；已暫停：灰點 + opacity 0.7

**`web/src/pages/Home.tsx`**
- 加卡片容器包覆內容
- 統一標題和說明文字樣式

**`web/src/pages/Signals.tsx`**
- 訊號列表改為卡片
- 時間格式化（ISO → 台灣時間）

**`web/src/pages/Settings.tsx`**
- 表單欄位加 label + 說明文字
- 儲存按鈕改為 Indigo 主色

---

## 資料流

```
使用者輸入 "23"
  → StockSearch 過濾 stocks.json（本地，不打 API）
  → 顯示下拉：2330 台積電、2317 鴻海、2382 廣達...
  → 使用者選取 2330
  → onSelect("2330", "台積電") 回呼
  → Watchlist 呼叫 api.addStock("2330", "台積電")
```

---

## 樣式規範

| Token | 值 |
|---|---|
| 主色 | `#6366f1`（Indigo 500） |
| 主色 hover | `#4f46e5`（Indigo 600） |
| 成功綠 | `#10b981` |
| 危險紅 | `#ef4444` |
| 背景 | `#f8fafc` |
| 卡片背景 | `#ffffff` |
| 卡片 border | `1px solid #e2e8f0` |
| 卡片圓角 | `12px` |
| 卡片陰影 | `0 1px 3px rgba(0,0,0,0.06)` |
| 字體 | `-apple-system, BlinkMacSystemFont, sans-serif` |

不引入 UI 函式庫（Tailwind / shadcn），用 CSS-in-JS inline style 維持現有模式。

---

## 不在範圍內

- RWD / 手機版（下一期）
- 深色模式
- 動畫效果
- 上櫃股票資料（僅上市）
- 股票即時價格顯示

---

## 成功標準

1. 輸入「23」可看到相關股票下拉提示
2. 選取後代號和名稱自動填入，可直接按新增
3. 所有頁面無 inline style 顏色不一致的情況
4. 現有功能（新增、刪除、暫停、算法設定）全部正常
