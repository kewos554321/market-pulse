import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { CryptoFetcher } from '../src/fetchers/crypto.js';

const mockGet = vi.mocked(axios.get);

describe('CryptoFetcher', () => {
  beforeEach(() => { mockGet.mockReset(); });

  it('maps Binance klines response to OHLCVData', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        ['1704067200000', '42000.0', '43000.0', '41500.0', '42800.0', '1234.5', '1704153599999', '0', '0', '0', '0', '0'],
        ['1704153600000', '42800.0', '44000.0', '42600.0', '43500.0', '987.3', '1704239999999', '0', '0', '0', '0', '0'],
      ],
    });
    const fetcher = new CryptoFetcher();
    const result = await fetcher.fetchOHLCV('BTCUSDT', 'daily');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ open: 42000.0, high: 43000.0, low: 41500.0, close: 42800.0, volume: 1234.5 });
  });

  it('uses 1h interval for hourly timeframe', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const fetcher = new CryptoFetcher();
    await fetcher.fetchOHLCV('ETHUSDT', 'hourly');
    expect(mockGet).toHaveBeenCalledWith(
      'https://api.binance.com/api/v3/klines',
      expect.objectContaining({ params: expect.objectContaining({ interval: '1h' }) })
    );
  });

  it('uses 1d interval for daily timeframe', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const fetcher = new CryptoFetcher();
    await fetcher.fetchOHLCV('BTCUSDT', 'daily');
    expect(mockGet).toHaveBeenCalledWith(
      'https://api.binance.com/api/v3/klines',
      expect.objectContaining({ params: expect.objectContaining({ interval: '1d' }) })
    );
  });

  it('returns empty array on error', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    const fetcher = new CryptoFetcher();
    const result = await fetcher.fetchOHLCV('BTCUSDT', 'hourly');
    expect(result).toHaveLength(0);
  });
});
