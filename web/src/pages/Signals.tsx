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
      <h1>訊號歷史</h1>
      {signals.length === 0 ? (
        <p style={{ color: '#888' }}>尚無訊號記錄。</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['標的代號', '收盤價', '觸發時間', '已通知'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id}>
                <td style={{ padding: '0.5rem' }}>{s.symbol}</td>
                <td style={{ padding: '0.5rem' }}>{s.close_price}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(s.triggered_at).toLocaleString('zh-TW')}</td>
                <td style={{ padding: '0.5rem' }}>{s.notified ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
