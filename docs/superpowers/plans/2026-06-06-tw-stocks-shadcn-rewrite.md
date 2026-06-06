# TwStocks 追蹤清單 shadcn/Tailwind 重寫 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/tw-stocks-new` 建立與 `/tw-stocks` 畫面完全相同的追蹤清單頁面，底層改用 shadcn/ui `<Button>` + Tailwind utility class，不影響現有路由與元件。

**Architecture:** 複製 Watchlist.tsx 的所有 state 與 logic 到新的 WatchlistNew.tsx，只替換 JSX 的視覺層（inline style → Tailwind class、button → shadcn Button）。TwStocksNew.tsx 複製路由結構，追蹤清單 tab 指向 WatchlistNew。

**Tech Stack:** React 18, Tailwind v4, shadcn/ui (base-nova style, `@base-ui/react`), React Router v6, TypeScript

---

## File Map

| Action | Path | 說明 |
|--------|------|------|
| Modify | `web/src/index.css` | `--primary` 改為 indigo |
| Modify | `web/src/App.tsx` | 新增 `/tw-stocks-new` route + nav link |
| Create | `web/src/pages/TwStocksNew.tsx` | 新頁面（複製 TwStocks.tsx 結構） |
| Create | `web/src/pages/WatchlistNew.tsx` | 核心重寫（logic 不變，視覺改 Tailwind + shadcn） |

---

## Task 1: 修正 Primary 色

**Files:**
- Modify: `web/src/index.css`

- [ ] **Step 1: 更新 `--primary` 與 `--primary-foreground`**

在 `:root` 區塊找到這兩行並替換：

```css
/* 原本 */
--primary: oklch(0.205 0 0);
--primary-foreground: oklch(0.985 0 0);

/* 改成 */
--primary: oklch(0.585 0.233 277.117);   /* ≈ #6366f1 indigo */
--primary-foreground: oklch(1 0 0);       /* white */
```

- [ ] **Step 2: 驗證 dev server 無報錯**

```bash
cd web && npm run dev
```

瀏覽器開 `http://localhost:5173`，確認現有頁面（`/tw-stocks`）外觀無變化（因為現有頁面全用 inline style，不受 CSS 變數影響）。

- [ ] **Step 3: Commit**

```bash
git add web/src/index.css
git commit -m "fix: update shadcn primary color to indigo"
```

---

## Task 2: 新增路由與頁面 Shell

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/pages/TwStocksNew.tsx`

- [ ] **Step 1: 建立 `TwStocksNew.tsx`**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { WatchlistNew } from './WatchlistNew';
import { AssetSignals } from '../components/AssetSignals';
import { Recommendations } from './Recommendations';

const TABS = [
  { to: '/tw-stocks-new', label: '追蹤清單' },
  { to: '/tw-stocks-new/recommendations', label: '推薦' },
  { to: '/tw-stocks-new/signals', label: '訊號歷史' },
];

export function TwStocksNew() {
  return (
    <div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={<WatchlistNew />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="signals" element={<AssetSignals assetType="tw_stock" />} />
        <Route path="*" element={<Navigate to="/tw-stocks-new" replace />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 2: 在 `App.tsx` 加入 import + route + nav link**

在 import 區塊加：
```tsx
import { TwStocksNew } from './pages/TwStocksNew';
```

在 nav link 陣列（`/tw-stocks` 那行後面）加：
```tsx
{ to: '/tw-stocks-new', label: '台股(新)', exact: false },
```

在 `<Routes>` 裡（`/tw-stocks/*` 那行後面）加：
```tsx
<Route path="/tw-stocks-new/*" element={<TwStocksNew />} />
```

- [ ] **Step 3: 確認路由可以開啟（WatchlistNew 還不存在，先建立空元件）**

建立 `web/src/pages/WatchlistNew.tsx` 暫時內容：
```tsx
export function WatchlistNew() {
  return <div>WatchlistNew placeholder</div>;
}
```

瀏覽器確認 `http://localhost:5173/tw-stocks-new` 可以開啟，nav bar 出現「台股(新)」連結，頁面顯示 placeholder 文字。

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/TwStocksNew.tsx web/src/pages/WatchlistNew.tsx web/src/App.tsx
git commit -m "feat: add /tw-stocks-new route and page shell"
```

---

## Task 3: 實作 WatchlistNew.tsx

**Files:**
- Modify: `web/src/pages/WatchlistNew.tsx`

- [ ] **Step 1: 複製所有 state 與 handlers，加入 shadcn Button import**

將 `WatchlistNew.tsx` 完整替換為以下內容（state 與 handler 100% 複製自 `Watchlist.tsx`，只有 JSX 改用 Tailwind + shadcn）：

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StockSearch } from '../components/StockSearch';
import { GroupPicker } from '../components/GroupPicker';
import { BulkImport } from '../components/BulkImport';
import { AlgorithmTemplatePicker } from '../components/AlgorithmTemplatePicker';
import { Button } from '../components/ui/button';
import type { WatchlistItem, Group, AlgorithmTemplate } from '../types';

export function WatchlistNew() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [batchApplying, setBatchApplying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist().then(setItems).catch(console.error);
    api.getGroups().then(setGroups).catch(console.error);
    api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const filteredItems = activeGroupId
    ? items.filter((item) => item.groups.some((g) => g.id === activeGroupId))
    : items;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addStock(selected.symbol, selected.name, 'tw_stock');
      const newItem = { ...item, groups: [] as Group[] };
      if (activeGroupId && activeGroup) {
        await api.setWatchlistGroups(item.id, [activeGroupId]);
        newItem.groups = [activeGroup];
      }
      setItems((prev) => [newItem, ...prev]);
      setSelected(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    await api.deleteStock(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleToggle(item: WatchlistItem) {
    await api.toggleStock(item.id, item.enabled === 0);
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, enabled: i.enabled === 1 ? 0 : 1 } : i)
    );
  }

  async function handleToggleGroup(item: WatchlistItem, groupId: string) {
    const currentIds = item.groups.map((g) => g.id);
    const newIds = currentIds.includes(groupId)
      ? currentIds.filter((id) => id !== groupId)
      : [...currentIds, groupId];
    await api.setWatchlistGroups(item.id, newIds);
    setItems((prev) => prev.map((i) => {
      if (i.id !== item.id) return i;
      const newGroups = newIds.map((id) => groups.find((g) => g.id === id)!).filter(Boolean);
      return { ...i, groups: newGroups };
    }));
  }

  async function handleCreateAndAssign(itemId: string, name: string) {
    const group = await api.createGroup(name);
    setGroups((prev) => [...prev, group]);
    const item = items.find((i) => i.id === itemId)!;
    const newIds = [...item.groups.map((g) => g.id), group.id];
    await api.setWatchlistGroups(itemId, newIds);
    setItems((prev) => prev.map((i) =>
      i.id === itemId ? { ...i, groups: [...i.groups, group] } : i
    ));
  }

  async function handleDeleteGroup(groupId: string) {
    await api.deleteGroup(groupId);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (activeGroupId === groupId) setActiveGroupId(null);
  }

  async function handleBatchApplyTemplate(templateId: string | null) {
    if (!activeGroupId) return;
    setBatchApplying(true);
    const tmpl = templates.find((t) => t.id === templateId) ?? null;
    await api.batchApplyTemplate(activeGroupId, templateId);
    setItems((prev) => prev.map((item) => {
      if (!filteredItems.some((f) => f.id === item.id)) return item;
      return {
        ...item,
        algorithm_template_id: templateId,
        algorithmTemplate: tmpl ? { id: tmpl.id, name: tmpl.name } : null,
      };
    }));
    setBatchApplying(false);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="m-0 mb-1 text-xl font-bold text-slate-900">追蹤清單</h1>
        <p className="m-0 text-[13px] text-slate-500">管理你想追蹤的股票</p>
      </div>

      {/* Group tabs */}
      <div className="flex items-center border-b border-slate-200 mb-4">
        <div className="flex items-center overflow-x-auto flex-1 min-w-0">
          <button
            onClick={() => { setActiveGroupId(null); setShowBulkImport(false); }}
            className={`px-4 py-2.5 text-[13px] border-0 bg-transparent cursor-pointer whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeGroupId === null
                ? 'text-indigo-500 font-semibold border-indigo-500'
                : 'text-slate-400 font-normal border-transparent'
            }`}
          >
            全部
          </button>
          {groups.map((g) => {
            const isActive = g.id === activeGroupId;
            return (
              <div key={g.id} className="flex items-center relative">
                <button
                  onClick={() => { setActiveGroupId(g.id); setShowBulkImport(false); }}
                  className={`px-4 py-2.5 text-[13px] border-0 bg-transparent cursor-pointer whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    isActive
                      ? 'text-indigo-500 font-semibold border-indigo-500'
                      : 'text-slate-400 font-normal border-transparent'
                  }`}
                >
                  {g.name}
                </button>
              </div>
            );
          })}
          {showNewGroupInput ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newGroupName.trim()) return;
                const group = await api.createGroup(newGroupName.trim());
                setGroups((prev) => [...prev, group]);
                setActiveGroupId(group.id);
                setNewGroupName('');
                setShowNewGroupInput(false);
              }}
              className="flex items-center gap-1 px-2 py-1.5"
            >
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); }
                }}
                placeholder="群組名稱..."
                className="border-[1.5px] border-indigo-500 rounded-md px-2 py-1 text-xs outline-none w-24"
              />
              <Button type="submit" size="xs">建立</Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }}
              >
                取消
              </Button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewGroupInput(true)}
              className="px-3 py-2.5 text-xs border-0 bg-transparent cursor-pointer text-slate-400 whitespace-nowrap border-b-2 border-transparent -mb-px"
            >
              + 新增群組
            </button>
          )}
        </div>

        {/* Batch apply template */}
        {activeGroupId && activeGroup && (
          <div className="relative shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchPickerOpen((o) => !o)}
              disabled={batchApplying}
              className="m-1.5"
            >
              {batchApplying ? '套用中...' : '⚙ 批次套用模板 ▾'}
            </Button>
            {batchPickerOpen && (
              <AlgorithmTemplatePicker
                templates={templates}
                selectedTemplateId={null}
                onSelect={(templateId) => { handleBatchApplyTemplate(templateId); }}
                onClose={() => setBatchPickerOpen(false)}
                onCreateNew={() => navigate('/algorithm-library')}
              />
            )}
          </div>
        )}
      </div>

      {/* Bulk import + delete group */}
      {activeGroupId && activeGroup && (
        <div className="mb-2">
          {showBulkImport ? (
            <BulkImport
              activeGroup={activeGroup}
              existingItems={items}
              onComplete={setItems}
              onClose={() => setShowBulkImport(false)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowBulkImport(true)}>
                ↑ 批量匯入到「{activeGroup.name}」
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteGroup(activeGroupId)}>
                刪除群組
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add stock */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
        <div className="text-xs font-semibold text-slate-700 mb-2">新增股票</div>
        <form onSubmit={handleAdd} className="flex gap-2 items-start">
          <StockSearch onSelect={(symbol, name) => setSelected({ symbol, name })} />
          {selected && (
            <span className="self-center text-xs text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full whitespace-nowrap">
              {selected.symbol} {selected.name}
            </span>
          )}
          <Button type="submit" disabled={!selected}>新增</Button>
        </form>
        {error && <p className="text-red-500 text-[13px] mt-2 mb-0">{error}</p>}
      </div>

      {/* Stock list */}
      <div className="flex flex-col gap-2.5">
        {filteredItems.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 text-sm border border-slate-200">
            {activeGroupId
              ? `「${activeGroup?.name}」群組還沒有股票，點上方批量匯入或新增股票後指定群組`
              : '還沒有追蹤的股票，從上方搜尋新增吧'}
          </div>
        )}
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-xl p-4 shadow-sm border border-slate-200 transition-opacity ${
              item.enabled ? 'opacity-100' : 'opacity-60'
            }`}
          >
            <div className="flex items-center gap-4 mb-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                item.enabled ? 'bg-emerald-500' : 'bg-slate-300'
              }`} />
              <div className="flex-1 flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{item.symbol}</span>
                <span className="text-slate-600 text-sm">{item.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  item.enabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.enabled ? '追蹤中' : '已暫停'}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                {item.algorithmTemplate ? (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                    模板：{item.algorithmTemplate.name}
                  </span>
                ) : (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                    自訂算法
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                >
                  設定算法
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleToggle(item)}>
                  {item.enabled ? '暫停' : '啟用'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                  刪除
                </Button>
              </div>
            </div>

            {/* Group tags */}
            <div className="flex items-center gap-1.5 flex-wrap relative">
              {item.groups.map((g) => (
                <span
                  key={g.id}
                  onClick={() => handleToggleGroup(item, g.id)}
                  className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium cursor-pointer"
                >
                  {g.name} ×
                </span>
              ))}
              <div className="relative">
                <button
                  onClick={() => setPickerOpenFor(pickerOpenFor === item.id ? null : item.id)}
                  className="text-[11px] text-slate-400 bg-transparent border border-dashed border-slate-300 rounded-full px-2 py-0.5 cursor-pointer"
                >
                  + 群組
                </button>
                {pickerOpenFor === item.id && (
                  <GroupPicker
                    groups={groups}
                    selectedGroupIds={item.groups.map((g) => g.id)}
                    onToggle={(gid) => handleToggleGroup(item, gid)}
                    onCreate={(name) => handleCreateAndAssign(item.id, name)}
                    onClose={() => setPickerOpenFor(null)}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 型別檢查**

```bash
cd web && npx tsc --noEmit
```

Expected: 0 errors。如果有錯誤，根據 error message 修正（通常是 import path 問題）。

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/WatchlistNew.tsx
git commit -m "feat: implement WatchlistNew with Tailwind + shadcn Button"
```

---

## Task 4: 視覺驗證

**Files:** 無（只做比對）

- [ ] **Step 1: 並排比對**

瀏覽器同時開啟：
- `http://localhost:5173/tw-stocks` （原版）
- `http://localhost:5173/tw-stocks-new` （新版）

逐一確認以下項目：

| 項目 | 確認點 |
|------|--------|
| Header | 標題「追蹤清單」與副標題字型、顏色一致 |
| Group tabs | 全部、各群組 tab 的 active（紫色底線）與 inactive（灰色）狀態一致 |
| 新增股票 card | 白底、圓角、陰影、input + 按鈕排列一致 |
| 新增按鈕 | 有選股時紫色、未選時 disabled（顏色稍不同但可接受） |
| 股票卡片 | 綠/灰指示燈、symbol、name、badge 位置一致 |
| 追蹤中/已暫停 badge | 綠色/灰色背景一致 |
| 算法模板 badge | 紫色邊框 badge 一致 |
| 設定算法/暫停/刪除按鈕 | 按鈕大小、位置、顏色大致一致 |
| 群組 tag | 紫色圓角 tag、× 可點擊 |
| + 群組按鈕 | 虛線邊框圓角 |
| 空狀態 | 白底卡片、灰字 |

- [ ] **Step 2: 功能測試**

在 `/tw-stocks-new` 測試：
1. 搜尋並新增一支股票
2. 新增一個群組
3. 把股票指定到群組
4. 切換群組 tab 確認 filter 正常
5. 點「暫停」確認 opacity 變化
6. 點「刪除」確認股票消失

- [ ] **Step 3: 確認原版 `/tw-stocks` 完全未受影響**

切回 `http://localhost:5173/tw-stocks`，確認所有功能正常，外觀無變化。

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: tw-stocks-new page complete with shadcn/Tailwind rewrite"
```

---

## 注意事項

- **`Button` 的 `disabled` 狀態**：shadcn Button disabled 用 `opacity-50`，原版用灰底灰字。視覺略有不同，是可接受的差異（功能一致）。
- **`-mb-px` tab active 線**：這是讓 tab 的 2px 底線蓋過 container 的 1px 底線的標準 trick，不要移除。
- **不要修改任何現有檔案以外的部分**：`Watchlist.tsx`、`TwStocks.tsx`、其他 page 都不能動。
