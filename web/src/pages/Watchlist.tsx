import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { WatchlistItem } from '../types';

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist().then(setItems).catch(console.error);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const item = await api.addStock(symbol.trim(), name.trim());
      setItems((prev) => [item, ...prev]);
      setSymbol('');
      setName('');
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
      <h1>追蹤清單</h1>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          placeholder="代號 (如 2330)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          required
        />
        <input
          placeholder="名稱 (如 台積電)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">新增</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['代號', '名稱', '狀態', '操作'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ padding: '0.5rem' }}>{item.symbol}</td>
              <td style={{ padding: '0.5rem' }}>{item.name}</td>
              <td style={{ padding: '0.5rem' }}>{item.enabled ? '追蹤中' : '已暫停'}</td>
              <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}>設定算法</button>
                <button onClick={() => handleToggle(item)}>{item.enabled ? '暫停' : '啟用'}</button>
                <button onClick={() => handleDelete(item.id)} style={{ color: 'red' }}>刪除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
