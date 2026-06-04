import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { AssetWatchlist } from '../components/AssetWatchlist';
import { AssetSignals } from '../components/AssetSignals';

const TABS = [
  { to: '/us-stocks', label: '追蹤清單' },
  { to: '/us-stocks/signals', label: '訊號歷史' },
];

export function UsStocks() {
  return (
    <div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={
          <AssetWatchlist
            assetType="us_stock"
            label="美股"
            description="管理你想追蹤的美國股票（S&P 500）"
          />
        } />
        <Route path="signals" element={<AssetSignals assetType="us_stock" />} />
        <Route path="*" element={<Navigate to="/us-stocks" replace />} />
      </Routes>
    </div>
  );
}
