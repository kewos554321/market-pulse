import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { EmailRecipient } from '../api/client';
import type { RecommendationStock } from '../types';

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
  maxWidth: '480px',
};

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #e2e8f0', borderRadius: '8px',
  padding: '9px 12px', fontSize: '13px', color: '#1e293b',
  outline: 'none', boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none',
  borderRadius: '8px', padding: '9px 16px',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
};

export function Settings() {
  const [enabled, setEnabled] = useState(true);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [emailError, setEmailError] = useState('');

  const [stocks, setStocks] = useState<RecommendationStock[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [stockError, setStockError] = useState('');
  const [stocksLoading, setStocksLoading] = useState(true);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEnabled(s.schedule_enabled !== '0');
    }).catch(console.error);

    api.getEmailRecipients()
      .then(setRecipients)
      .catch(console.error)
      .finally(() => setRecipientsLoading(false));

    api.getRecommendationStocks()
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, []);

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    await api.saveSettings({ schedule_enabled: enabled ? '1' : '0' });
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 2000);
  }

  async function handleAddRecipient(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    try {
      const recipient = await api.addEmailRecipient(newEmail.trim(), newLabel.trim() || undefined);
      setRecipients((prev) => [...prev, recipient]);
      setNewEmail('');
      setNewLabel('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('409')) setEmailError('此 email 已存在');
      else if (msg.includes('invalid')) setEmailError('Email 格式不正確');
      else setEmailError('新增失敗');
    }
  }

  async function handleDeleteRecipient(id: string) {
    if (!confirm('確定要移除此收件人？')) return;
    await api.deleteEmailRecipient(id);
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    setStockError('');
    try {
      const stock = await api.addRecommendationStock(newSymbol.trim(), newName.trim());
      setStocks((prev) => [...prev, stock]);
      setNewSymbol('');
      setNewName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStockError(msg.includes('full') ? '股票池已達上限 120 支' : '新增失敗，請確認代號是否重複');
    }
  }

  async function handleDeleteStock(symbol: string) {
    await api.deleteRecommendationStock(symbol);
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>設定</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>通知和排程設定</p>
      </div>

      {/* Schedule settings */}
      <div style={cardStyle}>
        <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            <button type="submit" style={btnStyle}>儲存設定</button>
            {scheduleSaved && (
              <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>
            )}
          </div>
        </form>
      </div>

      {/* Email recipients */}
      <div style={{ marginTop: '32px', marginBottom: '12px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Email 收件人</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>每日訊號通知的收件人清單</p>
      </div>

      <div style={{ ...cardStyle, maxWidth: '560px' }}>
        <form onSubmit={handleAddRecipient} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ ...inputStyle, width: '200px' }}
            required
          />
          <input
            type="text"
            placeholder="備註（選填）"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ ...inputStyle, width: '120px' }}
          />
          <button type="submit" style={btnStyle}>新增</button>
          {emailError && (
            <span style={{ fontSize: '12px', color: '#ef4444', alignSelf: 'center' }}>{emailError}</span>
          )}
        </form>

        {recipientsLoading ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>載入中...</p>
        ) : recipients.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>尚無收件人</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                {['Email', '備註', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontSize: '13px', color: '#0f172a' }}>{r.email}</td>
                  <td style={{ padding: '8px 10px', fontSize: '13px', color: '#64748b' }}>{r.label ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <button
                      onClick={() => handleDeleteRecipient(r.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', padding: '2px 8px' }}
                    >
                      移除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recommendation stock pool */}
      <div style={{ marginTop: '32px', marginBottom: '12px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>推薦股票池</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>每日推薦掃描的範圍，上限 120 支</p>
      </div>

      <div style={{ ...cardStyle, maxWidth: '560px' }}>
        {stocksLoading ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>載入中...</p>
        ) : (
          <>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              目前 <strong style={{ color: '#0f172a' }}>{stocks.length}</strong> / 120 支
            </p>

            <form onSubmit={handleAddStock} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="代號（如 2330）"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                style={{ ...inputStyle, width: '130px' }}
                required
              />
              <input
                type="text"
                placeholder="名稱（如 台積電）"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ ...inputStyle, width: '130px' }}
                required
              />
              <button type="submit" style={btnStyle}>新增</button>
              {stockError && (
                <span style={{ fontSize: '12px', color: '#ef4444', alignSelf: 'center' }}>{stockError}</span>
              )}
            </form>

            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                    {['代號', '名稱', '類型', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => (
                    <tr key={s.symbol} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{s.symbol}</td>
                      <td style={{ padding: '8px 10px', fontSize: '13px', color: '#374151' }}>{s.name}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                          background: s.is_default ? '#ede9fe' : '#f0fdf4',
                          color: s.is_default ? '#6366f1' : '#16a34a',
                          fontWeight: 500,
                        }}>
                          {s.is_default ? '預設' : '自訂'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          onClick={() => handleDeleteStock(s.symbol)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', padding: '2px 8px' }}
                        >
                          移除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
