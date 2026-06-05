import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Recommendation, RecommendationStock, WatchlistItem } from '../types';

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
};

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #e2e8f0', borderRadius: '8px',
  padding: '9px 12px', fontSize: '13px', color: '#1e293b',
  outline: 'none', boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none',
  borderRadius: '8px', padding: '9px 16px',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};

export function Recommendations() {
  const [date, setDate] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  const [stocks, setStocks] = useState<RecommendationStock[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [stockError, setStockError] = useState('');
  const [poolOpen, setPoolOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.getRecommendations(), api.getWatchlist()])
      .then(([recs, wl]) => {
        setDate(recs.date);
        setItems(recs.items);
        setWatchlist(wl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    api.getRecommendationStocks()
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, []);

  const watchlistSymbols = new Set(watchlist.map((w) => w.symbol));

  async function handleAdd(item: Recommendation) {
    await api.addStock(item.symbol, item.name);
    setAddedSymbols((prev) => new Set(prev).add(item.symbol));
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    setStockError('');
    try {
      const stock = await api.addRecommendationStock(newSymbol.trim(), newName.trim());
      setStocks((prev) => [...prev, stock]);
      setNewSymbol('');
      setNewName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStockError(msg.includes('full') ? '股票池已達上限 120 支' : '新增失敗，請確認代號是否重複');
    }
  }

  async function handleDeleteStock(symbol: string) {
    await api.deleteRecommendationStock(symbol);
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>推薦選股</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>每日排程掃描結果</p>
      </div>

      <div style={cardStyle}>
        {loading ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>載入中...</p>
        ) : !date ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>尚無推薦資料，請等待排程執行。</p>
        ) : (
          <>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>掃描日期：{date}</p>
            {items.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>今日無符合策略的標的。</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                    {['代號', '名稱', '收盤價', '符合策略', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const inWatchlist = watchlistSymbols.has(item.symbol) || addedSymbols.has(item.symbol);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{item.symbol}</td>
                        <td style={{ padding: '8px 10px', fontSize: '13px', color: '#374151' }}>{item.name}</td>
                        <td style={{ padding: '8px 10px', fontSize: '13px', color: '#374151' }}>{item.close_price.toFixed(2)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {item.strategies.map((s) => (
                            <span key={s} style={{
                              display: 'inline-block', background: '#ede9fe', color: '#6366f1',
                              borderRadius: '999px', padding: '2px 8px', fontSize: '11px',
                              fontWeight: 500, marginRight: '4px',
                            }}>
                              {s}
                            </span>
                          ))}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <button
                            onClick={() => handleAdd(item)}
                            disabled={inWatchlist}
                            style={{
                              background: inWatchlist ? 'none' : '#6366f1', color: inWatchlist ? '#94a3b8' : '#fff',
                              border: inWatchlist ? '1px solid #e2e8f0' : 'none',
                              borderRadius: '6px', padding: '4px 10px', fontSize: '12px',
                              fontWeight: 500, cursor: inWatchlist ? 'default' : 'pointer',
                            }}
                          >
                            {inWatchlist ? '已追蹤' : '加入追蹤'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Stock pool management */}
      <div style={{ marginTop: '32px' }}>
        <button
          onClick={() => setPoolOpen((v) => !v)}
          style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px',
            padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#64748b',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span>管理股票池</span>
          {!stocksLoading && (
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>
              {stocks.length} / 120 支
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{poolOpen ? '▲' : '▼'}</span>
        </button>

        {poolOpen && (
          <div style={{ ...cardStyle, marginTop: '12px', maxWidth: '560px' }}>
            {stocksLoading ? (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>載入中...</p>
            ) : (
              <>
                <form onSubmit={handleAddStock} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="代號（如 2330）"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    style={{ ...inputStyle, width: '130px' }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="名稱（如 台積電）"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{ ...inputStyle, width: '130px' }}
                    required
                  />
                  <button type="submit" style={btnStyle}>新增</button>
                  {stockError && (
                    <span style={{ fontSize: '12px', color: '#ef4444', alignSelf: 'center' }}>{stockError}</span>
                  )}
                </form>

                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                        {['代號', '名稱', '類型', ''].map((h) => (
                          <th key={h} style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map((s) => (
                        <tr key={s.symbol} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{s.symbol}</td>
                          <td style={{ padding: '8px 10px', fontSize: '13px', color: '#374151' }}>{s.name}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                              background: s.is_default ? '#ede9fe' : '#f0fdf4',
                              color: s.is_default ? '#6366f1' : '#16a34a',
                              fontWeight: 500,
                            }}>
                              {s.is_default ? '預設' : '自訂'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button
                              onClick={() => handleDeleteStock(s.symbol)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', padding: '2px 8px' }}
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
