# 語意化訊號選擇器 — 設計文件

**日期：** 2026-06-03
**範圍：** 前端 web/src

---

## 目標

將算法編輯器從「自行輸入技術指標數值」改為「選擇語意化訊號預設」，使用者不需要了解技術指標的具體數值，只需點選「收盤突破均線」等直覺選項即可設定條件。

---

## 設計決策

| 項目 | 決定 |
|---|---|
| 介面模式 | 預設訊號為主，底部提供「進階模式」切換回現有 ConditionBuilder |
| 訊號資料 | 定義在 `signals.ts` 設定檔，新增訊號只需加一筆設定 |
| 存儲格式 | 不改 DB schema，仍存 ConditionTree JSON，預設模式只是生成方式更友善 |
| 載入判斷 | 載入時嘗試將 ConditionTree 反向比對已知預設，若符合顯示預設模式，否則進入進階模式 |

---

## 預設訊號清單（7 種）

| 訊號名稱 | 說明 | 參數 | 對應 ConditionTree |
|---|---|---|---|
| 收盤突破均線 | 收盤價 > 指定均線 | MA 週期：5 / 10 / 20 / 60 | `CLOSE > MA{period}` |
| 收盤跌破均線 | 收盤價 < 指定均線 | MA 週期：5 / 10 / 20 / 60 | `CLOSE < MA{period}` |
| RSI 超賣 | RSI(14) < 30 | 無 | `RSI 14 < 30` |
| RSI 超買 | RSI(14) > 70 | 無 | `RSI 14 > 70` |
| KD 黃金交叉 | K 線由下往上穿越 D 線 | 無 | `KD_CROSS golden` |
| KD 死亡交叉 | K 線由上往下穿越 D 線 | 無 | `KD_CROSS dead` |
| MACD 黃金交叉 | MACD 線穿越訊號線向上 | 無 | `MACD_CROSS golden` |

---

## 架構

### 新增檔案

**`web/src/data/signals.ts`**

訊號定義：每個訊號為獨立物件，包含 id、名稱、說明、參數選項、以及 `toCondition(params) → ConditionLeaf` 函式。

```ts
export interface SignalParam {
  key: string;
  label: string;
  options: { value: string | number; label: string }[];
  default: string | number;
}

export interface SignalDef {
  id: string;
  name: string;
  description: string;
  params: SignalParam[];
  toCondition: (params: Record<string, string | number>) => ConditionLeaf;
}

export const SIGNALS: SignalDef[] = [
  {
    id: 'ma-breakout',
    name: '收盤突破均線',
    description: '收盤價向上穿越移動平均線',
    params: [{ key: 'period', label: '均線週期', options: [
      { value: 5, label: 'MA5' }, { value: 10, label: 'MA10' },
      { value: 20, label: 'MA20' }, { value: 60, label: 'MA60' },
    ], default: 20 }],
    toCondition: (p) => ({ indicator: 'CLOSE', op: '>', ref: 'MA', period: Number(p.period) }),
  },
  // ... 其餘 7 種
];
```

**`web/src/components/PresetSignalPicker.tsx`**

Props：
```ts
interface Props {
  value: ConditionTree;
  onChange: (tree: ConditionTree) => void;
}
```

行為：
- 顯示 2 欄格狀訊號清單（所有 8 種）
- 從 `value`（ConditionTree）反向解析出目前選取的訊號（`parsePresets(tree)`）
- 點選訊號切換選取狀態，有參數的訊號顯示下拉選單
- 所有選取的訊號合併成 OR 結構的 ConditionTree（`buildTree(selections)`）並呼叫 `onChange`

反向解析規則（`parsePresets`）：
- 若 tree 是 `{ operator: 'OR', conditions: [...] }` 且每個條件都能比對到 SIGNALS 其中一個 → 成功
- 否則返回 `null`（表示無法用預設模式表示）

### 修改檔案

**`web/src/pages/AlgorithmEditor.tsx`**

- 新增 `mode: 'preset' | 'advanced'` state
- 載入時執行 `parsePresets(conditions)`，成功 → `mode = 'preset'`，失敗 → `mode = 'advanced'`
- `mode === 'preset'` 時渲染 `<PresetSignalPicker>`
- `mode === 'advanced'` 時渲染現有 `<ConditionBuilder>`
- 底部顯示切換按鈕：「⚙ 進階模式」/ 「← 回到訊號選擇」

---

## 資料流

```
使用者點選「收盤突破 MA20」
  → PresetSignalPicker 呼叫 buildTree([{id:'ma-breakout', params:{period:20}}])
  → 產生 ConditionTree: { operator:'OR', conditions:[{ indicator:'CLOSE', op:'>', ref:'MA', period:20 }] }
  → AlgorithmEditor 呼叫 api.saveAlgorithm(id, tree)
  → 存入 D1 DB（格式不變）

載入算法頁
  → api.getAlgorithm(id) 返回 ConditionTree
  → parsePresets(tree) 嘗試比對
  → 成功 → 顯示 PresetSignalPicker（選取狀態還原）
  → 失敗 → 直接進入進階模式（ConditionBuilder）
```

---

## 擴充方式

新增訊號只需在 `signals.ts` 的 `SIGNALS` 陣列加一個物件，UI 自動顯示，不需修改元件程式碼。

---

## 不在範圍內

- 修改 DB schema 或 API
- 自訂 RSI 閾值（超賣固定 30，超買固定 70）
- 多層巢狀預設組合
- 訊號分類/分組顯示

---

## 成功標準

1. 進入算法頁預設顯示訊號選擇格狀介面
2. 選取「收盤突破均線」可選 MA5/10/20/60
3. 儲存後重新載入能正確還原選取狀態
4. 點「進階模式」能切換回原有 ConditionBuilder
5. 進階模式儲存後重載，自動開啟進階模式（無法反向解析）
6. 現有已存的條件（如測試用 CLOSE > 0）自動進入進階模式
