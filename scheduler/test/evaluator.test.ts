import { describe, it, expect } from 'vitest';
import { evaluateConditionTree } from '../src/evaluator';
import type { IndicatorValues } from '../src/indicators';

function makeIndicators(overrides: Partial<IndicatorValues> = {}): IndicatorValues {
  return {
    rsi14: [50, 35, 28],           // last = 28
    ma5:   [100, 101, 102],        // last = 102
    ma10:  [98, 99, 100],          // last = 100
    ma20:  [95, 96, 97],           // last = 97
    ma60:  [90, 91, 92],           // last = 92
    macd: [
      { MACD: -1, signal: 0.5, histogram: -1.5 },
      { MACD: 0.5, signal: -0.2, histogram: 0.7 },  // golden: MACD crossed above signal
    ],
    stochastic: [
      { k: 30, d: 35 },  // k < d (bearish)
      { k: 40, d: 38 },  // k > d (crossed up = golden)
    ],
    closes: [95, 97, 99],  // last = 99
    volumes: [1000, 1200, 900],
    ...overrides,
  };
}

describe('evaluateConditionTree - leaf conditions', () => {
  it('RSI < 30 is true when last RSI is 28', () => {
    expect(evaluateConditionTree(
      { indicator: 'RSI', period: 14, op: '<', value: 30 },
      makeIndicators()
    )).toBe(true);
  });

  it('RSI < 30 is false when last RSI is 35', () => {
    expect(evaluateConditionTree(
      { indicator: 'RSI', period: 14, op: '<', value: 30 },
      makeIndicators({ rsi14: [50, 45, 35] })
    )).toBe(false);
  });

  it('RSI > 70 is true when last RSI is 75', () => {
    expect(evaluateConditionTree(
      { indicator: 'RSI', period: 14, op: '>', value: 70 },
      makeIndicators({ rsi14: [50, 65, 75] })
    )).toBe(true);
  });

  it('CLOSE > MA ref:20 is true when close=99 > ma20=97', () => {
    expect(evaluateConditionTree(
      { indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 },
      makeIndicators()
    )).toBe(true);
  });

  it('CLOSE > MA ref:20 is false when close < ma20', () => {
    expect(evaluateConditionTree(
      { indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 },
      makeIndicators({ closes: [95, 97, 96], ma20: [95, 96, 98] })
    )).toBe(false);
  });

  it('CLOSE > value:98 is true when close=99', () => {
    expect(evaluateConditionTree(
      { indicator: 'CLOSE', op: '>', value: 98 },
      makeIndicators()
    )).toBe(true);
  });

  it('MACD_CROSS golden is true when MACD just crossed above signal', () => {
    expect(evaluateConditionTree(
      { indicator: 'MACD_CROSS', direction: 'golden' },
      makeIndicators()
    )).toBe(true);
  });

  it('MACD_CROSS dead is true when MACD just crossed below signal', () => {
    expect(evaluateConditionTree(
      { indicator: 'MACD_CROSS', direction: 'dead' },
      makeIndicators({
        macd: [
          { MACD: 1, signal: -0.5, histogram: 1.5 },
          { MACD: -0.5, signal: 0.2, histogram: -0.7 },
        ],
      })
    )).toBe(true);
  });

  it('KD_CROSS golden is true when K crossed above D', () => {
    expect(evaluateConditionTree(
      { indicator: 'KD_CROSS', direction: 'golden' },
      makeIndicators()
    )).toBe(true);
  });

  it('KD_CROSS golden is false when K was already above D (no new cross)', () => {
    expect(evaluateConditionTree(
      { indicator: 'KD_CROSS', direction: 'golden' },
      makeIndicators({ stochastic: [{ k: 35, d: 30 }, { k: 40, d: 38 }] })
    )).toBe(false);
  });
});

describe('evaluateConditionTree - AND/OR trees', () => {
  it('AND tree is true when all conditions pass', () => {
    expect(evaluateConditionTree(
      {
        operator: 'AND',
        conditions: [
          { indicator: 'RSI', period: 14, op: '<', value: 30 },
          { indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 },
        ],
      },
      makeIndicators()
    )).toBe(true);
  });

  it('AND tree is false when any condition fails', () => {
    expect(evaluateConditionTree(
      {
        operator: 'AND',
        conditions: [
          { indicator: 'RSI', period: 14, op: '<', value: 20 },
          { indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 },
        ],
      },
      makeIndicators()
    )).toBe(false);
  });

  it('OR tree is true when any condition passes', () => {
    expect(evaluateConditionTree(
      {
        operator: 'OR',
        conditions: [
          { indicator: 'RSI', period: 14, op: '<', value: 20 },
          { indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 },
        ],
      },
      makeIndicators()
    )).toBe(true);
  });

  it('OR tree is false when all conditions fail', () => {
    expect(evaluateConditionTree(
      {
        operator: 'OR',
        conditions: [
          { indicator: 'RSI', period: 14, op: '<', value: 20 },
          { indicator: 'CLOSE', op: '>', value: 200 },
        ],
      },
      makeIndicators()
    )).toBe(false);
  });

  it('nested AND inside OR evaluates correctly', () => {
    expect(evaluateConditionTree(
      {
        operator: 'OR',
        conditions: [
          { indicator: 'RSI', period: 14, op: '<', value: 20 },
          {
            operator: 'AND',
            conditions: [
              { indicator: 'RSI', period: 14, op: '<', value: 30 },
              { indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 },
            ],
          },
        ],
      },
      makeIndicators()
    )).toBe(true);
  });
});
