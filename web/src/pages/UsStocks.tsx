import { AssetPage } from '../components/AssetPage';

export function UsStocks() {
  return (
    <AssetPage
      assetType="us_stock"
      basePath="/us-stocks"
      label="美股"
      description="管理你想追蹤的美國股票（S&P 500）"
    />
  );
}
