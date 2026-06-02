import axios from 'axios';
import { fetchNinetyDays } from './twse.js';
import { fetchHistoricalData } from './finmind.js';
import { calculateIndicators } from './indicators.js';
import { evaluateConditionTree } from './evaluator.js';
import { sendSignalEmail } from './notify.js';
import type { ConditionTree } from './types.js';

const API_URL = process.env.WORKERS_API_URL!;
const API_KEY = process.env.WORKERS_API_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FINMIND_TOKEN = process.env.FINMIND_TOKEN ?? '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'X-API-Key': API_KEY },
});

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  enabled: number;
}

interface AlgorithmResponse {
  conditions: ConditionTree;
}

async function run() {
  const { data: settings } = await api.get<Record<string, string>>('/settings');
  if (settings.schedule_enabled !== '1') {
    console.log('Scheduling disabled via settings. Exiting.');
    return;
  }

  const notifyEmail = settings.notify_email;
  if (!notifyEmail) {
    console.log('No notify_email configured. Exiting.');
    return;
  }

  const { data: watchlist } = await api.get<WatchlistItem[]>('/watchlist');
  const enabled = watchlist.filter((w) => w.enabled === 1);
  console.log(`Processing ${enabled.length} items...`);

  const triggeredSignals: {
    watchlist_id: string;
    symbol: string;
    close_price: number;
    conditions_snapshot: unknown;
    name: string;
  }[] = [];

  for (const item of enabled) {
    try {
      const { data: algo } = await api.get<AlgorithmResponse>(`/watchlist/${item.id}/algorithm`);
      if (!algo.conditions?.conditions?.length) {
        console.log(`${item.symbol}: no conditions set, skipping`);
        continue;
      }

      let ohlcv = await fetchNinetyDays(item.symbol);

      if (ohlcv.length < 65) {
        console.log(`${item.symbol}: insufficient data (${ohlcv.length}), trying FinMind...`);
        const d = new Date();
        d.setMonth(d.getMonth() - 4);
        const startDate = d.toISOString().split('T')[0];
        ohlcv = await fetchHistoricalData(item.symbol, startDate, FINMIND_TOKEN || undefined);
      }

      if (ohlcv.length < 30) {
        console.log(`${item.symbol}: still insufficient data (${ohlcv.length}), skipping`);
        continue;
      }

      const indicators = calculateIndicators(ohlcv);
      const triggered = evaluateConditionTree(algo.conditions, indicators);

      if (triggered) {
        const closePrice = ohlcv[ohlcv.length - 1].close;
        console.log(`✅ ${item.symbol} ${item.name}: triggered (close=${closePrice})`);
        triggeredSignals.push({
          watchlist_id: item.id,
          symbol: item.symbol,
          close_price: closePrice,
          conditions_snapshot: algo.conditions,
          name: item.name,
        });
      } else {
        console.log(`⬜ ${item.symbol}: conditions not met`);
      }
    } catch (err) {
      console.error(`Error processing ${item.symbol}:`, err);
    }
  }

  if (!triggeredSignals.length) {
    console.log('No signals today.');
    return;
  }

  await api.post('/signals', {
    signals: triggeredSignals.map(({ name: _n, ...s }) => s),
  });

  const today = new Date().toISOString().split('T')[0];
  await sendSignalEmail(
    RESEND_API_KEY,
    notifyEmail,
    today,
    triggeredSignals.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      closePrice: s.close_price,
      triggeredConditions: ['條件符合'],
    }))
  );

  console.log(`✉️  Sent email to ${notifyEmail} with ${triggeredSignals.length} signals`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
