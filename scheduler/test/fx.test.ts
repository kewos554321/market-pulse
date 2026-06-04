import { describe, it, expect } from 'vitest';
import { computeCrossRate, rateRowsToOHLCV } from '../src/fetchers/fx.js';

describe('computeCrossRate', () => {
  const rates = { EUR: 0.92, GBP: 0.79, TWD: 32.1, JPY: 149.5, AUD: 1.53, CHF: 0.88 };

  it('USD/TWD = direct rate', () => {
    expect(computeCrossRate(rates, 'USD', 'TWD')).toBeCloseTo(32.1);
  });

  it('TWD/USD = inverse', () => {
    expect(computeCrossRate(rates, 'TWD', 'USD')).toBeCloseTo(1 / 32.1);
  });

  it('EUR/TWD = TWD_rate / EUR_rate', () => {
    expect(computeCrossRate(rates, 'EUR', 'TWD')).toBeCloseTo(32.1 / 0.92);
  });

  it('JPY/TWD = TWD_rate / JPY_rate', () => {
    expect(computeCrossRate(rates, 'JPY', 'TWD')).toBeCloseTo(32.1 / 149.5);
  });
});

describe('rateRowsToOHLCV', () => {
  it('converts fx_daily rows to OHLCVData for a pair', () => {
    const rows = [
      { date: '2026-01-01', rates_json: JSON.stringify({ EUR: 0.92, TWD: 32.1 }) },
      { date: '2026-01-02', rates_json: JSON.stringify({ EUR: 0.93, TWD: 32.3 }) },
    ];
    const result = rateRowsToOHLCV(rows, 'USD', 'TWD');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ date: '2026-01-01', open: 32.1, high: 32.1, low: 32.1, close: 32.1, volume: 0 });
    expect(result[1].close).toBeCloseTo(32.3);
  });

  it('filters out rows where rate cannot be computed (missing currency)', () => {
    const rows = [
      { date: '2026-01-01', rates_json: JSON.stringify({ EUR: 0.92 }) },
    ];
    const result = rateRowsToOHLCV(rows, 'USD', 'TWD');
    expect(result).toHaveLength(0);
  });
});
