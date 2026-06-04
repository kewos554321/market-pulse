import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Signal } from '../types';

type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

interface Props {
  assetType: AssetType;
}

export function AssetSignals({ assetType }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(100, assetType).then(setSignals).catch(console.error);
  }, [assetType]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>訊號歷史</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>系統觸發過的買賣訊號紀錄</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {signals.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px',
            border: '1px solid #e2e8f0',
          }}>
            目前沒有觸發訊號
          </div>
        ) : signals.map((s) => (
          <div key={s.id} style={{
            background: '#fff', borderRadius: '12px', padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{s.symbol}</span>
                <span style={{
                  fontSize: '11px', background: '#dcfce7', color: '#166534',
                  padding: '2px 8px', borderRadius: '99px', fontWeight: 500,
                }}>觸發</span>
                {s.notified ? <span style={{ fontSize: '11px', color: '#10b981' }}>✓ 已通知</span> : null}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                收盤價 {s.close_price} ・ {new Date(s.triggered_at).toLocaleString('zh-TW')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
