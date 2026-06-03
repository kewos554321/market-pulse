import { useState, useRef, useEffect } from 'react';
import stocksData from '../data/stocks.json';

interface Stock {
  symbol: string;
  name: string;
}

interface Props {
  onSelect: (symbol: string, name: string) => void;
}

const stocks: Stock[] = stocksData as Stock[];

function filterStocks(query: string): Stock[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return stocks
    .filter((s) => s.symbol.startsWith(q) || s.name.includes(q))
    .slice(0, 8);
}

export function StockSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stock[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResults(filterStocks(query));
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(stock: Stock) {
    onSelect(stock.symbol, stock.name);
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
          placeholder="輸入代號或名稱（如 2330 或 台積）"
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
          {results.map((stock, i) => (
            <div
              key={stock.symbol}
              onMouseDown={() => handleSelect(stock)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '10px 12px', display: 'flex', alignItems: 'center',
                gap: '12px', cursor: 'pointer',
                background: i === activeIndex ? '#eff6ff' : '#fff',
                borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '13px', minWidth: '36px' }}>
                {stock.symbol}
              </span>
              <span style={{ color: '#1e293b', fontSize: '13px' }}>{stock.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
