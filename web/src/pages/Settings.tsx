import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function Settings() {
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEmail(s.notify_email ?? '');
      setEnabled(s.schedule_enabled !== '0');
    }).catch(console.error);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await api.saveSettings({
      notify_email: email,
      schedule_enabled: enabled ? '1' : '0',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>設定</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>通知和排程設定</p>
      </div>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
        maxWidth: '480px',
      }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              通知 Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '8px',
                padding: '9px 12px', fontSize: '13px', color: '#1e293b',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>啟用每日排程</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>每週一到五 14:35 台北時間自動執行</div>
              </div>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="submit"
              style={{
                background: '#6366f1', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 24px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              儲存設定
            </button>
            {saved && (
              <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
