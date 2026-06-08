import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EmailRecipient } from '../api/client';
import type { RecommendationStock } from '../types';

export function Settings() {
  const [enabled, setEnabled] = useState(true);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [emailError, setEmailError] = useState('');

  const [lineToken, setLineToken] = useState('');
  const [lineSecret, setLineSecret] = useState('');
  const [lineGroupId, setLineGroupId] = useState('');
  const [lineTokenSet, setLineTokenSet] = useState(false);
  const [lineSecretSet, setLineSecretSet] = useState(false);
  const [lineSaved, setLineSaved] = useState(false);

  const [stocks, setStocks] = useState<RecommendationStock[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [stockError, setStockError] = useState('');
  const [poolOpen, setPoolOpen] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setEnabled(s.schedule_enabled !== '0');
      setLineGroupId(s.line_group_id ?? '');
      setLineTokenSet(!!s.line_channel_access_token);
      setLineSecretSet(false);
    }).catch(console.error);

    api.getEmailRecipients()
      .then(setRecipients)
      .catch(console.error)
      .finally(() => setRecipientsLoading(false));

    api.getRecommendationStocks()
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, []);

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    await api.saveSettings({ schedule_enabled: enabled ? '1' : '0' });
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 2000);
  }

  async function handleAddRecipient(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    try {
      const recipient = await api.addEmailRecipient(newEmail.trim(), newLabel.trim() || undefined);
      setRecipients((prev) => [...prev, recipient]);
      setNewEmail('');
      setNewLabel('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('409')) setEmailError('此 email 已存在');
      else if (msg.includes('invalid')) setEmailError('Email 格式不正確');
      else setEmailError('新增失敗');
    }
  }

  async function handleDeleteRecipient(id: string) {
    if (!confirm('確定要移除此收件人？')) return;
    await api.deleteEmailRecipient(id);
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSaveLine(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, string> = {};
    if (lineToken) updates.line_channel_access_token = lineToken;
    if (lineSecret) updates.line_channel_secret = lineSecret;
    if (lineGroupId) updates.line_group_id = lineGroupId;
    await api.saveSettings(updates);
    if (lineToken) setLineTokenSet(true);
    if (lineSecret) setLineSecretSet(true);
    setLineToken('');
    setLineSecret('');
    setLineSaved(true);
    setTimeout(() => setLineSaved(false), 2000);
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    setStockError('');
    try {
      const stock = await api.addRecommendationStock(newSymbol.trim(), newName.trim());
      setStocks((prev) => [...prev, stock]);
      setNewSymbol('');
      setNewName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStockError(msg.includes('full') ? '股票池已達上限 120 支' : '新增失敗，請確認代號是否重複');
    }
  }

  async function handleDeleteStock(symbol: string) {
    await api.deleteRecommendationStock(symbol);
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">設定</h1>
        <p className="text-sm text-muted-foreground">通知和排程設定</p>
      </div>

      <Card className="max-w-[480px]">
        <CardContent className="pt-5">
          <form onSubmit={handleSaveSchedule} className="flex flex-col gap-5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <div className="text-[13px] font-semibold text-foreground">啟用每日排程</div>
                <div className="text-xs text-muted-foreground">每週一到五 14:35 台北時間自動執行</div>
              </div>
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit">儲存設定</Button>
              {scheduleSaved && (
                <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 mb-3">
        <h2 className="text-base font-bold text-foreground mb-1">Email 收件人</h2>
        <p className="text-sm text-muted-foreground">每日訊號通知的收件人清單</p>
      </div>

      <Card className="max-w-[560px]">
        <CardContent className="pt-5">
          <form onSubmit={handleAddRecipient} className="flex gap-2 mb-4 flex-wrap items-center">
            <Input
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-48"
              required
            />
            <Input
              type="text"
              placeholder="備註（選填）"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-28"
            />
            <Button type="submit">新增</Button>
            {emailError && (
              <span className="text-xs text-destructive self-center">{emailError}</span>
            )}
          </form>

          {recipientsLoading ? (
            <p className="text-sm text-muted-foreground">載入中...</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無收件人</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  {['Email', '備註', ''].map((h) => (
                    <th key={h} className="px-2.5 py-2 text-xs font-semibold text-muted-foreground text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-2.5 py-2 text-[13px] text-foreground">{r.email}</td>
                    <td className="px-2.5 py-2 text-[13px] text-muted-foreground">{r.label ?? '—'}</td>
                    <td className="px-2.5 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteRecipient(r.id)}
                      >
                        移除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 mb-3">
        <h2 className="text-base font-bold text-foreground mb-1">LINE 通知</h2>
        <p className="text-sm text-muted-foreground">
          將 Bot 加入群組後 Group ID 將自動填入。
          Webhook URL：<code className="text-xs bg-muted px-1 py-0.5 rounded">https://&lt;workers-domain&gt;/line/webhook</code>
        </p>
      </div>

      <Card className="max-w-[480px]">
        <CardContent className="pt-5">
          <form onSubmit={handleSaveLine} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-token">Channel Access Token</Label>
              <Input
                id="line-token"
                type="password"
                value={lineToken}
                onChange={(e) => setLineToken(e.target.value)}
                placeholder={lineTokenSet ? '已設定（留空保持不變）' : '貼上 Channel Access Token'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-secret">Channel Secret</Label>
              <Input
                id="line-secret"
                type="password"
                value={lineSecret}
                onChange={(e) => setLineSecret(e.target.value)}
                placeholder={lineSecretSet ? '已設定（留空保持不變）' : '貼上 Channel Secret（用於驗證 webhook）'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-group">Group ID</Label>
              <Input
                id="line-group"
                type="text"
                value={lineGroupId}
                onChange={(e) => setLineGroupId(e.target.value)}
                placeholder="Bot 加入群組後自動填入，或手動輸入"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">儲存 LINE 設定</Button>
              {lineSaved && (
                <span className="text-[13px] text-emerald-600 font-medium">已儲存 ✓</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 mb-3">
        <h2 className="text-base font-bold text-foreground mb-1">管理股票池</h2>
        <p className="text-sm text-muted-foreground">設定每日推薦掃描的候選股票</p>
      </div>

      <div>
        <Button
          variant="outline"
          onClick={() => setPoolOpen((v) => !v)}
          className="gap-1.5"
        >
          <span>股票池</span>
          {!stocksLoading && (
            <span className="text-xs text-muted-foreground font-normal">{stocks.length} / 120 支</span>
          )}
          <span className="text-xs text-muted-foreground">{poolOpen ? '▲' : '▼'}</span>
        </Button>

        {poolOpen && (
          <Card className="mt-3 max-w-[560px]">
            <CardContent className="pt-5">
              {stocksLoading ? (
                <p className="text-sm text-muted-foreground">載入中...</p>
              ) : (
                <>
                  <form onSubmit={handleAddStock} className="flex gap-2 mb-4 flex-wrap items-center">
                    <Input
                      type="text"
                      placeholder="代號（如 2330）"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value)}
                      className="w-32"
                      required
                    />
                    <Input
                      type="text"
                      placeholder="名稱（如 台積電）"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-32"
                      required
                    />
                    <Button type="submit">新增</Button>
                    {stockError && (
                      <span className="text-xs text-destructive self-center">{stockError}</span>
                    )}
                  </form>

                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border">
                          {['代號', '名稱', '類型', ''].map((h) => (
                            <th key={h} className="px-2.5 py-2 text-xs font-semibold text-muted-foreground text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stocks.map((s) => (
                          <tr key={s.symbol} className="border-b border-border/50">
                            <td className="px-2.5 py-2 text-[13px] font-semibold text-foreground">{s.symbol}</td>
                            <td className="px-2.5 py-2 text-[13px] text-foreground">{s.name}</td>
                            <td className="px-2.5 py-2">
                              <Badge variant={s.is_default ? 'default' : 'secondary'} className="text-[11px]">
                                {s.is_default ? '預設' : '自訂'}
                              </Badge>
                            </td>
                            <td className="px-2.5 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteStock(s.symbol)}
                              >
                                移除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
