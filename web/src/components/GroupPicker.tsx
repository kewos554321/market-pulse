import { useState, useRef, useEffect } from 'react';
import type { Group } from '../types';

interface Props {
  groups: Group[];
  selectedGroupIds: string[];
  onToggle: (groupId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

export function GroupPicker({ groups, selectedGroupIds, onToggle, onCreate, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));
  const canCreate = query.trim() && !groups.some((g) => g.name === query.trim());

  async function handleCreate() {
    if (!canCreate || creating) return;
    setCreating(true);
    await onCreate(query.trim());
    setQuery('');
    setCreating(false);
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
      background: '#fff', border: '1.5px solid #6366f1', borderRadius: '8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: '180px', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px' }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="搜尋或新增群組..."
          style={{
            width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px',
            padding: '6px 8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
        {filtered.map((g) => {
          const selected = selectedGroupIds.includes(g.id);
          return (
            <div
              key={g.id}
              onMouseDown={(e) => { e.preventDefault(); onToggle(g.id); }}
              style={{
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                cursor: 'pointer', fontSize: '12px',
                background: selected ? '#eff6ff' : 'transparent',
                color: selected ? '#6366f1' : '#374151',
              }}
            >
              <span style={{ fontSize: '10px', opacity: selected ? 1 : 0 }}>✓</span>
              {g.name}
            </div>
          );
        })}
        {canCreate && (
          <div
            onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
            style={{
              padding: '8px 12px', fontSize: '12px', color: '#6366f1',
              cursor: 'pointer', borderTop: filtered.length > 0 ? '1px solid #f1f5f9' : 'none',
              opacity: creating ? 0.5 : 1,
            }}
          >
            + 新增「{query.trim()}」
          </div>
        )}
        {filtered.length === 0 && !canCreate && (
          <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8' }}>
            沒有符合的群組
          </div>
        )}
      </div>
    </div>
  );
}
