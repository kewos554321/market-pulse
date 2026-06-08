import { AssetPage } from '../components/AssetPage';
import { AssetWatchlist } from '../components/AssetWatchlist';

export function Crypto() {
  return (
    <AssetPage
      assetType="crypto"
      basePath="/crypto"
      label="幣種"
      description="追蹤主流加密貨幣（每小時掃描）"
      WatchlistComponent={AssetWatchlist}
    />
  );
}
