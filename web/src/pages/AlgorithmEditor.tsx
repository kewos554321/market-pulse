import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    if (refreshed.source === 'custom') setConditions(refreshed.conditions);
  }

  async function handleSave() {
    if (!id) return;
    if (algoState.source === 'custom') await api.saveAlgorithm(id, conditions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="text-primary mb-4 px-0 hover:bg-transparent"
        onClick={() => navigate(-1)}
      >
        ← 返回清單
      </Button>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">算法設定</h1>
        {stock && (
          <p className="text-sm text-muted-foreground">{stock.symbol} {stock.name}</p>
        )}
      </div>

      <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3.5 py-2.5 mb-4 relative">
        <span className="text-xs text-muted-foreground font-medium mr-1">算法來源：</span>
        <span className={`text-xs font-semibold ${algoState.source === 'template' ? 'text-violet-700' : 'text-foreground'}`}>
          {algoState.source === 'template'
            ? `模板：${algoState.templateName ?? '(未命名)'}`
            : '自訂'}
        </span>
        <div className="ml-auto relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTemplatePickerOpen((o) => !o)}
          >
            連結模板 ▾
          </Button>
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

      <Card className="mb-4">
        <CardContent className="pt-5">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground text-[13px]">載入中...</div>
          ) : algoState.source === 'template' ? (
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
              <div className="text-xs text-violet-700 font-semibold mb-2">
                模板：{algoState.templateName ?? '(未命名)'}（即時同步）
              </div>
              {algoState.conditions.conditions.length === 0 ? (
                <div className="text-xs text-muted-foreground">此模板尚未設定條件</div>
              ) : (
                <pre className="m-0 text-xs text-violet-700 font-mono">
                  {JSON.stringify(algoState.conditions, null, 2)}
                </pre>
              )}
            </div>
          ) : mode === 'preset' ? (
            <PresetSignalPicker value={conditions} onChange={setConditions} />
          ) : (
            <ConditionBuilder conditions={conditions} onChange={setConditions} />
          )}
        </CardContent>
      </Card>

      {algoState.source === 'custom' && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Button onClick={handleSave}>儲存算法</Button>
          {saved && <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => setMode(mode === 'preset' ? 'advanced' : 'preset')}
          >
            {mode === 'preset' ? '⚙ 進階模式（自訂條件數值）' : '← 回到訊號選擇'}
          </Button>
        </div>
      )}

      {algoState.source === 'custom' && (
        <details>
          <summary className="cursor-pointer text-muted-foreground text-xs select-none">查看 JSON</summary>
          <pre className="bg-muted/40 border border-border rounded-lg px-4 py-4 text-xs overflow-auto mt-2 text-foreground">
            {JSON.stringify(conditions, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
