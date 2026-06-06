# TwStocks 追蹤清單 shadcn/Tailwind 重寫設計

**日期**: 2026-06-06  
**目標**: 在 `/tw-stocks-new` 建立與 `/tw-stocks` 畫面完全相同的頁面，底層改用 shadcn/ui + Tailwind utility class，不影響現有路由與元件。

---

## 範圍

- **在範圍內**：追蹤清單 tab（`Watchlist.tsx` 的 shadcn 版本）
- **不在範圍內**：推薦 tab、訊號歷史 tab、其他頁面（us-stocks、crypto、fx 等）
- **不改動**：現有 `Watchlist.tsx`、`TwStocks.tsx`、`App.tsx` 的原有路由

---

## 變更清單

### 1. `web/src/index.css` — 修正 Primary 色

將 shadcn 預設的灰階 primary 改為 indigo，使 `<Button>` 預設呈現紫色，與 app 現有視覺一致。

```css
/* :root 區塊內修改 */
--primary: oklch(0.585 0.233 277.117);  /* ≈ #6366f1 indigo */
--primary-foreground: oklch(1 0 0);      /* white */
```

> 此修改會影響所有已使用 shadcn Button 的地方（目前僅 `components/ui/` 底下，尚未被任何頁面引用），不影響使用 inline style 的現有頁面。

---

### 2. `web/src/App.tsx` — 新增路由

在現有路由清單新增一條，不移除或修改任何現有路由：

```tsx
import { TwStocksNew } from './pages/TwStocksNew';
// ...
<Route path="/tw-stocks-new/*" element={<TwStocksNew />} />
```

Nav bar 也新增一個連結 `{ to: '/tw-stocks-new', label: '台股(新)' }` 方便切換比對。

---

### 3. `web/src/pages/TwStocksNew.tsx` — 新頁面

複製 `TwStocks.tsx` 的 tab 結構，追蹤清單 tab 改指向 `WatchlistNew`，其他兩個 tab（推薦、訊號歷史）繼續用原有元件：

```tsx
import { WatchlistNew } from './WatchlistNew';
// tabs 路徑改為 /tw-stocks-new
// <Route index element={<WatchlistNew />} />
```

`SubTabNav` 元件維持不動。

---

### 4. `web/src/pages/WatchlistNew.tsx` — 核心重寫

所有 state、API call、event handler 100% 複製自 `Watchlist.tsx`，只替換 JSX 的視覺層。

#### Button 對應表

| 用途 | 原本 inline style | 改用 shadcn |
|------|-------------------|-------------|
| 新增股票（submit） | 紫底白字 | `<Button type="submit">新增</Button>` |
| 批量匯入 | 藍底紫字 | `<Button variant="outline">↑ 批量匯入...</Button>` |
| 批次套用模板 | 藍底紫字 | `<Button variant="outline">⚙ 批次套用模板 ▾</Button>` |
| 設定算法 | 灰底深字 | `<Button variant="outline" size="sm">設定算法</Button>` |
| 暫停／啟用 | 灰底深字 | `<Button variant="outline" size="sm">暫停 / 啟用</Button>` |
| 刪除股票 | 紅底紅字 | `<Button variant="destructive" size="sm">刪除</Button>` |
| 刪除群組 | 紅邊紅字 | `<Button variant="destructive" size="sm">刪除群組</Button>` |
| 建立群組（submit） | 紫底白字 | `<Button type="submit" size="sm">建立</Button>` |
| 取消建立群組 | 無樣式 | `<Button variant="ghost" size="sm">取消</Button>` |

#### Layout / Card 對應表

| 原本 inline style | 改用 Tailwind class |
|-------------------|---------------------|
| `background:#fff, borderRadius:12px, border:1px solid #e2e8f0, boxShadow:...` | `bg-white rounded-xl border border-slate-200 shadow-sm p-4` |
| `background:#f8fafc` 空狀態 | `bg-slate-50 rounded-xl border border-slate-200 p-8 text-center` |

#### Badge / Tag（不用 shadcn Badge，直接 Tailwind span）

| 用途 | Tailwind class |
|------|----------------|
| 追蹤中 | `text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium` |
| 已暫停 | `text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium` |
| 模板名稱 | `text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-0.5 rounded-full` |
| 自訂算法 | `text-xs bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full` |
| 群組 tag（可點擊） | `text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium cursor-pointer` |
| + 群組 button | `text-xs text-slate-400 border border-dashed border-slate-300 rounded-full px-2 py-0.5 bg-none cursor-pointer` |

#### 狀態指示燈

```tsx
<span className={`w-2 h-2 rounded-full shrink-0 ${item.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
```

---

## 不變的部分

- `StockSearch.tsx`、`GroupPicker.tsx`、`BulkImport.tsx`、`AlgorithmTemplatePicker.tsx`、`PresetSignalPicker.tsx` — 全部直接 import 使用，不修改
- `SubTabNav.tsx` — 直接 import 使用
- `api/client.ts`、`types.ts` — 完全不動
- 所有 state 邏輯、API 呼叫、事件處理 — 100% 維持不變

---

## 完成標準

1. `/tw-stocks-new` 畫面與 `/tw-stocks` 視覺上無法區分
2. 所有功能（新增、刪除、群組、批量匯入、算法設定）運作正常
3. 現有 `/tw-stocks` 及其他頁面無任何變化
4. TypeScript 無編譯錯誤
