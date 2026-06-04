import axios from 'axios';
import type { DataFetcher, OHLCVData } from './types.js';

export class UsStockFetcher implements DataFetcher {
  constructor(private readonly apiKey: string) {}

  async fetchOHLCV(symbol: string, timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    const resolution = timeframe === 'hourly' ? '60' : 'D';
    const to = Math.floor(Date.now() / 1000);
    const from = to - (timeframe === 'hourly' ? 7 * 24 * 3600 : 120 * 24 * 3600);

    try {
      const { data } = await axios.get('https://finnhub.io/api/v1/stock/candle', {
        params: { symbol, resolution, from, to, token: this.apiKey },
        timeout: 15000,
      });

      if (data.s !== 'ok' || !Array.isArray(data.c)) return [];

      return (data.t as number[]).map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i],
      }));
    } catch {
      return [];
    }
  }
}
