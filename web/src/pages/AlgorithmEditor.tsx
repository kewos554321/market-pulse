import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ConditionBuilder } from '../components/ConditionBuilder';
import type { ConditionTree, WatchlistItem } from '../types';

const emptyTree: ConditionTree = { operator: 'AND', conditions: [] };

export function AlgorithmEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stock, setStock] = useState<WatchlistItem | null>(null);
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getWatchlist().then((list) => setStock(list.find((s) => s.id === id) ?? null));
    api.getAlgorithm(id).then((algo) => setConditions(algo.conditions)).catch(() => setConditions(emptyTree));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    await api.saveAlgorithm(id, conditions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <button onClick={() => navigate('/watchlist')} style={{ marginBottom: '1rem' }}>← 返回清單</button>
      <h1>算法設定{stock && ` — ${stock.symbol} ${stock.name}`}</h1>
      <ConditionBuilder conditions={conditions} onChange={setConditions} />
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={handleSave}>儲存算法</button>
        {saved && <span style={{ color: 'green' }}>已儲存 ✓</span>}
      </div>
      <details style={{ marginTop: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', color: '#666' }}>查看 JSON</summary>
        <pre style={{ background: '#f5f5f5', padding: '1rem', fontSize: '12px', overflow: 'auto' }}>
          {JSON.stringify(conditions, null, 2)}
        </pre>
      </details>
    </div>
  );
}
