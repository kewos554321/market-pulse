import axios from 'axios';

export interface OHLCVData {
  date: string;   // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TWSEResponse {
  stat: string;
  data: string[][];
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
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${symbol}`;

  const { data } = await axios.get<TWSEResponse>(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (data.stat !== 'OK' || !Array.isArray(data.data)) return [];

  // row: [date, volume, amount, open, high, low, close, change, trades]
  return data.data
    .filter((row) => row[6] && row[6] !== '--')
    .map((row) => ({
      date: rocToIso(row[0]),
      open: parseNumber(row[3]),
      high: parseNumber(row[4]),
      low: parseNumber(row[5]),
      close: parseNumber(row[6]),
      volume: parseNumber(row[1]),
    }));
}

export async function fetchNinetyDays(symbol: string): Promise<OHLCVData[]> {
  const now = new Date();
  const months: { year: number; month: number }[] = [];

  for (let i = 3; i >= 0; i--) {
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
