import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home } from './pages/Home';
import { Watchlist } from './pages/Watchlist';
import { AlgorithmEditor } from './pages/AlgorithmEditor';
import { Signals } from './pages/Signals';
import { Settings } from './pages/Settings';

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  fontWeight: isActive ? 'bold' : 'normal',
  textDecoration: 'none',
  color: isActive ? '#0070f3' : '#333',
});

export function App() {
  return (
    <BrowserRouter>
      <nav style={{ display: 'flex', gap: '1.5rem', padding: '1rem 1.5rem', borderBottom: '1px solid #eee', marginBottom: '1.5rem' }}>
        <NavLink to="/" style={navLinkStyle}>首頁</NavLink>
        <NavLink to="/watchlist" style={navLinkStyle}>追蹤清單</NavLink>
        <NavLink to="/signals" style={navLinkStyle}>訊號歷史</NavLink>
        <NavLink to="/settings" style={navLinkStyle}>設定</NavLink>
      </nav>
      <main style={{ padding: '0 1.5rem', maxWidth: '900px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/watchlist/:id/algorithm" element={<AlgorithmEditor />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
