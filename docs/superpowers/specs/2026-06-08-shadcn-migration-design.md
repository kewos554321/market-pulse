# shadcn/ui 全站遷移設計

## 目標

將所有頁面（除台股舊頁 TwStocks/Watchlist）統一遷移至 shadcn/ui + Tailwind，消除 inline `style={{}}` 用法，讓全站視覺以 `WatchlistNew` 為基準保持一致。

---

## Section 1：架構原則

- **禁止 inline `style={{}}`**。所有樣式透過 Tailwind class 表達。
- **顏色使用 CSS variable token**，不硬寫 hex：
  - 主色：`text-primary` / `bg-primary`（已對應 indigo `#6366f1`）
  - 次要文字：`text-muted-foreground`
  - 邊框：`border-border`
  - 卡片背景：`bg-card`
- **CSS variable 已就緒**，`index.css` 不需要修改。
- 組件分層：shadcn 原子元件 → 自製業務 component → Page 組裝。

---

## Section 2：元件對應規範

| 舊用法 | 新用法 |
|--------|--------|
| `div` with background/borderRadius/boxShadow | `<Card><CardContent>` |
| inline button，primary 色 | `<Button>` (default variant) |
| inline button，灰底 | `<Button variant="secondary">` |
| delete / danger button | `<Button variant="destructive" size="sm">` |
| status tag（enabled/disabled） | `<Badge>` / `<Badge variant="secondary">` |
| `input` with inline border | `<Input>`（需新增 shadcn 元件） |
| `select` with inline style | `<Select>`（已安裝） |
| page title h1 + subtitle p | `<h1 className="text-xl font-bold">` + `<p className="text-sm text-muted-foreground">` |

**需新增的 shadcn 元件**：`input`、`label`（Settings 頁使用）

---

## Section 3：遷移順序

### Phase 1 — Shared Components（改一個，多頁受益）

| 檔案 | 主要變更 | 影響頁面 |
|------|---------|---------|
| `SubTabNav.tsx` | active tab 用 `text-primary border-primary` | 全部有 sub-tab 的頁面 |
| `AssetWatchlist.tsx` | Card + Button + Input，移除 inline style | UsStocks、Crypto、Fx |
| `AssetSearch.tsx` | Input + Button 換 shadcn | 同上 |
| `AssetSignals.tsx` | Card + Badge | 同上 |

### Phase 2 — 獨立頁面

| 檔案 | 主要變更 |
|------|---------|
| `Home.tsx` | Card wrapping，`text-primary` 取代 `#6366f1` |
| `Recommendations.tsx` | Card、Badge（signal status）、Button |
| `Settings.tsx` | Card、Input、Label、Button — 刪除 `cardStyle`/`inputStyle`/`btnStyle` 常數 |
| `AlgorithmLibrary.tsx` | Card list、Button |
| `AlgorithmEditor.tsx` | Card sections、Button、Select |

### Phase 3 — App.tsx Navbar（最後）

inline style 全換 Tailwind，NavLink active state 改用 `className` callback。

### 不動範圍

`TwStocks.tsx`、`Watchlist.tsx` — 台股舊頁保持原樣。

---

## Section 4：Layout 慣例

- **Max-width**：900px，定義在 `App.tsx` `<main>`，各 page 不需再設。
- **Page 內 vertical spacing**：`space-y-4` 或 `space-y-6`。
- **Card 內 padding**：`CardContent` 預設 padding 已足夠，不另加。
- **Page header**：`h1 + p` 組合，`mb-5` 間距後接 Card。

---

## Migration Status

| 檔案 | 狀態 |
|------|------|
| `WatchlistNew.tsx` | ✅ 已完成 |
| `SubTabNav.tsx` | ⬜ 待遷移 |
| `AssetWatchlist.tsx` | ⬜ 待遷移 |
| `AssetSearch.tsx` | ⬜ 待遷移 |
| `AssetSignals.tsx` | ⬜ 待遷移 |
| `Home.tsx` | ⬜ 待遷移 |
| `Recommendations.tsx` | ⬜ 待遷移 |
| `Settings.tsx` | ⬜ 待遷移 |
| `AlgorithmLibrary.tsx` | ⬜ 待遷移 |
| `AlgorithmEditor.tsx` | ⬜ 待遷移 |
| `App.tsx` (navbar) | ⬜ 待遷移 |
| `TwStocks.tsx` | 🚫 不動 |
| `Watchlist.tsx` | 🚫 不動 |
