import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { TwStocks } from './pages/TwStocks';
import { UsStocks } from './pages/UsStocks';
import { Crypto } from './pages/Crypto';
import { Fx } from './pages/Fx';
import { AlgorithmEditor } from './pages/AlgorithmEditor';
import { AlgorithmLibrary } from './pages/AlgorithmLibrary';
import { Settings } from './pages/Settings';
import { cn } from '@/lib/utils';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background font-sans">
        <nav className="flex items-center bg-card border-b border-border px-6 sticky top-0 z-[100] shadow-xs">
          <Link to="/" className="font-extrabold text-primary text-[15px] mr-8 py-3.5 no-underline">
            Market Pulse
          </Link>
          {[
            { to: '/tw-stocks', label: '台股' },
            { to: '/us-stocks', label: '美股' },
            { to: '/crypto', label: '加密貨幣' },
            { to: '/fx', label: '匯率' },
            { to: '/settings', label: '設定' },
            { to: '/algorithm-library', label: '算法庫' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
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
            <Route path="/us-stocks/*" element={<UsStocks />} />
            <Route path="/crypto/*" element={<Crypto />} />
            <Route path="/fx/*" element={<Fx />} />
            <Route path="/watchlist/:id/algorithm" element={<AlgorithmEditor />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/algorithm-library" element={<AlgorithmLibrary />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
