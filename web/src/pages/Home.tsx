import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, CardContent } from '@/components/ui/card';
import type { Signal } from '../types';

export function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(10).then(setSignals).catch(console.error);
  }, []);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">首頁</h1>
        <p className="text-sm text-muted-foreground">最新觸發訊號概覽</p>
      </div>
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
