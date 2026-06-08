import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Recommendation, RecommendationStock, WatchlistItem } from '../types';

export function Recommendations() {
  const [date, setDate] = useState<string | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  const [stocks, setStocks] = useState<RecommendationStock[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [stockError, setStockError] = useState('');
  const [poolOpen, setPoolOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.getRecommendations(), api.getWatchlist()])
      .then(([recs, wl]) => {
        setDate(recs.date);
        setItems(recs.items);
        setWatchlist(wl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    api.getRecommendationStocks()
      .then(setStocks)
      .catch(console.error)
      .finally(() => setStocksLoading(false));
  }, []);

  const watchlistSymbols = new Set(watchlist.map((w) => w.symbol));

  async function handleAdd(item: Recommendation) {
    await api.addStock(item.symbol, item.name);
    setAddedSymbols((prev) => new Set(prev).add(item.symbol));
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
        <h1 className="text-xl font-bold text-foreground mb-1">推薦選股</h1>
        <p className="text-sm text-muted-foreground">每日排程掃描結果</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">載入中...</p>
          ) : !date ? (
            <p className="text-sm text-muted-foreground">尚無推薦資料，請等待排程執行。</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">掃描日期：{date}</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">今日無符合策略的標的。</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border">
                      {['代號', '名稱', '收盤價', '符合策略', ''].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-xs font-semibold text-muted-foreground text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const inWatchlist = watchlistSymbols.has(item.symbol) || addedSymbols.has(item.symbol);
                      return (
                        <tr key={item.id} className="border-b border-border/50">
                          <td className="px-2.5 py-2 text-[13px] font-semibold text-foreground">{item.symbol}</td>
                          <td className="px-2.5 py-2 text-[13px] text-foreground">{item.name}</td>
                          <td className="px-2.5 py-2 text-[13px] text-foreground">{item.close_price.toFixed(2)}</td>
                          <td className="px-2.5 py-2">
                            {item.strategies.map((s) => (
                              <Badge key={s} variant="secondary" className="mr-1 text-[11px]">{s}</Badge>
                            ))}
                          </td>
                          <td className="px-2.5 py-2">
                            <Button
                              size="sm"
                              variant={inWatchlist ? 'secondary' : 'default'}
                              disabled={inWatchlist}
                              onClick={() => handleAdd(item)}
                            >
                              {inWatchlist ? '已追蹤' : '加入追蹤'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <Button
          variant="outline"
          onClick={() => setPoolOpen((v) => !v)}
          className="gap-1.5"
        >
          <span>管理股票池</span>
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
