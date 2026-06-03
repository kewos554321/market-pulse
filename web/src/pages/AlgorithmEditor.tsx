import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { parsePresets } from '../data/signals';
import type { ConditionTree, WatchlistItem } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stock, setStock] = useState<WatchlistItem | null>(null);
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getWatchlist().then((list) => setStock(list.find((s) => s.id === id) ?? null));
    api.getAlgorithm(id)
      .then((algo) => {
        setConditions(algo.conditions);
        setMode(parsePresets(algo.conditions) !== null ? 'preset' : 'advanced');
      })
      .catch(() => {
        setConditions(emptyTree);
        setMode('preset');
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    await api.saveAlgorithm(id, conditions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <button
        onClick={() => navigate('/watchlist')}
        style={{
          background: 'none', border: 'none', color: '#6366f1', fontSize: '13px',
          cursor: 'pointer', padding: '0', marginBottom: '16px', fontWeight: 500,
        }}
      >
        ← 返回清單
      </button>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
          算法設定
        </h1>
        {stock && (
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            {stock.symbol} {stock.name}
          </p>
        )}
      </div>

      <div style={{
        background: '#fff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
        marginBottom: '16px',
      }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            載入中...
          </div>
        ) : mode === 'preset' ? (
          <PresetSignalPicker value={conditions} onChange={setConditions} />
        ) : (
          <ConditionBuilder conditions={conditions} onChange={setConditions} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          style={{
            background: '#6366f1', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '10px 24px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          儲存算法
        </button>
        {saved && (
          <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>
        )}
        <button
          onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
          style={{
            background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px',
            cursor: 'pointer', padding: '0', marginLeft: 'auto',
          }}
        >
          {mode === 'preset' ? '⚙ 進階模式（自訂條件數值）' : '← 回到訊號選擇'}
        </button>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '12px', userSelect: 'none' }}>
          查看 JSON
        </summary>
        <pre style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
          padding: '16px', fontSize: '12px', overflow: 'auto', marginTop: '8px', color: '#374151',
        }}>
          {JSON.stringify(conditions, null, 2)}
        </pre>
      </details>
    </div>
  );
}
