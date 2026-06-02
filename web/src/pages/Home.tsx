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
      <h1>Market Pulse</h1>
      <h2>近期訊號</h2>
      {signals.length === 0 ? (
        <p style={{ color: '#888' }}>目前沒有觸發訊號。</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['標的代號', '收盤價', '觸發時間'].map((h) => (
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
                <td style={{ padding: '0.5rem' }}>{s.triggered_at.split('T')[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
