import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Pager } from './Pager';
import { usePagination } from '../lib/usePagination';
import { useStableListHeight } from '../lib/useStableListHeight';
import type { AssetType, Signal } from '../types';

interface Props {
  assetType: AssetType;
}

export function AssetSignals({ assetType }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    api.getSignals(100, assetType).then(setSignals).catch(console.error);
  }, [assetType]);

  const { page, setPage, pageItems, totalPages } = usePagination(signals, 20);
  const { listRef, listMinHeight, resetHeight } = useStableListHeight(pageItems);

  useEffect(() => {
    setPage(1);
    resetHeight();
  }, [assetType]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">訊號歷史</h1>
        <p className="text-sm text-muted-foreground">系統觸發過的買賣訊號紀錄</p>
      </div>
      <div ref={listRef} className="flex flex-col gap-2.5" style={{ minHeight: listMinHeight || undefined }}>
        {signals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              目前沒有觸發訊號
            </CardContent>
          </Card>
        ) : pageItems.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-foreground text-sm">{s.symbol}</span>
                  <Badge className="text-[11px]">觸發</Badge>
                  {s.notified && (
                    <span className="text-[11px] text-emerald-600">✓ 已通知</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  收盤價 {s.close_price} ・ {new Date(s.triggered_at).toLocaleString('zh-TW')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
