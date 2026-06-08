import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { StockSearch } from '../components/StockSearch';
import { GroupPicker } from '../components/GroupPicker';
import { BulkImport } from '../components/BulkImport';
import { AlgorithmTemplatePicker } from '../components/AlgorithmTemplatePicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">追蹤清單</h1>
        <p className="text-[13px] text-muted-foreground">管理你想追蹤的股票</p>
      </div>

      {/* Group tabs */}
      <div className="flex items-center border-b border-border">
        <div className="flex items-center overflow-x-auto flex-1 min-w-0">
          <button
            onClick={() => { setActiveGroupId(null); setShowBulkImport(false); }}
            className={cn(
              'px-4 py-2.5 text-[13px] border-0 bg-transparent cursor-pointer whitespace-nowrap border-b-2 -mb-px transition-colors',
              activeGroupId === null
                ? 'text-primary font-semibold border-primary'
                : 'text-slate-400 font-normal border-transparent'
            )}
          >
            全部
          </button>
          {groups.map((g) => (
            <div key={g.id} className="flex items-center relative">
              <button
                onClick={() => { setActiveGroupId(g.id); setShowBulkImport(false); }}
                className={cn(
                  'px-4 py-2.5 text-[13px] border-0 bg-transparent cursor-pointer whitespace-nowrap border-b-2 -mb-px transition-colors',
                  g.id === activeGroupId
                    ? 'text-primary font-semibold border-primary'
                    : 'text-slate-400 font-normal border-transparent'
                )}
              >
                {g.name}
              </button>
            </div>
          ))}
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
                className="border border-primary rounded-md px-2 py-1 text-xs outline-none w-24 bg-background"
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
              className="px-3 py-2.5 text-[12px] border-0 bg-transparent cursor-pointer text-slate-400 whitespace-nowrap border-b-2 border-transparent -mb-px hover:text-foreground transition-colors"
            >
              + 新增群組
            </button>
          )}
        </div>

        {/* Batch apply template */}
        {activeGroupId && activeGroup && (
          <div className="relative shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBatchPickerOpen((o) => !o)}
              disabled={batchApplying}
              className="m-1.5 bg-primary/10 text-primary hover:bg-primary/20"
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
        <div>
          {showBulkImport ? (
            <BulkImport
              activeGroup={activeGroup}
              existingItems={items}
              onComplete={setItems}
              onClose={() => setShowBulkImport(false)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="bg-primary/10 text-primary hover:bg-primary/20" onClick={() => setShowBulkImport(true)}>
                ↑ 批量匯入到「{activeGroup.name}」
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteGroup(activeGroupId)}>
                刪除群組
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add stock */}
      <Card className="shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <CardContent>
          <p className="text-xs font-semibold text-foreground mb-2">新增股票</p>
          <form onSubmit={handleAdd} className="flex gap-2 items-start">
            <StockSearch onSelect={(symbol, name) => setSelected({ symbol, name })} />
            {selected && (
              <span className="self-center whitespace-nowrap text-[12px] font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
                {selected.symbol} {selected.name}
              </span>
            )}
            <Button
              type="submit"
              disabled={!selected}
              className="shrink-0 disabled:opacity-100 disabled:bg-secondary disabled:text-muted-foreground disabled:cursor-not-allowed disabled:pointer-events-auto"
            >
              新增
            </Button>
          </form>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* Stock list */}
      <div className="flex flex-col gap-2.5">
        {filteredItems.length === 0 && (
          <Card className="shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              {activeGroupId
                ? `「${activeGroup?.name}」群組還沒有股票，點上方批量匯入或新增股票後指定群組`
                : '還沒有追蹤的股票，從上方搜尋新增吧'}
            </CardContent>
          </Card>
        )}
        {filteredItems.map((item) => (
          <Card key={item.id} className={cn(
            'shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200',
            !item.enabled && 'opacity-60'
          )}>
            <CardContent>
              {/* Top row */}
              <div className="flex items-center gap-4 mb-2.5">
                <span className={cn(
                  'w-2 h-2 rounded-full shrink-0 ring-2',
                  item.enabled ? 'bg-emerald-500 ring-emerald-100' : 'bg-slate-300 ring-transparent'
                )} />
                <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-bold text-foreground text-sm">{item.symbol}</span>
                  <span className="text-muted-foreground text-sm">{item.name}</span>
                  <span className={cn(
                    'text-[11px] font-medium px-2 py-0.5 rounded-full',
                    item.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  )}>
                    {item.enabled ? '追蹤中' : '已暫停'}
                  </span>
                </div>
                <div className="flex gap-2 items-center shrink-0">
                  {item.algorithmTemplate ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-primary bg-primary/10 border border-primary/20">
                      模板：{item.algorithmTemplate.name}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-slate-500 bg-slate-50 border border-slate-200">
                      自訂算法
                    </span>
                  )}
                  <button
                    className="text-[12px] font-medium px-3 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors duration-150 cursor-pointer"
                    onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}
                  >
                    設定算法
                  </button>
                  <button
                    className="text-[12px] font-medium px-3 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors duration-150 cursor-pointer"
                    onClick={() => handleToggle(item)}
                  >
                    {item.enabled ? '暫停' : '啟用'}
                  </button>
                  <button
                    className="text-[12px] font-medium px-3 py-1 rounded-md text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
                    onClick={() => handleDelete(item.id)}
                  >
                    刪除
                  </button>
                </div>
              </div>

              {/* Group tags */}
              <div className="flex items-center gap-1.5 flex-wrap relative">
                {item.groups.map((g) => (
                  <span
                    key={g.id}
                    className="cursor-pointer text-[11px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-full transition-colors duration-150"
                    onClick={() => handleToggleGroup(item, g.id)}
                  >
                    {g.name} ×
                  </span>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setPickerOpenFor(pickerOpenFor === item.id ? null : item.id)}
                    className="text-[11px] text-slate-400 border border-dashed border-slate-300 rounded-full px-2 py-0.5 hover:border-primary hover:text-primary transition-colors duration-150 cursor-pointer bg-transparent"
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
