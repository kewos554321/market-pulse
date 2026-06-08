import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AssetSearch } from './AssetSearch';
import { Pager } from './Pager';
import { usePagination } from '../lib/usePagination';
import { useStableListHeight } from '../lib/useStableListHeight';
import type { AssetType, WatchlistItem } from '../types';

interface Props {
  assetType: AssetType;
  label: string;
  description: string;
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
};

export function AssetWatchlist({ assetType, label, description }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist(assetType).then(setItems).catch(console.error);
  }, [assetType]);

  const { page, setPage, pageItems, totalPages } = usePagination(items, 10);
  const { listRef, listMinHeight, resetHeight } = useStableListHeight(pageItems);

  useEffect(() => {
    setPage(1);
    resetHeight();
  }, [assetType]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addStock(selected.symbol, selected.name, assetType);
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
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>追蹤清單</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{description}</p>
      </div>

      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>新增{label}</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <AssetSearch assetType={assetType} onSelect={(symbol, name) => setSelected({ symbol, name })} />
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
              whiteSpace: 'nowrap',
            }}
          >
            新增
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{error}</p>}
      </div>

      <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: listMinHeight || undefined }}>
        {items.length === 0 && (
          <div style={{ ...card, padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            還沒有追蹤的項目，從上方搜尋新增吧
          </div>
        )}
        {pageItems.map((item) => (
          <div
            key={item.id}
            style={{ ...card, opacity: item.enabled ? 1 : 0.6, transition: 'opacity 0.15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: item.enabled ? '#10b981' : '#d1d5db',
              }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {item.algorithmTemplate ? (
                  <span style={{
                    fontSize: '11px', padding: '2px 10px', borderRadius: '99px', border: '1px solid',
                    background: '#eff6ff', color: '#6366f1', borderColor: '#c7d2fe',
                  }}>
                    模板：{item.algorithmTemplate.name}
                  </span>
                ) : (
                  <span style={{
                    fontSize: '11px', background: '#f8fafc', color: '#64748b',
                    padding: '2px 10px', borderRadius: '99px', border: '1px solid #e2e8f0',
                  }}>
                    自訂算法
                  </span>
                )}
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
          </div>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
