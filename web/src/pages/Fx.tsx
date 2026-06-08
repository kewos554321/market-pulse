import { AssetPage } from '../components/AssetPage';

export function Fx() {
  return (
    <AssetPage
      assetType="fx"
      basePath="/fx"
      label="貨幣對"
      description="追蹤各國匯率（USD、EUR、GBP、TWD、JPY、AUD、CHF）"
    />
  );
}
