import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground mb-1">算法庫</h1>
        <p className="text-sm text-muted-foreground">管理可跨群組共用的算法模板</p>
      </div>

      <div className="flex flex-col gap-2.5 mb-4">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center gap-3">
              <div className="flex-1">
                <span className="font-bold text-foreground text-sm">{t.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {t.conditions.conditions.length} 個條件
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => startEdit(t)}>編輯</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)}>刪除</Button>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              尚無算法模板，點下方建立第一個
            </CardContent>
          </Card>
        )}
      </div>

      {!showForm && (
        <Button onClick={startNew}>+ 新增模板</Button>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-[13px] font-semibold text-foreground mb-3">
              {editing ? `編輯：${editing.name}` : '新增模板'}
            </p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="模板名稱（如「動能型」）"
              className="mb-4"
            />
            {mode === 'preset'
              ? <PresetSignalPicker value={conditions} onChange={setConditions} />
              : <ConditionBuilder conditions={conditions} onChange={setConditions} />
            }
            <div className="flex items-center gap-3 mt-4">
              <Button onClick={handleSave}>儲存</Button>
              {saved && <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => setShowForm(false)}
              >
                取消
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
              >
                {mode === 'preset' ? '⚙ 進階模式' : '← 回到訊號選擇'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
