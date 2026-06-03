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
  indicator: 'RSI' | 'MA' | 'CLOSE' | 'VOLUME' | 'KD_CROSS' | 'MACD_CROSS' | 'MA_CROSS' | 'BB_LOWER' | 'BB_UPPER';
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

export interface RecommendationStock {
  symbol: string;
  name: string;
  is_default: number;
}

export interface Recommendation {
  id: number;
  date: string;
  symbol: string;
  name: string;
  close_price: number;
  strategies: string[];
}

export interface RecommendationsResponse {
  date: string | null;
  items: Recommendation[];
}
