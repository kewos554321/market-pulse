import { AssetPage } from '../components/AssetPage';
import { Watchlist } from './Watchlist';

export function TwStocks() {
  return (
    <AssetPage
      assetType="tw_stock"
      basePath="/tw-stocks"
      label="台股"
      description="管理你想追蹤的股票"
      WatchlistComponent={Watchlist}
    />
  );
}
