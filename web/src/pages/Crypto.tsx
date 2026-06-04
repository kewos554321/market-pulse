import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { AssetWatchlist } from '../components/AssetWatchlist';
import { AssetSignals } from '../components/AssetSignals';

const TABS = [
  { to: '/crypto', label: '追蹤清單' },
  { to: '/crypto/signals', label: '訊號歷史' },
];

export function Crypto() {
  return (
    <div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={
          <AssetWatchlist
            assetType="crypto"
            label="幣種"
            description="追蹤主流加密貨幣（每小時掃描）"
          />
        } />
        <Route path="signals" element={<AssetSignals assetType="crypto" />} />
        <Route path="*" element={<Navigate to="/crypto" replace />} />
      </Routes>
    </div>
  );
}
