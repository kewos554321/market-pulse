import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StockSearch } from '../components/StockSearch';
import { GroupPicker } from '../components/GroupPicker';
import { BulkImport } from '../components/BulkImport';
import { AlgorithmTemplatePicker } from '../components/AlgorithmTemplatePicker';
import type { WatchlistItem, Group, AlgorithmTemplate } from '../types';

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [templates, setTemplates] = useState<AlgorithmTemplate[]>([]);
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [batchApplying, setBatchApplying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist().then(setItems).catch(console.error);
    api.getGroups().then(setGroups).catch(console.error);
    api.getAlgorithmTemplates().then(setTemplates).catch(console.error);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const filteredItems = activeGroupId
    ? items.filter((item) => item.groups.some((g) => g.id === activeGroupId))
    : items;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addStock(selected.symbol, selected.name, 'tw_stock');
      const newItem = { ...item, groups: [] as Group[] };
      if (activeGroupId && activeGroup) {
        await api.setWatchlistGroups(item.id, [activeGroupId]);
        newItem.groups = [activeGroup];
      }
      setItems((prev) => [newItem, ...prev]);
      setSelected(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(id: string) {
    await api.deleteStock(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleToggle(item: WatchlistItem) {
    await api.toggleStock(item.id, item.enabled === 0);
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, enabled: i.enabled === 1 ? 0 : 1 } : i)
    );
  }

  async function handleToggleGroup(item: WatchlistItem, groupId: string) {
    const currentIds = item.groups.map((g) => g.id);
    const newIds = currentIds.includes(groupId)
      ? currentIds.filter((id) => id !== groupId)
      : [...currentIds, groupId];
    await api.setWatchlistGroups(item.id, newIds);
    setItems((prev) => prev.map((i) => {
      if (i.id !== item.id) return i;
      const newGroups = newIds.map((id) => groups.find((g) => g.id === id)!).filter(Boolean);
      return { ...i, groups: newGroups };
    }));
  }

  async function handleCreateAndAssign(itemId: string, name: string) {
    const group = await api.createGroup(name);
    setGroups((prev) => [...prev, group]);
    const item = items.find((i) => i.id === itemId)!;
    const newIds = [...item.groups.map((g) => g.id), group.id];
    await api.setWatchlistGroups(itemId, newIds);
    setItems((prev) => prev.map((i) =>
      i.id === itemId ? { ...i, groups: [...i.groups, group] } : i
    ));
  }

  async function handleDeleteGroup(groupId: string) {
    await api.deleteGroup(groupId);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (activeGroupId === groupId) setActiveGroupId(null);
  }

  async function handleBatchApplyTemplate(templateId: string | null) {
    if (!activeGroupId) return;
    setBatchApplying(true);
    const tmpl = templates.find((t) => t.id === templateId) ?? null;
    await api.batchApplyTemplate(activeGroupId, templateId);
    setItems((prev) => prev.map((item) => {
      if (!filteredItems.some((f) => f.id === item.id)) return item;
      return {
        ...item,
        algorithm_template_id: templateId,
        algorithmTemplate: tmpl ? { id: tmpl.id, name: tmpl.name } : null,
      };
    }));
    setBatchApplying(false);
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>追蹤清單</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>管理你想追蹤的股票</p>
      </div>

      {/* Group tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', flex: 1, minWidth: 0 }}>
          <button
            onClick={() => { setActiveGroupId(null); setShowBulkImport(false); }}
            style={{
              padding: '10px 16px', fontSize: '13px', border: 'none', background: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
              color: activeGroupId === null ? '#6366f1' : '#94a3b8',
              fontWeight: activeGroupId === null ? 600 : 400,
              borderBottom: activeGroupId === null ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            全部
          </button>
          {groups.map((g) => {
            const isActive = g.id === activeGroupId;
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <button
                  onClick={() => { setActiveGroupId(g.id); setShowBulkImport(false); }}
                  style={{
                    padding: '10px 12px 10px 16px', fontSize: '13px', border: 'none', background: 'none',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    color: isActive ? '#6366f1' : '#94a3b8',
                    fontWeight: isActive ? 600 : 400,
                    borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                  }}
                >
                  {g.name}
                </button>
              </div>
            );
          })}
          {showNewGroupInput ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newGroupName.trim()) return;
                const group = await api.createGroup(newGroupName.trim());
                setGroups((prev) => [...prev, group]);
                setActiveGroupId(group.id);
                setNewGroupName('');
                setShowNewGroupInput(false);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px' }}
            >
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); } }}
                placeholder="群組名稱..."
                style={{
                  border: '1.5px solid #6366f1', borderRadius: '6px', padding: '4px 8px',
                  fontSize: '12px', outline: 'none', width: '100px',
                }}
              />
              <button type="submit" style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                建立
              </button>
              <button type="button" onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                取消
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewGroupInput(true)}
              style={{
                padding: '10px 12px', fontSize: '12px', border: 'none', background: 'none',
                cursor: 'pointer', color: '#94a3b8', whiteSpace: 'nowrap',
                borderBottom: '2px solid transparent',
              }}
            >
              + 新增群組
            </button>
          )}
        </div>

        {/* Batch apply template — only shown when a group is active */}
        {activeGroupId && activeGroup && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setBatchPickerOpen((o) => !o)}
              disabled={batchApplying}
              style={{
                padding: '6px 12px', margin: '6px 8px', fontSize: '12px', fontWeight: 600,
                color: '#6366f1', background: '#eff6ff', border: 'none', borderRadius: '8px',
                cursor: 'pointer', whiteSpace: 'nowrap', opacity: batchApplying ? 0.6 : 1,
              }}
            >
              {batchApplying ? '套用中...' : '⚙ 批次套用模板 ▾'}
            </button>
            {batchPickerOpen && (
              <AlgorithmTemplatePicker
                templates={templates}
                selectedTemplateId={null}
                onSelect={(templateId) => { handleBatchApplyTemplate(templateId); }}
                onClose={() => setBatchPickerOpen(false)}
                onCreateNew={() => navigate('/algorithm-library')}
              />
            )}
          </div>
        )}
      </div>

      {/* Bulk import + delete group */}
      {activeGroupId && activeGroup && (
        <div style={{ marginBottom: '8px' }}>
          {showBulkImport ? (
            <BulkImport
              activeGroup={activeGroup}
              existingItems={items}
              onComplete={setItems}
              onClose={() => setShowBulkImport(false)}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setShowBulkImport(true)}
                style={{
                  background: '#eff6ff', color: '#6366f1', border: 'none',
                  borderRadius: '8px', padding: '7px 14px', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                ↑ 批量匯入到「{activeGroup.name}」
              </button>
              <button
                onClick={() => handleDeleteGroup(activeGroupId)}
                style={{
                  background: 'none', color: '#ef4444', border: '1px solid #fecaca',
                  borderRadius: '8px', padding: '7px 14px', fontSize: '12px',
                  fontWeight: 500, cursor: 'pointer',
                }}
              >
                刪除群組
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add stock */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>新增股票</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <StockSearch onSelect={(symbol, name) => setSelected({ symbol, name })} />
          {selected && (
            <span style={{
              alignSelf: 'center', fontSize: '12px', color: '#6366f1',
              background: '#eff6ff', padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap',
            }}>
              {selected.symbol} {selected.name}
            </span>
          )}
          <button
            type="submit"
            disabled={!selected}
            style={{
              background: selected ? '#6366f1' : '#e2e8f0',
              color: selected ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              fontSize: '13px', fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            新增
          </button>
        </form>
        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{error}</p>}
      </div>

      {/* Stock list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredItems.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            textAlign: 'center', color: '#94a3b8', fontSize: '14px', border: '1px solid #e2e8f0',
          }}>
            {activeGroupId
              ? `「${activeGroup?.name}」群組還沒有股票，點上方批量匯入或新增股票後指定群組`
              : '還沒有追蹤的股票，從上方搜尋新增吧'}
          </div>
        )}
        {filteredItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff', borderRadius: '12px', padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
              opacity: item.enabled ? 1 : 0.6, transition: 'opacity 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: item.enabled ? '#10b981' : '#d1d5db',
              }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{item.symbol}</span>
                <span style={{ color: '#475569', fontSize: '14px' }}>{item.name}</span>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '99px', fontWeight: 500,
                  background: item.enabled ? '#dcfce7' : '#f1f5f9',
                  color: item.enabled ? '#166534' : '#64748b',
                }}>
                  {item.enabled ? '追蹤中' : '已暫停'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Algorithm badge */}
                {item.algorithmTemplate ? (
                  <span style={{
                    fontSize: '11px', padding: '2px 10px', borderRadius: '99px', border: '1px solid',
                    background: '#eff6ff', color: '#6366f1', borderColor: '#c7d2fe',
                  }}>
                    模板：{item.algorithmTemplate.name}
                  </span>
                ) : (
                  <span style={{
                    fontSize: '11px', background: '#f8fafc', color: '#64748b',
                    padding: '2px 10px', borderRadius: '99px', border: '1px solid #e2e8f0',
                  }}>
                    自訂算法
                  </span>
                )}
                <button
                  onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                  style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
                  設定算法
                </button>
                <button
                  onClick={() => handleToggle(item)}
                  style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
                  {item.enabled ? '暫停' : '啟用'}
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{ background: '#fff0f0', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                >
                  刪除
                </button>
              </div>
            </div>

            {/* Group tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', position: 'relative' }}>
              {item.groups.map((g) => (
                <span
                  key={g.id}
                  onClick={() => handleToggleGroup(item, g.id)}
                  style={{
                    fontSize: '11px', color: '#6366f1', background: '#eff6ff',
                    padding: '2px 8px', borderRadius: '99px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {g.name} ×
                </span>
              ))}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setPickerOpenFor(pickerOpenFor === item.id ? null : item.id)}
                  style={{
                    fontSize: '11px', color: '#94a3b8', background: 'none',
                    border: '1px dashed #d1d5db', borderRadius: '99px',
                    padding: '2px 8px', cursor: 'pointer',
                  }}
                >
                  + 群組
                </button>
                {pickerOpenFor === item.id && (
                  <GroupPicker
                    groups={groups}
                    selectedGroupIds={item.groups.map((g) => g.id)}
                    onToggle={(gid) => handleToggleGroup(item, gid)}
                    onCreate={(name) => handleCreateAndAssign(item.id, name)}
                    onClose={() => setPickerOpenFor(null)}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
