import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { parsePresets } from '../data/signals';
import type { AlgorithmTemplate, ConditionTree } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmLibrary() {
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [editing, setEditing] = useState<AlgorithmTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [saved, setSaved] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
  }, []);

  function startNew() {
    setEditing(null);
    setNewName('');
    setConditions(emptyTree);
    setMode('preset');
    setShowForm(true);
  }

  function startEdit(t: AlgorithmTemplate) {
    setEditing(t);
    setNewName(t.name);
    setConditions(t.conditions);
    const presets = parsePresets(t.conditions);
    setMode(t.conditions.conditions.length === 0 || presets !== null ? 'preset' : 'advanced');
    setShowForm(true);
  }

  async function handleSave() {
    if (!newName.trim()) return;
    if (editing) {
      await api.updateAlgorithmTemplate(editing.id, newName.trim(), conditions);
      setTemplates((prev) => prev.map((t) =>
        t.id === editing.id ? { ...t, name: newName.trim(), conditions } : t
      ));
    } else {
      const created = await api.createAlgorithmTemplate(newName.trim(), conditions);
      setTemplates((prev) => [...prev, created]);
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowForm(false); }, 1500);
  }

  async function handleDelete(id: string) {
    await api.deleteAlgorithmTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editing?.id === id) setShowForm(false);
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>算法庫</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>管理可跨群組共用的算法模板</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {templates.map((t) => (
          <div key={t.id} style={{
            background: '#fff', borderRadius: '12px', padding: '16px',
            border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{t.name}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                  {t.conditions.conditions.length} 個條件
                </span>
              </div>
              <button
                onClick={() => startEdit(t)}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                編輯
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                style={{ background: '#fff0f0', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
              >
                刪除
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px solid #e2e8f0' }}>
            尚無算法模板，點下方建立第一個
          </div>
        )}
      </div>

      {!showForm && (
        <button
          onClick={startNew}
          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          + 新增模板
        </button>
      )}

      {showForm && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
            {editing ? `編輯：${editing.name}` : '新增模板'}
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="模板名稱（如「動能型」）"
            style={{ border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', width: '100%', marginBottom: '16px', outline: 'none', boxSizing: 'border-box' }}
          />
          {mode === 'preset'
            ? <PresetSignalPicker value={conditions} onChange={setConditions} />
            : <ConditionBuilder conditions={conditions} onChange={setConditions} />
          }
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={handleSave}
              style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              儲存
            </button>
            {saved && <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>已儲存 ✓</span>}
            <button
              onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', marginLeft: 'auto' }}
            >
              取消
            </button>
            <button
              onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
            >
              {mode === 'preset' ? '⚙ 進階模式' : '← 回到訊號選擇'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
