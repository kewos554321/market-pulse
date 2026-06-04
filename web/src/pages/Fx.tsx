import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from '../components/SubTabNav';
import { AssetWatchlist } from '../components/AssetWatchlist';
import { AssetSignals } from '../components/AssetSignals';

const TABS = [
  { to: '/fx', label: '追蹤清單' },
  { to: '/fx/signals', label: '訊號歷史' },
];

export function Fx() {
  return (
    <div>
      <SubTabNav tabs={TABS} />
      <Routes>
        <Route index element={
          <AssetWatchlist
            assetType="fx"
            label="貨幣對"
            description="追蹤各國匯率（USD、EUR、GBP、TWD、JPY、AUD、CHF）"
          />
        } />
        <Route path="signals" element={<AssetSignals assetType="fx" />} />
        <Route path="*" element={<Navigate to="/fx" replace />} />
      </Routes>
    </div>
  );
}
