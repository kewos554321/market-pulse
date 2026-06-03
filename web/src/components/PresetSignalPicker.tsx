import { useState } from 'react';
import { SIGNALS, buildTree, parsePresets } from '../data/signals';
import type { SignalSelection } from '../data/signals';
import type { ConditionTree } from '../types';

interface Props {
  value: ConditionTree;
  onChange: (tree: ConditionTree) => void;
}

export function PresetSignalPicker({ value, onChange }: Props) {
  const [selections, setSelections] = useState<SignalSelection[]>(
    () => parsePresets(value) ?? []
  );

  function isSelected(signalId: string) {
    return selections.some((s) => s.signalId === signalId);
  }

  function getParams(signalId: string): Record<string, number> {
    return selections.find((s) => s.signalId === signalId)?.params ?? {};
  }

  function toggleSignal(signalId: string) {
    const def = SIGNALS.find((s) => s.id === signalId)!;
    let next: SignalSelection[];
    if (isSelected(signalId)) {
      next = selections.filter((s) => s.signalId !== signalId);
    } else {
      const defaultParams: Record<string, number> = {};
      def.params.forEach((p) => { defaultParams[p.key] = p.default; });
      next = [...selections, { signalId, params: defaultParams }];
    }
    setSelections(next);
    onChange(buildTree(next));
  }

  function updateParam(signalId: string, key: string, val: number) {
    const next = selections.map((s) =>
      s.signalId === signalId ? { ...s, params: { ...s.params, [key]: val } } : s
    );
    setSelections(next);
    onChange(buildTree(next));
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {SIGNALS.map((def) => {
          const selected = isSelected(def.id);
          const params = getParams(def.id);
          return (
            <div
              key={def.id}
              onClick={() => toggleSignal(def.id)}
              style={{
                padding: '14px', borderRadius: '8px', cursor: 'pointer',
                border: `1.5px solid ${selected ? '#6366f1' : 'transparent'}`,
                background: selected ? '#eff6ff' : '#f8fafc',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                  background: selected ? '#6366f1' : 'transparent',
                  border: selected ? 'none' : '1.5px solid #d1d5db',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: selected ? '#6366f1' : '#374151' }}>
                  {def.name}
                </span>
              </div>
              <p style={{ margin: selected && def.params.length > 0 ? '0 0 8px' : 0, fontSize: '11px', color: selected ? '#64748b' : '#94a3b8' }}>
                {def.description}
              </p>
              {selected && def.params.map((param) => (
                <select
                  key={param.key}
                  value={params[param.key] ?? param.default}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); updateParam(def.id, param.key, Number(e.target.value)); }}
                  style={{
                    fontSize: '11px', border: '1px solid #c7d2fe', borderRadius: '4px',
                    padding: '3px 6px', color: '#374151', background: '#fff', width: '100%',
                  }}
                >
                  {param.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ))}
            </div>
          );
        })}
      </div>

      {selections.length > 0 ? (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '4px' }}>
            已選訊號（觸發任一即通知）
          </div>
          {selections.map((s) => {
            const def = SIGNALS.find((d) => d.id === s.signalId)!;
            const paramLabel = def.params.map((p) => {
              const opt = p.options.find((o) => o.value === s.params[p.key]);
              return opt?.label ?? s.params[p.key];
            }).join(', ');
            return (
              <div key={s.signalId} style={{ fontSize: '12px', color: '#374151' }}>
                ✓ {def.name}{paramLabel ? ` (${paramLabel})` : ''}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: '16px', textAlign: 'center', color: '#94a3b8',
          fontSize: '13px', border: '1px dashed #e2e8f0', borderRadius: '8px',
        }}>
          請選擇至少一個訊號
        </div>
      )}
    </div>
  );
}
