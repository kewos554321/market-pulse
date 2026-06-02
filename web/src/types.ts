export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  created_at: string;
}

export interface Algorithm {
  id: string;
  watchlist_id: string;
  conditions: ConditionTree;
  updated_at: string;
}

export interface Signal {
  id: string;
  watchlist_id: string;
  symbol: string;
  triggered_at: string;
  conditions_snapshot: string;
  close_price: number;
  notified: number;
}

export type ConditionOp = '<' | '>' | '<=' | '>=' | '=';

export interface ConditionLeaf {
  indicator: 'RSI' | 'MA' | 'CLOSE' | 'VOLUME' | 'KD_CROSS' | 'MACD_CROSS';
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
