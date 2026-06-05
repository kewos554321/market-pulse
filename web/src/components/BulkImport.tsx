import { useState } from 'react';
import stocksData from '../data/stocks.json';
import { api } from '../api/client';
import type { Group, WatchlistItem } from '../types';

interface StockEntry {
  symbol: string;
  name: string;
  status: 'new' | 'exists' | 'unknown';
  watchlistId?: string;
}

interface Props {
  activeGroup: Group;
  existingItems: WatchlistItem[];
  onComplete: (updated: WatchlistItem[]) => void;
  onClose: () => void;
}

const stocks = stocksData as { symbol: string; name: string }[];

function parseSymbols(input: string): string[] {
  return [...new Set(
    input.split(/[\s,，、;\n]+/).map((s) => s.trim()).filter(Boolean)
  )];
}

export function BulkImport({ activeGroup, existingItems, onComplete, onClose }: Props) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<StockEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  function handleParse() {
    const codes = parseSymbols(input);
    const entries: StockEntry[] = codes.map((symbol) => {
      const stock = stocks.find((s) => s.symbol === symbol);
      if (!stock) return { symbol, name: '—', status: 'unknown' as const };
      const existing = existingItems.find((i) => i.symbol === symbol);
      return {
        symbol,
        name: stock.name,
        status: existing ? ('exists' as const) : ('new' as const),
        watchlistId: existing?.id,
      };
    });
    setPreview(entries);
  }

  async function handleConfirm() {
    if (!preview) return;
    setLoading(true);
    const valid = preview.filter((e) => e.status !== 'unknown');
    const updated = [...existingItems];

    for (const entry of valid) {
      let watchlistId = entry.watchlistId;
      if (entry.status === 'new') {
        const item = await api.addStock(entry.symbol, entry.name);
        watchlistId = item.id;
        updated.unshift({ ...item, groups: [] });
      }
      if (watchlistId) {
        const item = updated.find((i) => i.id === watchlistId)!;
        const currentGroupIds = item.groups.map((g) => g.id);
        if (!currentGroupIds.includes(activeGroup.id)) {
          await api.setWatchlistGroups(watchlistId, [...currentGroupIds, activeGroup.id]);
          item.groups = [...item.groups, { id: activeGroup.id, name: activeGroup.name, algorithmTemplate: null }];
        }
      }
    }
    setLoading(false);
    onComplete(updated);
    onClose();
  }

  const newCount = preview?.filter((e) => e.status === 'new').length ?? 0;
  const unknownCount = preview?.filter((e) => e.status === 'unknown').length ?? 0;

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '16px',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
        批量新增到「{activeGroup.name}」
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
        貼入股票代號，空白、逗號、換行皆可
      </div>

      {!preview ? (
        <>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如：2330 2317 2382 或貼上 Excel 欄位..."
            style={{
              width: '100%', height: '72px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
              padding: '10px 12px', fontSize: '13px', color: '#374151', resize: 'none',
              outline: 'none', boxSizing: 'border-box', marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleParse}
              disabled={!input.trim()}
              style={{
                background: input.trim() ? '#6366f1' : '#e2e8f0',
                color: input.trim() ? '#fff' : '#94a3b8',
                border: 'none', borderRadius: '8px', padding: '8px 16px',
                fontSize: '12px', fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              解析
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
              取消
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{
            background: '#f8fafc', borderRadius: '8px', padding: '12px',
            marginBottom: '10px', border: '1px solid #e2e8f0', maxHeight: '200px', overflowY: 'auto',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              解析結果（{preview.length} 支）
            </div>
            {preview.map((e) => (
              <div key={e.symbol} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1', minWidth: '36px' }}>{e.symbol}</span>
                <span style={{ fontSize: '12px', color: '#374151' }}>{e.name}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', padding: '1px 6px', borderRadius: '99px',
                  background: e.status === 'new' ? '#eff6ff' : e.status === 'exists' ? '#dcfce7' : '#fff1f2',
                  color: e.status === 'new' ? '#6366f1' : e.status === 'exists' ? '#166534' : '#ef4444',
                }}>
                  {e.status === 'new' ? '新增' : e.status === 'exists' ? '已在清單' : '找不到代號'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleConfirm}
              disabled={loading || preview.filter((e) => e.status !== 'unknown').length === 0}
              style={{
                background: '#6366f1', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '匯入中...' : `確認匯入${newCount > 0 ? `（${newCount} 支新增）` : ''}`}
            </button>
            <button
              onClick={() => setPreview(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
            >
              重新輸入
            </button>
            {unknownCount > 0 && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{unknownCount} 支找不到代號將略過</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
