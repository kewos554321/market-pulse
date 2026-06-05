export interface Env {
  DB: D1Database;
  API_KEY: string;
}

export interface WatchlistRow {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type: string;
  algorithm_template_id: string | null;
  created_at: string;
}

export interface FxDailyRow {
  id: string;
  date: string;
  rates_json: string;
  created_at: string;
}

export interface AlgorithmRow {
  id: string;
  watchlist_id: string;
  conditions: string;
  updated_at: string;
}

export interface AlgorithmTemplateRow {
  id: string;
  name: string;
  conditions: string;
  created_at: string;
  updated_at: string;
}

export interface SignalRow {
  id: string;
  watchlist_id: string;
  symbol: string;
  triggered_at: string;
  conditions_snapshot: string;
  close_price: number;
  notified: number;
}

export type ConditionOp = '<' | '>' | '<=' | '>=' | '=';
export type IndicatorName = 'RSI' | 'MA' | 'CLOSE' | 'VOLUME' | 'KD_CROSS' | 'MACD_CROSS' | 'MA_CROSS';

export interface ConditionLeaf {
  indicator: IndicatorName;
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

export interface RecommendationStockRow {
  symbol: string;
  name: string;
  is_default: number;
}

export interface RecommendationRow {
  id: number;
  date: string;
  symbol: string;
  name: string;
  close_price: number;
  strategies: string;
  created_at: string;
}

export interface EmailRecipientRow {
  id: string;
  email: string;
  label: string | null;
  created_at: string;
}
