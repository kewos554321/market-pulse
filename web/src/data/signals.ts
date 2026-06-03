import type { ConditionLeaf, ConditionTree } from '../types';

export interface SignalParam {
  key: string;
  label: string;
  options: { value: number; label: string }[];
  default: number;
}

export interface SignalDef {
  id: string;
  name: string;
  description: string;
  params: SignalParam[];
  toCondition: (params: Record<string, number>) => ConditionLeaf;
  matchCondition: (leaf: ConditionLeaf) => Record<string, number> | null;
}

const MA_PERIOD_PARAM: SignalParam = {
  key: 'period',
  label: '均線週期',
  options: [
    { value: 5, label: 'MA5' },
    { value: 10, label: 'MA10' },
    { value: 20, label: 'MA20' },
    { value: 60, label: 'MA60' },
  ],
  default: 20,
};

export const SIGNALS: SignalDef[] = [
  {
    id: 'ma-breakout',
    name: '收盤突破均線',
    description: '收盤價向上穿越移動平均線',
    params: [MA_PERIOD_PARAM],
    toCondition: (p) => ({ indicator: 'CLOSE', op: '>', ref: 'MA', period: p.period }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'CLOSE' && leaf.op === '>' && leaf.ref === 'MA' && leaf.period != null)
        return { period: leaf.period };
      return null;
    },
  },
  {
    id: 'ma-breakdown',
    name: '收盤跌破均線',
    description: '收盤價向下穿越移動平均線',
    params: [MA_PERIOD_PARAM],
    toCondition: (p) => ({ indicator: 'CLOSE', op: '<', ref: 'MA', period: p.period }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'CLOSE' && leaf.op === '<' && leaf.ref === 'MA' && leaf.period != null)
        return { period: leaf.period };
      return null;
    },
  },
  {
    id: 'rsi-oversold',
    name: 'RSI 超賣',
    description: 'RSI(14) < 30，可能超跌反彈',
    params: [],
    toCondition: () => ({ indicator: 'RSI', period: 14, op: '<', value: 30 }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'RSI' && leaf.op === '<' && leaf.value === 30) return {};
      return null;
    },
  },
  {
    id: 'rsi-overbought',
    name: 'RSI 超買',
    description: 'RSI(14) > 70，可能過熱回落',
    params: [],
    toCondition: () => ({ indicator: 'RSI', period: 14, op: '>', value: 70 }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'RSI' && leaf.op === '>' && leaf.value === 70) return {};
      return null;
    },
  },
  {
    id: 'kd-golden',
    name: 'KD 黃金交叉',
    description: 'K 線由下往上穿越 D 線，短期買入訊號',
    params: [],
    toCondition: () => ({ indicator: 'KD_CROSS', direction: 'golden' }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'KD_CROSS' && leaf.direction === 'golden') return {};
      return null;
    },
  },
  {
    id: 'kd-dead',
    name: 'KD 死亡交叉',
    description: 'K 線由上往下穿越 D 線，短期賣出訊號',
    params: [],
    toCondition: () => ({ indicator: 'KD_CROSS', direction: 'dead' }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'KD_CROSS' && leaf.direction === 'dead') return {};
      return null;
    },
  },
  {
    id: 'macd-golden',
    name: 'MACD 黃金交叉',
    description: 'MACD 線穿越訊號線向上',
    params: [],
    toCondition: () => ({ indicator: 'MACD_CROSS', direction: 'golden' }),
    matchCondition: (leaf) => {
      if (leaf.indicator === 'MACD_CROSS' && leaf.direction === 'golden') return {};
      return null;
    },
  },
];

export interface SignalSelection {
  signalId: string;
  params: Record<string, number>;
}

export function buildTree(selections: SignalSelection[]): ConditionTree {
  return {
    operator: 'OR',
    conditions: selections.map(({ signalId, params }) => {
      const def = SIGNALS.find((s) => s.id === signalId)!;
      return def.toCondition(params);
    }),
  };
}

export function parsePresets(tree: ConditionTree): SignalSelection[] | null {
  if (tree.operator !== 'OR') return null;
  if (tree.conditions.length === 0) return [];
  const selections: SignalSelection[] = [];
  for (const condition of tree.conditions) {
    if ('operator' in condition) return null;
    let matched = false;
    for (const def of SIGNALS) {
      const params = def.matchCondition(condition);
      if (params !== null) {
        selections.push({ signalId: def.id, params });
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return selections;
}
