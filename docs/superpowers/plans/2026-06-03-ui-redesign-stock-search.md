# UI 優化 + 股票搜尋自動提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Market Pulse 前端從純 inline style 升級為簡潔現代卡片設計，並在追蹤清單新增股票時提供即時搜尋提示。

**Architecture:** 新增 `StockSearch` 元件封裝搜尋下拉邏輯，使用靜態 `stocks.json`（1,090 筆上市股票）進行本地過濾。UI 風格統一為 Indigo 主色、圓角卡片、白底，所有頁面 inline style 保持現有模式（不引入 UI 函式庫）。

**Tech Stack:** React 18, TypeScript, Vite, react-router-dom v6

---

### Task 1: 建立 stocks.json（已完成）

**Files:**
- Done: `web/src/data/stocks.json`

- [x] **Step 1: 確認檔案存在且格式正確**

```bash
head -c 200 web/src/data/stocks.json
```

Expected output（前兩筆）：
```json
[{"symbol":"1101","name":"台泥"},{"symbol":"1102","name":"亞泥"},...]
```

---

### Task 2: StockSearch 元件

**Files:**
- Create: `web/src/components/StockSearch.tsx`

- [ ] **Step 1: 建立元件檔案**

建立 `web/src/components/StockSearch.tsx`，內容如下：

```tsx
import { useState, useRef, useEffect } from 'react';
import stocksData from '../data/stocks.json';

interface Stock {
  symbol: string;
  name: string;
}

interface Props {
  onSelect: (symbol: string, name: string) => void;
}

const stocks: Stock[] = stocksData as Stock[];

function filterStocks(query: string): Stock[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return stocks
    .filter((s) => s.symbol.startsWith(q) || s.name.includes(q))
    .slice(0, 8);
}

export function StockSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stock[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResults(filterStocks(query));
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(stock: Stock) {
    onSelect(stock.symbol, stock.name);
    setQuery('');
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setResults([]);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#f8fafc', border: '1.5px solid #6366f1',
        borderRadius: '8px', padding: '9px 12px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="輸入代號或名稱（如 2330 或 台積）"
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: '13px', color: '#1e293b', width: '100%',
          }}
        />
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden',
        }}>
          <div style={{
            padding: '6px 12px', fontSize: '10px', color: '#94a3b8',
            background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
            letterSpacing: '0.05em', fontWeight: 600,
          }}>
            搜尋結果
          </div>
          {results.map((stock, i) => (
            <div
              key={stock.symbol}
              onMouseDown={() => handleSelect(stock)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '10px 12px', display: 'flex', alignItems: 'center',
                gap: '12px', cursor: 'pointer',
                background: i === activeIndex ? '#eff6ff' : '#fff',
                borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '13px', minWidth: '36px' }}>
                {stock.symbol}
              </span>
              <span style={{ color: '#1e293b', fontSize: '13px' }}>{stock.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 確認 TypeScript 編譯無錯誤**

```bash
cd web && npx tsc --noEmit
```

Expected: 無輸出（無錯誤）

- [ ] **Step 3: Commit**

```bash
git add web/src/data/stocks.json web/src/components/StockSearch.tsx
git commit -m "feat: add StockSearch component with local stocks.json"
```

---

### Task 3: 更新 App.tsx（導覽列）

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: 替換 App.tsx**

```tsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { Watchlist } from './pages/Watchlist';
import { AlgorithmEditor } from './pages/AlgorithmEditor';
import { Signals } from './pages/Signals';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <nav style={{
          display: 'flex', alignItems: 'center', background: '#fff',
          borderBottom: '1px solid #e2e8f0', padding: '0 24px',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontWeight: 800, color: '#6366f1', fontSize: '15px', marginRight: '32px', padding: '14px 0' }}>
            Market Pulse
          </span>
          {[
            { to: '/', label: '首頁', exact: true },
            { to: '/watchlist', label: '追蹤清單', exact: false },
            { to: '/signals', label: '訊號歷史', exact: false },
            { to: '/settings', label: '設定', exact: false },
          ].map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                padding: '14px 16px',
                fontSize: '13px',
                textDecoration: 'none',
                color: isActive ? '#6366f1' : '#94a3b8',
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'color 0.15s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/watchlist/:id/algorithm" element={<AlgorithmEditor />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: 啟動開發伺服器確認導覽列外觀**

```bash
cd web && npm run dev
```

打開 http://localhost:5173，確認：
- 左側有「Market Pulse」紫色 logo
- 目前頁面的導覽連結有底線 + 紫色字
- 其他頁面連結是灰色

- [ ] **Step 3: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: redesign top nav with logo and active indicator"
```

---

### Task 4: 更新 Watchlist.tsx（主要頁面）

**Files:**
- Modify: `web/src/pages/Watchlist.tsx`

- [ ] **Step 1: 替換 Watchlist.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StockSearch } from '../components/StockSearch';
import type { WatchlistItem } from '../types';

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist().then(setItems).catch(console.error);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addStock(selected.symbol, selected.name);
      setItems((prev) => [item, ...prev]);
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

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>追蹤清單</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>管理你想追蹤的股票</p>
      </div>

      {/* Add stock card */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>新增股票</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <StockSearch onSelect={(symbol, name) => setSelected({ symbol, name })} />
          {selected && (
            <span style={{
              alignSelf: 'center', fontSize: '12px', color: '#6366f1',
              background: '#eff6ff', padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
            }}>
              {selected.symbol} {selected.name}
            </span>
          )}
          <button
            type="submit"
            disabled={!selected}
            style={{
              background: selected ? '#6366f1' : '#e2e8f0',
              color: selected ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              fontSize: '13px', fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}
          >
            新增
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{error}</p>}
      </div>

      {/* Stock list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px',
            border: '1px solid #e2e8f0',
          }}>
            還沒有追蹤的股票，從上方搜尋新增吧
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff', borderRadius: '12px', padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: '16px',
              opacity: item.enabled ? 1 : 0.6, transition: 'opacity 0.15s',
            }}
          >
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: item.enabled ? '#10b981' : '#d1d5db',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{item.symbol}</span>
                <span style={{ color: '#475569', fontSize: '14px' }}>{item.name}</span>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: 500,
                  background: item.enabled ? '#dcfce7' : '#f1f5f9',
                  color: item.enabled ? '#166534' : '#64748b',
                }}>
                  {item.enabled ? '追蹤中' : '已暫停'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                設定算法
              </button>
              <button
                onClick={() => handleToggle(item)}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                {item.enabled ? '暫停' : '啟用'}
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                style={{ background: '#fff0f0', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 確認追蹤清單頁面功能**

在 http://localhost:5173/watchlist 測試：
- 輸入「23」→ 出現下拉提示
- 選取股票 → 顯示 badge 在搜尋框旁
- 按「新增」→ 股票出現在清單
- 「暫停」→ 變灰色 + 已暫停 badge
- 「刪除」→ 從清單移除
- 「設定算法」→ 進入算法頁面

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Watchlist.tsx
git commit -m "feat: redesign Watchlist with StockSearch and card list"
```

---

### Task 5: 更新 Home.tsx

**Files:**
- Modify: `web/src/pages/Home.tsx`

- [ ] **Step 1: 看目前 Home.tsx 的內容**

```bash
cat web/src/pages/Home.tsx
```

- [ ] **Step 2: 替換 Home.tsx**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Signal } from '../types';

export function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(10).then(setSignals).catch(console.error);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>首頁</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>最新觸發訊號概覽</p>
      </div>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>近期訊號</div>
        {signals.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', padding: '24px 0' }}>
            目前沒有觸發訊號。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {signals.map((s) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', background: '#f8fafc', borderRadius: '8px',
              }}>
                <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '14px', minWidth: '44px' }}>{s.symbol}</span>
                <span style={{ color: '#475569', fontSize: '13px' }}>收盤 {s.close_price}</span>
                <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '12px' }}>
                  {s.triggered_at.split('T')[0]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home.tsx
git commit -m "feat: apply card style to Home page"
```

---

### Task 6: 更新 Signals.tsx

**Files:**
- Modify: `web/src/pages/Signals.tsx`

- [ ] **Step 1: 看目前 Signals.tsx 的內容**

```bash
cat web/src/pages/Signals.tsx
```

- [ ] **Step 2: 替換 Signals.tsx**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Signal } from '../types';

export function Signals() {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(100).then(setSignals).catch(console.error);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>訊號歷史</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>系統觸發過的買賣訊號紀錄</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {signals.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px',
            border: '1px solid #e2e8f0',
          }}>
            目前沒有觸發訊號
          </div>
        ) : signals.map((s) => (
          <div key={s.id} style={{
            background: '#fff', borderRadius: '12px', padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{s.symbol}</span>
                <span style={{
                  fontSize: '11px', background: '#dcfce7', color: '#166534',
                  padding: '2px 8px', borderRadius: '99px', fontWeight: 500,
                }}>觸發</span>
                {s.notified ? (
                  <span style={{ fontSize: '11px', color: '#10b981' }}>✓ 已通知</span>
                ) : null}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                收盤價 {s.close_price} ・ {new Date(s.triggered_at).toLocaleString('zh-TW')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Signals.tsx
git commit -m "feat: apply card style to Signals page"
```

---

### Task 7: 更新 Settings.tsx

**Files:**
- Modify: `web/src/pages/Settings.tsx`

- [ ] **Step 1: 看目前 Settings.tsx 的內容**

```bash
cat web/src/pages/Settings.tsx
```

- [ ] **Step 2: 替換 Settings.tsx**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function Settings() {
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEmail(s.notify_email ?? '');
      setEnabled(s.schedule_enabled !== '0');
    }).catch(console.error);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await api.saveSettings({
      notify_email: email,
      schedule_enabled: enabled ? '1' : '0',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>設定</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>通知和排程設定</p>
      </div>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
        maxWidth: '480px',
      }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              通知 Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '8px',
                padding: '9px 12px', fontSize: '13px', color: '#1e293b',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>啟用每日排程</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>每週一到五 14:35 台北時間自動執行</div>
              </div>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="submit"
              style={{
                background: '#6366f1', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 24px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              儲存設定
            </button>
            {saved && (
              <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Settings.tsx
git commit -m "feat: apply card style to Settings page"
```

---

### Task 8: Build + 部署

**Files:**
- No file changes

- [ ] **Step 1: 確認 TypeScript 編譯無錯誤**

```bash
cd web && npx tsc --noEmit
```

Expected: 無輸出

- [ ] **Step 2: Build**

```bash
cd web && npm run build
```

Expected: `dist/` 目錄產生，無錯誤

- [ ] **Step 3: 部署到 Cloudflare Pages**

```bash
cd web && npx wrangler pages deploy dist --project-name market-pulse-web --commit-dirty=true
```

Expected: 輸出包含 `Deployment complete! ... market-pulse-web.pages.dev`

- [ ] **Step 4: 在正式環境測試**

打開 https://market-pulse-web.pages.dev，確認：
- 導覽列有 logo 和 active 底線
- 追蹤清單搜尋框可輸入並顯示下拉
- 所有頁面卡片風格一致

- [ ] **Step 5: Final commit + push**

```bash
git push
```
