import { useState, useRef, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import stocksData from '../data/stocks.json';
import usStocksData from '../data/us-stocks.json';
import { CRYPTO_LIST } from '../data/crypto';
import { FX_PAIRS } from '../data/fx';
import { cn } from '@/lib/utils';

type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

interface Asset {
  symbol: string;
  name: string;
}

interface Props {
  assetType: AssetType;
  onSelect: (symbol: string, name: string) => void;
}

const PLACEHOLDER: Record<AssetType, string> = {
  tw_stock: '輸入代號或名稱（如 2330 或 台積）',
  us_stock: '輸入代號或公司名稱（如 AAPL 或 Apple）',
  crypto: '輸入幣種（如 BTC 或 Bitcoin）',
  fx: '輸入貨幣對（如 USD/TWD）',
};

function getAssets(assetType: AssetType): Asset[] {
  switch (assetType) {
    case 'tw_stock': return stocksData as Asset[];
    case 'us_stock': return usStocksData as Asset[];
    case 'crypto':   return CRYPTO_LIST.map(({ symbol, name }) => ({ symbol, name }));
    case 'fx':       return FX_PAIRS.map(({ symbol, name }) => ({ symbol, name }));
  }
}

function filterAssets(assets: Asset[], query: string): Asset[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return assets
    .filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    .slice(0, 8);
}

export function AssetSearch({ assetType, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const assets = useMemo(() => getAssets(assetType), [assetType]);

  useEffect(() => {
    setResults(filterAssets(assets, query));
    setActiveIndex(-1);
  }, [query, assets]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(asset: Asset) {
    onSelect(asset.symbol, asset.name);
    setQuery('');
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setResults([]);
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center gap-2 bg-muted/40 border-2 border-primary rounded-lg px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER[assetType]}
          className="border-none outline-none bg-transparent text-[13px] text-foreground w-full"
        />
      </div>
      {results.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/50 border-b border-border uppercase tracking-wider font-semibold">
            搜尋結果
          </div>
          {results.map((asset, i) => (
            <div
              key={asset.symbol}
              onMouseDown={() => handleSelect(asset)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'px-3 py-2.5 flex items-center gap-3 cursor-pointer border-b border-border last:border-0',
                i === activeIndex ? 'bg-primary/5' : 'bg-card'
              )}
            >
              <span className="font-bold text-primary text-[13px] min-w-[60px]">{asset.symbol}</span>
              <span className="text-foreground text-[13px]">{asset.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
