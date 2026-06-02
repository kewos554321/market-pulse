import type { IndicatorValues } from './indicators.js';
import type { ConditionLeaf, ConditionTree } from './types.js';

export type Condition = ConditionLeaf | ConditionTree;

function isTree(c: Condition): c is ConditionTree {
  return 'operator' in c;
}

function lastOf(arr: number[]): number {
  return arr[arr.length - 1] ?? 0;
}

function compare(a: number, op: string, b: number): boolean {
  switch (op) {
    case '<':  return a < b;
    case '>':  return a > b;
    case '<=': return a <= b;
    case '>=': return a >= b;
    case '=':  return a === b;
    default:   return false;
  }
}

function getMaArray(period: number, indicators: IndicatorValues): number[] {
  switch (period) {
    case 5:  return indicators.ma5;
    case 10: return indicators.ma10;
    case 20: return indicators.ma20;
    case 60: return indicators.ma60;
    default: return indicators.ma20;
  }
}

function evaluateLeaf(c: ConditionLeaf, indicators: IndicatorValues): boolean {
  switch (c.indicator) {
    case 'RSI': {
      const val = lastOf(indicators.rsi14);
      return compare(val, c.op!, c.value!);
    }

    case 'CLOSE': {
      const close = lastOf(indicators.closes);
      if (c.ref === 'MA') {
        const ma = lastOf(getMaArray(c.period ?? 20, indicators));
        return compare(close, c.op!, ma);
      }
      return compare(close, c.op!, c.value!);
    }

    case 'MA': {
      const ma = lastOf(getMaArray(c.period ?? 20, indicators));
      return compare(ma, c.op!, c.value!);
    }

    case 'VOLUME': {
      const vol = lastOf(indicators.volumes);
      if (c.ref === 'MA_VOLUME') {
        const recentVols = indicators.volumes.slice(-(c.period ?? 5));
        const avgVol = recentVols.reduce((s, v) => s + v, 0) / recentVols.length;
        return compare(vol, c.op!, avgVol * (c.multiplier ?? 1));
      }
      return compare(vol, c.op!, c.value!);
    }

    case 'MACD_CROSS': {
      const macd = indicators.macd;
      if (macd.length < 2) return false;
      const prev = macd[macd.length - 2];
      const curr = macd[macd.length - 1];
      if (c.direction === 'golden') {
        return prev.MACD <= prev.signal && curr.MACD > curr.signal;
      }
      return prev.MACD >= prev.signal && curr.MACD < curr.signal;
    }

    case 'KD_CROSS': {
      const stoch = indicators.stochastic;
      if (stoch.length < 2) return false;
      const prev = stoch[stoch.length - 2];
      const curr = stoch[stoch.length - 1];
      if (c.direction === 'golden') {
        return prev.k <= prev.d && curr.k > curr.d;
      }
      return prev.k >= prev.d && curr.k < curr.d;
    }

    default:
      return false;
  }
}

export function evaluateConditionTree(condition: Condition, indicators: IndicatorValues): boolean {
  if (isTree(condition)) {
    if (condition.operator === 'AND') {
      return condition.conditions.every((c) => evaluateConditionTree(c, indicators));
    }
    return condition.conditions.some((c) => evaluateConditionTree(c, indicators));
  }
  return evaluateLeaf(condition, indicators);
}
