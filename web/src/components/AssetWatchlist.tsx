import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AssetSearch } from './AssetSearch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Pager } from './Pager';
import { usePagination } from '../lib/usePagination';
import type { WatchlistItem } from '../types';

type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

interface Props {
  assetType: AssetType;
  label: string;
  description: string;
}

export function AssetWatchlist({ assetType, label, description }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.getWatchlist(assetType).then(setItems).catch(console.error);
  }, [assetType]);

  const { page, setPage, pageItems, totalPages } = usePagination(items, 10);

  const listRef = useRef<HTMLDivElement>(null);
  const [listMinHeight, setListMinHeight] = useState(0);

  useEffect(() => {
    if (listRef.current) {
      const h = listRef.current.scrollHeight;
      setListMinHeight((prev) => Math.max(prev, h));
    }
  }, [pageItems]);

  useEffect(() => {
    setPage(1);
    setListMinHeight(0);
  }, [assetType]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      const item = await api.addStock(selected.symbol, selected.name, assetType);
      setItems((prev) => [item, ...prev]);
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

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground mb-1">追蹤清單</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="mb-5">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold text-foreground mb-2">新增{label}</p>
          <form onSubmit={handleAdd} className="flex gap-2 items-start">
            <AssetSearch assetType={assetType} onSelect={(symbol, name) => setSelected({ symbol, name })} />
            {selected && (
              <Badge variant="secondary" className="self-center whitespace-nowrap shrink-0">
                {selected.symbol} {selected.name}
              </Badge>
            )}
            <Button type="submit" disabled={!selected} className="shrink-0">
              新增
            </Button>
          </form>
          {error && <p className="text-destructive text-[13px] mt-2">{error}</p>}
        </CardContent>
      </Card>

      <div ref={listRef} className="flex flex-col gap-2.5" style={{ minHeight: listMinHeight || undefined }}>
        {items.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              還沒有追蹤的項目，從上方搜尋新增吧
            </CardContent>
          </Card>
        )}
        {pageItems.map((item) => (
          <Card key={item.id} className={cn('transition-opacity', item.enabled ? 'opacity-100' : 'opacity-60')}>
            <CardContent className="flex items-center gap-4">
              <div className={cn('w-2 h-2 rounded-full shrink-0', item.enabled ? 'bg-emerald-500' : 'bg-muted-foreground')} />
              <div className="flex-1 flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">{item.symbol}</span>
                <span className="text-muted-foreground text-sm">{item.name}</span>
                <Badge variant={item.enabled ? 'default' : 'secondary'} className="text-[11px]">
                  {item.enabled ? '追蹤中' : '已暫停'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(`/watchlist/${item.id}/algorithm`)}>
                  設定算法
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleToggle(item)}>
                  {item.enabled ? '暫停' : '啟用'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                  刪除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Pager page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
