import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Recommendation, WatchlistItem } from '../types';

export function Recommendations() {
  const [date, setDate] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([api.getRecommendations(), api.getWatchlist()])
      .then(([recs, wl]) => {
        setDate(recs.date);
        setItems(recs.items);
        setWatchlist(wl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const watchlistSymbols = new Set(watchlist.map((w) => w.symbol));

  async function handleAdd(item: Recommendation) {
    await api.addStock(item.symbol, item.name);
    setAddedSymbols((prev) => new Set(prev).add(item.symbol));
  }

  if (loading) return <p>載入中...</p>;

  return (
    <div>
      <h1>推薦選股</h1>
      {!date ? (
        <p style={{ color: '#666' }}>尚無推薦資料，請等待排程執行。</p>
      ) : (
        <>
          <p style={{ color: '#666', marginBottom: '1rem' }}>掃描日期：{date}</p>
          {items.length === 0 ? (
            <p>今日無符合策略的標的。</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>代號</th>
                  <th style={{ padding: '0.5rem' }}>名稱</th>
                  <th style={{ padding: '0.5rem' }}>收盤價</th>
                  <th style={{ padding: '0.5rem' }}>符合策略</th>
                  <th style={{ padding: '0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const inWatchlist = watchlistSymbols.has(item.symbol) || addedSymbols.has(item.symbol);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{item.symbol}</td>
                      <td style={{ padding: '0.5rem' }}>{item.name}</td>
                      <td style={{ padding: '0.5rem' }}>{item.close_price.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {item.strategies.map((s) => (
                          <span
                            key={s}
                            style={{
                              display: 'inline-block',
                              background: '#e8f4fd',
                              color: '#0070f3',
                              borderRadius: '4px',
                              padding: '0.1rem 0.4rem',
                              fontSize: '12px',
                              marginRight: '0.25rem',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <button
                          onClick={() => handleAdd(item)}
                          disabled={inWatchlist}
                          style={{ opacity: inWatchlist ? 0.5 : 1 }}
                        >
                          {inWatchlist ? '已在追蹤清單' : '加入追蹤清單'}
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
  );
}
