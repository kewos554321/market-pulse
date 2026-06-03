export type ConditionOp = '<' | '>' | '<=' | '>=' | '=';

export interface ConditionLeaf {
  indicator: 'RSI' | 'MA' | 'CLOSE' | 'VOLUME' | 'KD_CROSS' | 'MACD_CROSS' | 'MA_CROSS';
  period?: number;
  op?: ConditionOp;
  value?: number;
  ref?: string;
  multiplier?: number;
  direction?: 'golden' | 'dead';
}

export interface ConditionTree {
  operator: 'AND' | 'OR';
  conditions: (ConditionLeaf | ConditionTree)[];
}
