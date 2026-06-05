import { useEffect, useRef } from 'react';
import type { AlgorithmTemplate } from '../types';

interface Props {
  templates: AlgorithmTemplate[];
  selectedTemplateId?: string | null;
  onSelect: (templateId: string | null) => void;
  onClose: () => void;
  onCreateNew: () => void;
}

export function AlgorithmTemplatePicker({ templates, selectedTemplateId, onSelect, onClose, onCreateNew }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', right: 0, zIndex: 200,
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '8px', minWidth: '240px',
        marginTop: '4px',
      }}
    >
      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        選擇算法模板
      </div>
      {templates.map((t) => {
        const isActive = selectedTemplateId === t.id;
        return (
          <div
            key={t.id}
            onClick={() => { onSelect(t.id); onClose(); }}
            style={{
              padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
              background: isActive ? '#f5f3ff' : 'transparent',
              border: isActive ? '1.5px solid #c4b5fd' : '1.5px solid transparent',
              marginBottom: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#4338ca' : '#374151' }}>{t.name}</span>
              {isActive && <span style={{ fontSize: '11px', color: '#7c3aed' }}>✓ 目前套用</span>}
            </div>
          </div>
        );
      })}
      {templates.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8' }}>尚無模板</div>
      )}
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '4px' }}>
        <div
          onClick={() => { onCreateNew(); onClose(); }}
          style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#6366f1', fontWeight: 500 }}
        >
          + 建立新模板
        </div>
        {selectedTemplateId && (
          <div
            onClick={() => { onSelect(null); onClose(); }}
            style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#ef4444' }}
          >
            解除連結（改為自訂）
          </div>
        )}
      </div>
    </div>
  );
}
