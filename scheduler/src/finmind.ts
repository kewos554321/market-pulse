import axios from 'axios';
import type { OHLCVData } from './twse.js';

interface FinMindRow {
  date: string;
  open: number;
  max: number;
  min: number;
  close: number;
  Trading_Volume: number;
}

interface FinMindResponse {
  status: number;
  data: FinMindRow[];
}

export async function fetchHistoricalData(
  symbol: string,
  startDate: string,  // YYYY-MM-DD
  token?: string
): Promise<OHLCVData[]> {
  const params: Record<string, string> = {
    dataset: 'TaiwanStockPrice',
    data_id: symbol,
    start_date: startDate,
  };
  if (token) params.token = token;

  const { data } = await axios.get<FinMindResponse>(
    'https://api.finmindtrade.com/api/v4/data',
    { params, timeout: 15000 }
  );

  if (data.status !== 200 || !Array.isArray(data.data)) return [];

  return data.data.map((row) => ({
    date: row.date,
    open: row.open,
    high: row.max,
    low: row.min,
    close: row.close,
    volume: row.Trading_Volume,
  }));
}
