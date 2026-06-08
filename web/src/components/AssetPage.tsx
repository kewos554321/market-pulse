import { Routes, Route, Navigate } from 'react-router-dom';
import { SubTabNav } from './SubTabNav';
import { AssetSignals } from './AssetSignals';
import type { AssetType } from '../types';

interface WatchlistProps {
  assetType: AssetType;
  label: string;
  description: string;
}

interface Props {
  assetType: AssetType;
  basePath: string;
  label: string;
  description: string;
  WatchlistComponent: React.ComponentType<WatchlistProps>;
}

export function AssetPage({ assetType, basePath, label, description, WatchlistComponent }: Props) {
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
          element={<WatchlistComponent assetType={assetType} label={label} description={description} />}
        />
        <Route path="signals" element={<AssetSignals assetType={assetType} />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </div>
  );
}
