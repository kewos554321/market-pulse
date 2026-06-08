import { describe, it, expect } from 'vitest';
import { describeConditionTree } from '../src/notify';

describe('describeConditionTree', () => {
  it('RSI leaf with op and value', () => {
    expect(describeConditionTree({ indicator: 'RSI', op: '<', value: 30 }))
      .toEqual(['RSI(14) < 30']);
  });

  it('CLOSE with MA ref', () => {
    expect(describeConditionTree({ indicator: 'CLOSE', op: '>', ref: 'MA', period: 20 }))
      .toEqual(['收盤 > MA20']);
  });

  it('CLOSE with absolute value', () => {
    expect(describeConditionTree({ indicator: 'CLOSE', op: '>=', value: 150 }))
      .toEqual(['收盤 >= 150']);
  });

  it('MA with period and value', () => {
    expect(describeConditionTree({ indicator: 'MA', period: 5, op: '>', value: 100 }))
      .toEqual(['MA5 > 100']);
  });

  it('MA defaults to period 20', () => {
    expect(describeConditionTree({ indicator: 'MA', op: '>', value: 50 }))
      .toEqual(['MA20 > 50']);
  });

  it('VOLUME with MA_VOLUME ref', () => {
    expect(describeConditionTree({ indicator: 'VOLUME', op: '>', ref: 'MA_VOLUME', multiplier: 2 }))
      .toEqual(['成交量 > 均量×2']);
  });

  it('VOLUME with absolute value', () => {
    expect(describeConditionTree({ indicator: 'VOLUME', op: '>', value: 5000 }))
      .toEqual(['成交量 > 5000']);
  });

  it('MACD_CROSS golden', () => {
    expect(describeConditionTree({ indicator: 'MACD_CROSS', direction: 'golden' }))
      .toEqual(['MACD 黃金交叉']);
  });

  it('MACD_CROSS dead', () => {
    expect(describeConditionTree({ indicator: 'MACD_CROSS', direction: 'dead' }))
      .toEqual(['MACD 死亡交叉']);
  });

  it('KD_CROSS golden', () => {
    expect(describeConditionTree({ indicator: 'KD_CROSS', direction: 'golden' }))
      .toEqual(['KD 黃金交叉']);
  });

  it('KD_CROSS dead', () => {
    expect(describeConditionTree({ indicator: 'KD_CROSS', direction: 'dead' }))
      .toEqual(['KD 死亡交叉']);
  });

  it('MA_CROSS golden', () => {
    expect(describeConditionTree({ indicator: 'MA_CROSS', direction: 'golden' }))
      .toEqual(['MA5/20 黃金交叉']);
  });

  it('MA_CROSS dead', () => {
    expect(describeConditionTree({ indicator: 'MA_CROSS', direction: 'dead' }))
      .toEqual(['MA5/20 死亡交叉']);
  });

  it('BB_LOWER', () => {
    expect(describeConditionTree({ indicator: 'BB_LOWER' }))
      .toEqual(['收盤 ≤ 布林下軌']);
  });

  it('BB_UPPER', () => {
    expect(describeConditionTree({ indicator: 'BB_UPPER' }))
      .toEqual(['收盤 ≥ 布林上軌']);
  });

  it('AND tree flattens all leaf labels', () => {
    expect(describeConditionTree({
      operator: 'AND',
      conditions: [
        { indicator: 'RSI', op: '<', value: 30 },
        { indicator: 'MACD_CROSS', direction: 'golden' },
      ],
    })).toEqual(['RSI(14) < 30', 'MACD 黃金交叉']);
  });

  it('OR tree flattens all leaf labels', () => {
    expect(describeConditionTree({
      operator: 'OR',
      conditions: [
        { indicator: 'KD_CROSS', direction: 'golden' },
        { indicator: 'BB_LOWER' },
      ],
    })).toEqual(['KD 黃金交叉', '收盤 ≤ 布林下軌']);
  });

  it('nested tree flattens recursively', () => {
    expect(describeConditionTree({
      operator: 'AND',
      conditions: [
        { indicator: 'RSI', op: '<', value: 30 },
        {
          operator: 'OR',
          conditions: [
            { indicator: 'MACD_CROSS', direction: 'golden' },
            { indicator: 'BB_LOWER' },
          ],
        },
      ],
    })).toEqual(['RSI(14) < 30', 'MACD 黃金交叉', '收盤 ≤ 布林下軌']);
  });
});
