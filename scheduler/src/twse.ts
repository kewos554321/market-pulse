import axios from 'axios';

export interface OHLCVData {
  date: string;   // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TWSERow {
  Date: string;          // "115/06/01" (ROC calendar)
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  TradeVolume: string;
}

function rocToIso(rocDate: string): string {
  const [y, m, d] = rocDate.split('/');
  return `${Number(y) + 1911}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseNumber(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

export async function fetchMonthlyData(symbol: string, year: number, month: number): Promise<OHLCVData[]> {
  const dateStr = `${year}${String(month).padStart(2, '0')}01`;
  const url = `https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY?stockNo=${symbol}&date=${dateStr}`;

  const { data } = await axios.get<TWSERow[]>(url, { timeout: 10000 });
  if (!Array.isArray(data)) return [];

  return data
    .filter((row) => row.ClosingPrice && row.ClosingPrice !== '--')
    .map((row) => ({
      date: rocToIso(row.Date),
      open: parseNumber(row.OpeningPrice),
      high: parseNumber(row.HighestPrice),
      low: parseNumber(row.LowestPrice),
      close: parseNumber(row.ClosingPrice),
      volume: parseNumber(row.TradeVolume),
    }));
}

export async function fetchNinetyDays(symbol: string): Promise<OHLCVData[]> {
  const now = new Date();
  const months: { year: number; month: number }[] = [];

  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const results = await Promise.all(months.map((m) => fetchMonthlyData(symbol, m.year, m.month)));
  const all = results.flat().sort((a, b) => a.date.localeCompare(b.date));

  // deduplicate by date
  const seen = new Set<string>();
  return all.filter((row) => {
    if (seen.has(row.date)) return false;
    seen.add(row.date);
    return true;
  });
}
