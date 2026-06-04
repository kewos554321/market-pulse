import axios, { type AxiosInstance } from 'axios';
import type { DataFetcher, OHLCVData } from './types.js';

const TRACKED_CURRENCIES = ['EUR', 'GBP', 'TWD', 'JPY', 'AUD', 'CHF'];

export function computeCrossRate(rates: Record<string, number>, base: string, quote: string): number {
  if (base === 'USD') return rates[quote] ?? 0;
  if (quote === 'USD') return rates[base] ? 1 / rates[base] : 0;
  return rates[base] ? (rates[quote] ?? 0) / rates[base] : 0;
}

export function rateRowsToOHLCV(
  rows: { date: string; rates_json: string }[],
  base: string,
  quote: string
): OHLCVData[] {
  return rows
    .map((row) => {
      const rates = JSON.parse(row.rates_json) as Record<string, number>;
      const rate = computeCrossRate(rates, base, quote);
      if (!rate) return null;
      return { date: row.date, open: rate, high: rate, low: rate, close: rate, volume: 0 };
    })
    .filter((r): r is OHLCVData => r !== null);
}

export class FxFetcher implements DataFetcher {
  constructor(
    private readonly apiKey: string,
    private readonly internalApi: AxiosInstance,
  ) {}

  async fetchOHLCV(symbol: string, _timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]> {
    const [base, quote] = symbol.split('/');
    if (!base || !quote) return [];
    try {
      await this.ensureTodayStored();
      const { data: rows } = await this.internalApi.get<{ date: string; rates_json: string }[]>(
        '/fx-daily',
        { params: { limit: 90 } }
      );
      return rateRowsToOHLCV(rows, base, quote);
    } catch {
      return [];
    }
  }

  private async ensureTodayStored(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await axios.get(
        `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest/USD`,
        { timeout: 10000 }
      );
      if (data.result !== 'success') return;

      const rates: Record<string, number> = {};
      for (const currency of TRACKED_CURRENCIES) {
        if (data.conversion_rates[currency]) {
          rates[currency] = data.conversion_rates[currency];
        }
      }

      await this.internalApi.post('/fx-daily', {
        date: today,
        rates_json: JSON.stringify(rates),
      });
    } catch {
      // If today already stored or API down, continue with existing data
    }
  }
}
