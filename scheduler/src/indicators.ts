import {
  RSI,
  SMA,
  MACD,
  Stochastic,
} from 'technicalindicators';
import type { OHLCVData } from './twse.js';

export interface IndicatorValues {
  rsi14: number[];
  ma5: number[];
  ma10: number[];
  ma20: number[];
  ma60: number[];
  macd: Array<{ MACD: number; signal: number; histogram: number }>;
  stochastic: Array<{ k: number; d: number }>;
  closes: number[];
  volumes: number[];
}

export function calculateIndicators(data: OHLCVData[]): IndicatorValues {
  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);

  const rawMacd = MACD.calculate({
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    values: closes,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const rawStoch = Stochastic.calculate({
    period: 9,
    signalPeriod: 3,
    low: lows,
    high: highs,
    close: closes,
  });

  return {
    rsi14: RSI.calculate({ period: 14, values: closes }),
    ma5: SMA.calculate({ period: 5, values: closes }),
    ma10: SMA.calculate({ period: 10, values: closes }),
    ma20: SMA.calculate({ period: 20, values: closes }),
    ma60: SMA.calculate({ period: 60, values: closes }),
    macd: rawMacd.map((m) => ({
      MACD: m.MACD ?? 0,
      signal: m.signal ?? 0,
      histogram: m.histogram ?? 0,
    })),
    stochastic: rawStoch.map((s) => ({ k: s.k, d: s.d })),
    closes,
    volumes,
  };
}
