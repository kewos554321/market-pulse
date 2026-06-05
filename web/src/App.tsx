import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { TwStocks } from './pages/TwStocks';
import { UsStocks } from './pages/UsStocks';
import { Crypto } from './pages/Crypto';
import { Fx } from './pages/Fx';
import { AlgorithmEditor } from './pages/AlgorithmEditor';
import { AlgorithmLibrary } from './pages/AlgorithmLibrary';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
        <nav style={{
          display: 'flex', alignItems: 'center', background: '#fff',
          borderBottom: '1px solid #e2e8f0', padding: '0 24px',
          position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontWeight: 800, color: '#6366f1', fontSize: '15px', marginRight: '32px', padding: '14px 0' }}>
            Market Pulse
          </span>
          {[
            { to: '/', label: '首頁', exact: true },
            { to: '/tw-stocks', label: '台股', exact: false },
            { to: '/us-stocks', label: '美股', exact: false },
            { to: '/crypto', label: '加密貨幣', exact: false },
            { to: '/fx', label: '匯率', exact: false },
            { to: '/settings', label: '設定', exact: false },
            { to: '/algorithm-library', label: '算法庫', exact: false },
          ].map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                padding: '14px 16px',
                fontSize: '13px',
                textDecoration: 'none',
                color: isActive ? '#6366f1' : '#94a3b8',
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'color 0.15s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
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
