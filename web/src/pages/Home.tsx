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
