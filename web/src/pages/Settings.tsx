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
      <h1>設定</h1>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
        <label>
          通知 Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
            placeholder="your@email.com"
            required
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          啟用每日排程
        </label>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button type="submit">儲存設定</button>
          {saved && <span style={{ color: 'green' }}>已儲存 ✓</span>}
        </div>
      </form>
    </div>
  );
}
