import { fetchNinetyDays } from '../twse.js';
import { fetchHistoricalData } from '../finmind.js';
import type { DataFetcher, OHLCVData } from './types.js';

export class TwStockFetcher implements DataFetcher {
  constructor(private readonly finmindToken?: string) {}

  async fetchOHLCV(symbol: string, _timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    let ohlcv = await fetchNinetyDays(symbol);
    if (ohlcv.length < 65) {
      const d = new Date();
      d.setMonth(d.getMonth() - 4);
      const startDate = d.toISOString().split('T')[0];
      ohlcv = await fetchHistoricalData(symbol, startDate, this.finmindToken);
    }
    return ohlcv;
  }
}
