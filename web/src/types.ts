export type AssetType = 'tw_stock' | 'us_stock' | 'crypto' | 'fx';

export interface AlgorithmTemplate {
  id: string;
  name: string;
  conditions: ConditionTree;
  updated_at: string;
}

export interface AlgorithmState {
  source: 'template' | 'custom';
  templateId?: string;
  templateName?: string | null;
  conditions: ConditionTree;
}

export interface Group {
  id: string;
  name: string;
  count?: number;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
  asset_type?: string;
  created_at: string;
  groups: Group[];
  algorithm_template_id: string | null;
  algorithmTemplate: { id: string; name: string } | null;
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
