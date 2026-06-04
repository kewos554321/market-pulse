export interface OHLCVData {
  date: string;   // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DataFetcher {
  fetchOHLCV(symbol: string, timeframe: 'daily' | 'hourly'): Promise<OHLCVData[]>;
}
