import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ConditionBuilder } from '../components/ConditionBuilder';
import { PresetSignalPicker } from '../components/PresetSignalPicker';
import { AlgorithmTemplatePicker } from '../components/AlgorithmTemplatePicker';
import { parsePresets } from '../data/signals';
import type { AlgorithmState, AlgorithmTemplate, ConditionTree, WatchlistItem } from '../types';

const emptyTree: ConditionTree = { operator: 'OR', conditions: [] };

export function AlgorithmEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stock, setStock] = useState<WatchlistItem | null>(null);
  const [algoState, setAlgoState] = useState<AlgorithmState>({ source: 'custom', conditions: emptyTree });
  const [conditions, setConditions] = useState<ConditionTree>(emptyTree);
  const [mode, setMode] = useState<'preset' | 'advanced'>('preset');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getWatchlist().then((list) => setStock(list.find((s) => s.id === id) ?? null));
    api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
    api.getAlgorithm(id)
      .then((state) => {
        setAlgoState(state);
        if (state.source === 'custom') {
          setConditions(state.conditions);
          const presets = parsePresets(state.conditions);
          setMode(state.conditions.conditions.length === 0 || presets !== null ? 'preset' : 'advanced');
        }
      })
      .catch(() => {
        setAlgoState({ source: 'custom', conditions: emptyTree });
        setConditions(emptyTree);
        setMode('preset');
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSelectTemplate(templateId: string | null) {
    if (!id) return;
    await api.setWatchlistAlgorithmTemplate(id, templateId);
    const refreshed = await api.getAlgorithm(id);
    setAlgoState(refreshed);
    if (refreshed.source === 'custom') {
      setConditions(refreshed.conditions);
    }
  }

  async function handleSave() {
    if (!id) return;
    if (algoState.source === 'custom') {
      await api.saveAlgorithm(id, conditions);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
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

      {/* Template link selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
        position: 'relative',
      }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginRight: '4px' }}>算法來源：</span>
        <span style={{
          fontSize: '12px', fontWeight: 600,
          color: algoState.source === 'template' ? '#4338ca' : '#374151',
        }}>
          {algoState.source === 'template'
            ? `模板：${algoState.templateName ?? '(未命名)'}`
            : '自訂'}
        </span>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setTemplatePickerOpen((o) => !o)}
            style={{
              padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: '#f1f5f9', color: '#374151',
            }}
          >
            連結模板 ▾
          </button>
          {templatePickerOpen && (
            <AlgorithmTemplatePicker
              templates={templates}
              selectedTemplateId={algoState.templateId}
              onSelect={handleSelectTemplate}
              onClose={() => setTemplatePickerOpen(false)}
              onCreateNew={() => navigate('/algorithm-library')}
            />
          )}
        </div>
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
        ) : algoState.source === 'template' ? (
          <div>
            <div style={{
              background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '10px',
              padding: '12px 16px', marginBottom: '12px',
            }}>
              <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginBottom: '8px' }}>
                模板：{algoState.templateName ?? '(未命名)'}（即時同步）
              </div>
              {algoState.conditions.conditions.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>此模板尚未設定條件</div>
              ) : (
                <pre style={{ margin: 0, fontSize: '12px', color: '#4338ca', fontFamily: 'monospace' }}>
                  {JSON.stringify(algoState.conditions, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : mode === 'preset' ? (
          <PresetSignalPicker value={conditions} onChange={setConditions} />
        ) : (
          <ConditionBuilder conditions={conditions} onChange={setConditions} />
        )}
      </div>

      {algoState.source === 'custom' && (
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
      )}

      {algoState.source === 'custom' && (
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
      )}
    </div>
  );
}
