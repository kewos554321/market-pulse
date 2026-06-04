import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { Watchlist } from './Watchlist';
import { AssetSignals } from '../components/AssetSignals';
import { Recommendations } from './Recommendations';

const TABS = [
  { to: '/tw-stocks', label: '追蹤清單' },
  { to: '/tw-stocks/recommendations', label: '推薦' },
  { to: '/tw-stocks/signals', label: '訊號歷史' },
];

export function TwStocks() {
  return (
    <div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={<Watchlist />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="signals" element={<AssetSignals assetType="tw_stock" />} />
        <Route path="*" element={<Navigate to="/tw-stocks" replace />} />
      </Routes>
    </div>
  );
}
