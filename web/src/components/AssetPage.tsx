import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from './SubTabNav';
import { AssetSignals } from './AssetSignals';
import { Watchlist } from './Watchlist';
import type { AssetType } from '../types';

interface Props {
  assetType: AssetType;
  basePath: string;
  label: string;
  description: string;
}

export function AssetPage({ assetType, basePath, label, description }: Props) {
  const tabs = [
    { to: basePath, label: '追蹤清單' },
    { to: `${basePath}/signals`, label: '訊號歷史' },
  ];

  return (
    <div>
      <SubTabNav tabs={tabs} />
      <Routes>
        <Route
          index
          element={<Watchlist assetType={assetType} label={label} description={description} />}
        />
        <Route path="signals" element={<AssetSignals assetType={assetType} />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </div>
  );
}
