import { describe, it, expect } from 'vitest';
import { calculateIndicators } from '../src/indicators';
import type { OHLCVData } from '../src/twse';

function makeData(closes: number[]): OHLCVData[] {
  return closes.map((c, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    open: c - 1,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: 1000 + i * 10,
  }));
}

describe('calculateIndicators', () => {
  const data = makeData([
    90, 91, 89, 92, 93, 91, 94, 96, 95, 97,
    98, 96, 99, 100, 98, 101, 103, 102, 104, 105,
    103, 106, 108, 107, 109, 110, 108, 111, 113, 112,
    114, 115, 113, 116, 118, 117, 119, 120, 118, 121,
    123, 122, 124, 125, 123, 126, 128, 127, 129, 130,
    128, 131, 133, 132, 134, 135, 133, 136, 138, 137,
    139, 140, 138, 141, 143, 142, 144, 145, 143, 146,
  ]); // 70 data points — enough for MA60 + MACD

  it('returns rsi14 array of correct length', () => {
    const result = calculateIndicators(data);
    expect(result.rsi14.length).toBe(data.length - 14);
  });

  it('returns ma20 array of correct length', () => {
    const result = calculateIndicators(data);
    expect(result.ma20.length).toBe(data.length - 20 + 1);
  });

  it('returns ma60 array', () => {
    const result = calculateIndicators(data);
    expect(result.ma60.length).toBeGreaterThan(0);
  });

  it('rsi14 values are between 0 and 100', () => {
    const result = calculateIndicators(data);
    result.rsi14.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('returns closes matching input', () => {
    const result = calculateIndicators(data);
    expect(result.closes).toEqual(data.map((d) => d.close));
  });
});
