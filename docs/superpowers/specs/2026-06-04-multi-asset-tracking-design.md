# Multi-Asset Tracking Design

**Date:** 2026-06-04  
**Scope:** 擴充 market-pulse 支援美股、加密貨幣、匯率追蹤，保持簡單初期架構並留好擴充點

---

## 目標

在現有台股追蹤系統之上，新增三種資產類型的完整追蹤功能（watchlist + 算法條件 + 排程掃描 + 通知），各自有獨立頁面與 sub-tab 結構。初期架構簡單可跑，但資料模型與介面設計預留擴充空間。

---

## 資料模型

### watchlist 表新增欄位

```sql
ALTER TABLE watchlist ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'tw_stock';
```

`asset_type` 可能值：`'tw_stock'` | `'us_stock'` | `'crypto'` | `'fx'`

`algorithms` 表不修改，條件結構（RSI、MA、MACD、BB）對所有資產類型通用。

### FX symbol 格式

匯率的 symbol 使用 `BASE/QUOTE` 格式，例如 `USD/TWD`、`EUR/JPY`。支援貨幣：USD、GBP、EUR、TWD、JPY、AUD、CHF（共 42 對，含反向）。

---

## Scheduler 架構

### DataFetcher 介面

```typescript
// scheduler/src/fetchers/types.ts
interface DataFetcher {
  fetchOHLCV(symbol: string, timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]>;
}
```

各資產類型各自實作：

| 檔案 | API | 費用 | 升級路徑 |
|------|-----|------|----------|
| `fetchers/tw-stock.ts` | TWSE + FinMind（現有） | $0 | 不動 |
| `fetchers/us-stock.ts` | Finnhub 免費版 | $0 | 換此檔案即可升至 Polygon.io |
| `fetchers/crypto.ts` | Binance Public API | $0 | 長期穩定，無需換 |
| `fetchers/fx.ts` | ExchangeRate-API 免費版 | $0 | 換此檔案升級 |

### 調度流程

調度器根據 `asset_type` 選對應 fetcher，後續流程完全複用現有邏輯：

```
fetchOHLCV() → calculateIndicators() → evaluateConditionTree() → 通知
```

### 時間週期

| 資產 | 時間週期 | 排程頻率 |
|------|----------|----------|
| 台股 | 日線 | 每日收盤後（現有） |
| 美股 | 日線 | 每日收盤後（美東時間） |
| 加密 | 小時線 | 每小時 |
| 匯率 | 日線 | 每日 |

### 初期簡化

- 美股、加密、匯率先只做 watchlist 掃描，不做 recommendation scan
- Recommendation scan 之後可加，因為 DataFetcher 介面已統一

---

## API 選擇

### 美股：Finnhub

- 免費版：60 calls/min，無需信用卡
- 支援 OHLCV candles、股票搜尋（含 S&P 500 標的）
- 日線資料端點：`/stock/candle?symbol=AAPL&resolution=D`
- 升級：換 `fetchers/us-stock.ts` 即可切至 Polygon.io Starter ($29/月)

### 加密貨幣：Binance Public API

- 完全免費，官方公開端點，無需 API key
- 支援日線與小時線：`/api/v3/klines?symbol=BTCUSDT&interval=1h`
- 速率限制：1,200 requests/min（足夠）
- 幣種清單：固定前 50 大主流幣清單維護在前端

### 匯率：ExchangeRate-API

- 免費版：1,500 次/月，含 TWD
- 僅支援日線（符合需求）
- 每次取得一個 base 幣對所有 quote 的匯率，一次呼叫涵蓋所有配對
- 端點：`/v6/{API_KEY}/latest/{base}`

---

## Frontend 頁面結構

### 頂層導覽

```
Market Pulse | 首頁 | 台股 | 美股 | 加密貨幣 | 匯率 | 設定
```

現有的「推薦」與「訊號歷史」從頂層移除，改為各資產類型的 sub-tab。

### Sub-tab 結構

| 頁面 | Sub-tabs |
|------|----------|
| 台股 | 追蹤清單 ｜ 推薦 ｜ 訊號歷史 |
| 美股 | 追蹤清單 ｜ 訊號歷史 |
| 加密貨幣 | 追蹤清單 ｜ 訊號歷史 |
| 匯率 | 追蹤清單 ｜ 訊號歷史 |

### 路由

```
/tw-stocks                    → 台股（預設進追蹤清單）
/tw-stocks/recommendations
/tw-stocks/signals

/us-stocks                    → 美股
/us-stocks/signals

/crypto                       → 加密貨幣
/crypto/signals

/fx                           → 匯率
/fx/signals
```

### 元件複用

- 現有 `Watchlist.tsx` 重構為接受 `assetType` prop 的通用元件 `AssetWatchlist`
- `StockSearch` 依 `assetType` 切換搜尋來源：
  - `tw_stock`：現有本地 JSON
  - `us_stock`：Finnhub symbol search API
  - `crypto`：固定前 50 主流幣清單
  - `fx`：固定 42 貨幣對清單（7 種貨幣兩兩組合）
- `AlgorithmEditor` 不修改，所有資產類型共用相同條件介面

---

## 擴充路徑

| 功能 | 如何擴充 |
|------|----------|
| 美股推薦掃描 | 升級 Finnhub → Polygon.io，加 `runRecommendationScan('us_stock')` |
| 加密推薦掃描 | Binance 已夠，直接加 `runRecommendationScan('crypto')` |
| 更短時間週期 | `DataFetcher.fetchOHLCV` 已支援 timeframe 參數 |
| 新資產類型 | 實作新 fetcher + 加 asset_type 值，其餘流程不動 |

---

## 不在本次範圍

- 美股、加密、匯率的 recommendation scan
- FX 技術指標的特殊處理（使用與股票相同的計算邏輯）
- 即時報價（real-time streaming）
- 多時區排程管理 UI
