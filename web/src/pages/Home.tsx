import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Signal, Recommendation, WatchlistItem } from '../types';

export function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);

  const [recDate, setRecDate] = useState<string | null>(null);
  const [recItems, setRecItems] = useState<Recommendation[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getSignals(10).then(setSignals).catch(console.error);

    Promise.all([api.getRecommendations(), api.getWatchlist()])
      .then(([recs, wl]) => {
        setRecDate(recs.date);
        setRecItems(recs.items);
        setWatchlist(wl);
      })
      .catch(console.error)
      .finally(() => setRecLoading(false));
  }, []);

  const watchlistSymbols = new Set(watchlist.map((w) => w.symbol));

  async function handleAdd(item: Recommendation) {
    await api.addStock(item.symbol, item.name);
    setAddedSymbols((prev) => new Set(prev).add(item.symbol));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground mb-1">推薦選股</p>
          <p className="text-xs text-muted-foreground mb-4">每日排程掃描結果</p>
          {recLoading ? (
            <p className="text-sm text-muted-foreground">載入中...</p>
          ) : !recDate ? (
            <p className="text-sm text-muted-foreground">尚無推薦資料，請等待排程執行。</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4">掃描日期：{recDate}</p>
              {recItems.length === 0 ? (
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
                    {recItems.map((item) => {
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

      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-semibold text-foreground mb-4">近期訊號</p>
          {signals.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-6">
              目前沒有觸發訊號。
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {signals.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-3 bg-muted/40 rounded-lg">
                  <span className="font-bold text-primary text-sm min-w-[44px]">{s.symbol}</span>
                  <span className="text-muted-foreground text-[13px]">收盤 {s.close_price}</span>
                  <span className="ml-auto text-muted-foreground text-xs">
                    {s.triggered_at.split('T')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
