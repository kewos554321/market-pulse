import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StockSearch } from '../components/StockSearch';
import { GroupPicker } from '../components/GroupPicker';
import { BulkImport } from '../components/BulkImport';
import { AlgorithmTemplatePicker } from '../components/AlgorithmTemplatePicker';
import { Button } from '../components/ui/button';
import type { WatchlistItem, Group, AlgorithmTemplate } from '../types';

export function WatchlistNew() {
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
      {/* Header */}
      <div className="mb-4">
        <h1 className="m-0 mb-1 text-xl font-bold text-slate-900">追蹤清單</h1>
        <p className="m-0 text-[13px] text-slate-500">管理你想追蹤的股票</p>
      </div>

      {/* Group tabs */}
      <div className="flex items-center border-b border-slate-200 mb-4">
        <div className="flex items-center overflow-x-auto flex-1 min-w-0">
          <button
            onClick={() => { setActiveGroupId(null); setShowBulkImport(false); }}
            className={`px-4 py-2.5 text-[13px] border-0 bg-transparent cursor-pointer whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeGroupId === null
                ? 'text-indigo-500 font-semibold border-indigo-500'
                : 'text-slate-400 font-normal border-transparent'
            }`}
          >
            全部
          </button>
          {groups.map((g) => {
            const isActive = g.id === activeGroupId;
            return (
              <div key={g.id} className="flex items-center relative">
                <button
                  onClick={() => { setActiveGroupId(g.id); setShowBulkImport(false); }}
                  className={`px-4 py-2.5 text-[13px] border-0 bg-transparent cursor-pointer whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    isActive
                      ? 'text-indigo-500 font-semibold border-indigo-500'
                      : 'text-slate-400 font-normal border-transparent'
                  }`}
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
              className="flex items-center gap-1 px-2 py-1.5"
            >
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); }
                }}
                placeholder="群組名稱..."
                className="border-[1.5px] border-indigo-500 rounded-md px-2 py-1 text-xs outline-none w-24"
              />
              <Button type="submit" size="xs">建立</Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }}
              >
                取消
              </Button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewGroupInput(true)}
              className="px-3 py-2.5 text-xs border-0 bg-transparent cursor-pointer text-slate-400 whitespace-nowrap border-b-2 border-transparent -mb-px"
            >
              + 新增群組
            </button>
          )}
        </div>

        {/* Batch apply template */}
        {activeGroupId && activeGroup && (
          <div className="relative shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchPickerOpen((o) => !o)}
              disabled={batchApplying}
              className="m-1.5"
            >
              {batchApplying ? '套用中...' : '⚙ 批次套用模板 ▾'}
            </Button>
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
        <div className="mb-2">
          {showBulkImport ? (
            <BulkImport
              activeGroup={activeGroup}
              existingItems={items}
              onComplete={setItems}
              onClose={() => setShowBulkImport(false)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowBulkImport(true)}>
                ↑ 批量匯入到「{activeGroup.name}」
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteGroup(activeGroupId)}>
                刪除群組
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add stock */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
        <div className="text-xs font-semibold text-slate-700 mb-2">新增股票</div>
        <form onSubmit={handleAdd} className="flex gap-2 items-start">
          <StockSearch onSelect={(symbol, name) => setSelected({ symbol, name })} />
          {selected && (
            <span className="self-center text-xs text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full whitespace-nowrap">
              {selected.symbol} {selected.name}
            </span>
          )}
          <button
            type="submit"
            disabled={!selected}
            className={`px-5 py-[10px] text-[13px] font-semibold rounded-[8px] border-0 whitespace-nowrap ${
              selected
                ? 'bg-indigo-500 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >新增</button>
        </form>
        {error && <p className="text-red-500 text-[13px] mt-2 mb-0">{error}</p>}
      </div>

      {/* Stock list */}
      <div className="flex flex-col gap-2.5">
        {filteredItems.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 text-sm border border-slate-200">
            {activeGroupId
              ? `「${activeGroup?.name}」群組還沒有股票，點上方批量匯入或新增股票後指定群組`
              : '還沒有追蹤的股票，從上方搜尋新增吧'}
          </div>
        )}
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-xl p-4 shadow-sm border border-slate-200 transition-opacity ${
              item.enabled ? 'opacity-100' : 'opacity-60'
            }`}
          >
            <div className="flex items-center gap-4 mb-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                item.enabled ? 'bg-emerald-500' : 'bg-slate-300'
              }`} />
              <div className="flex-1 flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{item.symbol}</span>
                <span className="text-slate-600 text-sm">{item.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  item.enabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.enabled ? '追蹤中' : '已暫停'}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                {item.algorithmTemplate ? (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                    模板：{item.algorithmTemplate.name}
                  </span>
                ) : (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                    自訂算法
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                >
                  設定算法
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleToggle(item)}>
                  {item.enabled ? '暫停' : '啟用'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                  刪除
                </Button>
              </div>
            </div>

            {/* Group tags */}
            <div className="flex items-center gap-1.5 flex-wrap relative">
              {item.groups.map((g) => (
                <span
                  key={g.id}
                  onClick={() => handleToggleGroup(item, g.id)}
                  className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium cursor-pointer"
                >
                  {g.name} ×
                </span>
              ))}
              <div className="relative">
                <button
                  onClick={() => setPickerOpenFor(pickerOpenFor === item.id ? null : item.id)}
                  className="text-[11px] text-slate-400 bg-transparent border border-dashed border-slate-300 rounded-full px-2 py-0.5 cursor-pointer"
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
