import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { UsStockFetcher } from '../src/fetchers/us-stock.js';

const mockGet = vi.mocked(axios.get);

describe('UsStockFetcher', () => {
  beforeEach(() => mockGet.mockReset());

  it('maps Finnhub candle response to OHLCVData', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        s: 'ok',
        t: [1704067200, 1704153600],
        o: [180.0, 183.0],
        h: [185.0, 186.0],
        l: [178.0, 181.0],
        c: [183.5, 185.2],
        v: [50000000, 45000000],
      },
    });
    const fetcher = new UsStockFetcher('test-key');
    const result = await fetcher.fetchOHLCV('AAPL', 'daily');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ open: 180.0, high: 185.0, low: 178.0, close: 183.5, volume: 50000000 });
  });

  it('returns empty array when Finnhub returns no_data', async () => {
    mockGet.mockResolvedValueOnce({ data: { s: 'no_data' } });
    const fetcher = new UsStockFetcher('test-key');
    const result = await fetcher.fetchOHLCV('INVALID', 'daily');
    expect(result).toHaveLength(0);
  });

  it('returns empty array on API error', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const fetcher = new UsStockFetcher('test-key');
    const result = await fetcher.fetchOHLCV('AAPL', 'daily');
    expect(result).toHaveLength(0);
  });
});
