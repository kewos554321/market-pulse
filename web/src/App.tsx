import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { TwStocks } from './pages/TwStocks';
import { TwStocksNew } from './pages/TwStocksNew';
import { UsStocks } from './pages/UsStocks';
import { Crypto } from './pages/Crypto';
import { Fx } from './pages/Fx';
import { AlgorithmEditor } from './pages/AlgorithmEditor';
import { AlgorithmLibrary } from './pages/AlgorithmLibrary';
import { Settings } from './pages/Settings';
import { Recommendations } from './pages/Recommendations';
import { cn } from '@/lib/utils';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background font-sans">
        <nav className="flex items-center bg-card border-b border-border px-6 sticky top-0 z-[100] shadow-xs">
          <span className="font-extrabold text-primary text-[15px] mr-8 py-3.5">
            Market Pulse
          </span>
          {[
            { to: '/', label: '首頁', exact: true },
            { to: '/tw-stocks', label: '台股', exact: false },
            { to: '/tw-stocks-new', label: '台股(新)', exact: false },
            { to: '/us-stocks', label: '美股', exact: false },
            { to: '/crypto', label: '加密貨幣', exact: false },
            { to: '/fx', label: '匯率', exact: false },
            { to: '/recommendations', label: '推薦', exact: false },
            { to: '/settings', label: '設定', exact: false },
            { to: '/algorithm-library', label: '算法庫', exact: false },
          ].map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'py-3.5 px-4 text-[13px] no-underline transition-colors border-b-2',
                  isActive
                    ? 'text-primary font-semibold border-primary'
                    : 'text-muted-foreground font-normal border-transparent'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="max-w-[900px] mx-auto px-6 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tw-stocks/*" element={<TwStocks />} />
            <Route path="/tw-stocks-new/*" element={<TwStocksNew />} />
            <Route path="/us-stocks/*" element={<UsStocks />} />
            <Route path="/crypto/*" element={<Crypto />} />
            <Route path="/fx/*" element={<Fx />} />
            <Route path="/watchlist/:id/algorithm" element={<AlgorithmEditor />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/algorithm-library" element={<AlgorithmLibrary />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
