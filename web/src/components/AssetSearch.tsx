import { useState, useRef, useEffect, useMemo } from 'react';
import stocksData from '../data/stocks.json';
import usStocksData from '../data/us-stocks.json';
import { CRYPTO_LIST } from '../data/crypto';
import { FX_PAIRS } from '../data/fx';

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
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#f8fafc', border: '1.5px solid #6366f1',
        borderRadius: '8px', padding: '9px 12px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER[assetType]}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: '13px', color: '#1e293b', width: '100%',
          }}
        />
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden',
        }}>
          <div style={{
            padding: '6px 12px', fontSize: '10px', color: '#94a3b8',
            background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
            letterSpacing: '0.05em', fontWeight: 600,
          }}>
            搜尋結果
          </div>
          {results.map((asset, i) => (
            <div
              key={asset.symbol}
              onMouseDown={() => handleSelect(asset)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '10px 12px', display: 'flex', alignItems: 'center',
                gap: '12px', cursor: 'pointer',
                background: i === activeIndex ? '#eff6ff' : '#fff',
                borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '13px', minWidth: '60px' }}>
                {asset.symbol}
              </span>
              <span style={{ color: '#1e293b', fontSize: '13px' }}>{asset.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
