import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { WatchlistNew } from './WatchlistNew';
import { AssetSignals } from '../components/AssetSignals';
import { Recommendations } from './Recommendations';

const TABS = [
  { to: '/tw-stocks-new', label: '追蹤清單' },
  { to: '/tw-stocks-new/recommendations', label: '推薦' },
  { to: '/tw-stocks-new/signals', label: '訊號歷史' },
];

export function TwStocksNew() {
  return (
    <div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={<WatchlistNew />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="signals" element={<AssetSignals assetType="tw_stock" />} />
        <Route path="*" element={<Navigate to="/tw-stocks-new" replace />} />
      </Routes>
    </div>
  );
}
