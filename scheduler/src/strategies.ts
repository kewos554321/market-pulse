import type { ConditionTree } from './types.js';

export const BUILT_IN_STRATEGIES: Array<{ name: string; conditions: ConditionTree }> = [
  {
    name: '黃金交叉',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'MA_CROSS', direction: 'golden' }],
    },
  },
  {
    name: 'RSI超賣反彈',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'RSI', op: '<', value: 30 }],
    },
  },
  {
    name: 'MACD翻多',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'MACD_CROSS', direction: 'golden' }],
    },
  },
  {
    name: 'KD黃金交叉',
    conditions: {
      operator: 'AND',
      conditions: [{ indicator: 'KD_CROSS', direction: 'golden' }],
    },
  },
];
