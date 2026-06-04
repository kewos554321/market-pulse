import axios from 'axios';
import type { DataFetcher, OHLCVData } from './types.js';

export class CryptoFetcher implements DataFetcher {
  async fetchOHLCV(symbol: string, timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    const interval = timeframe === 'hourly' ? '1h' : '1d';
    const limit = timeframe === 'hourly' ? 168 : 120;

    try {
      const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit },
        timeout: 15000,
      });

      return (data as string[][]).map((k) => ({
        date: new Date(Number(k[0])).toISOString().split('T')[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch {
      return [];
    }
  }
}
