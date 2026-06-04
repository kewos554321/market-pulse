import axios from 'axios';
import { fetchNinetyDays } from './twse.js';
import { fetchHistoricalData } from './finmind.js';
import { calculateIndicators } from './indicators.js';
import { evaluateConditionTree } from './evaluator.js';
import { sendSignalEmail } from './notify.js';
import { sendLineGroupMessage } from './line.js';
import { BUILT_IN_STRATEGIES } from './strategies.js';
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

async function fetchOhlcv(symbol: string) {
  let ohlcv = await fetchNinetyDays(symbol);
  if (ohlcv.length < 65) {
    const d = new Date();
    d.setMonth(d.getMonth() - 4);
    const startDate = d.toISOString().split('T')[0];
    ohlcv = await fetchHistoricalData(symbol, startDate, FINMIND_TOKEN || undefined);
  }
  return ohlcv;
}

async function runRecommendationScan(today: string) {
  const { data: stockPool } = await api.get<{ symbol: string; name: string }[]>(
    '/recommendation-stocks'
  );
  console.log(`Scanning ${stockPool.length} recommendation stocks...`);

  const hits: {
    symbol: string;
    name: string;
    close_price: number;
    strategies: string[];
  }[] = [];

  for (const stock of stockPool) {
    try {
      const ohlcv = await fetchOhlcv(stock.symbol);
      if (ohlcv.length < 30) {
        console.log(`${stock.symbol}: insufficient data, skipping`);
        continue;
      }
      const indicators = calculateIndicators(ohlcv);
      const triggered = BUILT_IN_STRATEGIES
        .filter((s) => evaluateConditionTree(s.conditions, indicators))
        .map((s) => s.name);

      if (triggered.length > 0) {
        const closePrice = ohlcv[ohlcv.length - 1].close;
        console.log(`✅ ${stock.symbol} ${stock.name}: ${triggered.join(', ')}`);
        hits.push({ symbol: stock.symbol, name: stock.name, close_price: closePrice, strategies: triggered });
      }
    } catch (err) {
      console.error(`Recommendation scan error for ${stock.symbol}:`, err);
    }
  }

  await api.post('/recommendations', { date: today, items: hits });
  console.log(`📊 Wrote ${hits.length} recommendations for ${today}`);
}

async function run() {
  const today = new Date().toISOString().split('T')[0];

  const { data: settings } = await api.get<Record<string, string>>('/settings');
  if (settings.schedule_enabled !== '1') {
    console.log('Scheduling disabled via settings. Exiting.');
    return;
  }

  const { data: recipients } = await api.get<{ id: string; email: string }[]>('/email-recipients');
  const notifyEmails = recipients.map((r) => r.email);
  if (notifyEmails.length === 0) {
    console.log('No email recipients configured. Skipping email.');
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

      const ohlcv = await fetchOhlcv(item.symbol);

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

  if (triggeredSignals.length > 0) {
    await api.post('/signals', {
      signals: triggeredSignals.map(({ name: _n, ...s }) => s),
    });

    if (notifyEmails.length > 0) {
      await sendSignalEmail(
        RESEND_API_KEY,
        notifyEmails,
        today,
        triggeredSignals.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          closePrice: s.close_price,
          triggeredConditions: ['條件符合'],
        }))
      );
      console.log(`✉️  Sent email to ${notifyEmails.length} recipients with ${triggeredSignals.length} signals`);
    }

    const lineToken = settings.line_channel_access_token;
    const lineGroupId = settings.line_group_id;
    if (lineToken && lineGroupId) {
      try {
        await sendLineGroupMessage(
          lineToken,
          lineGroupId,
          today,
          triggeredSignals.map((s) => ({
            symbol: s.symbol,
            name: s.name,
            closePrice: s.close_price,
            triggeredConditions: ['條件符合'],
          }))
        );
        console.log(`💬 Sent LINE message to group ${lineGroupId}`);
      } catch (err) {
        console.error('LINE push failed:', err);
      }
    } else {
      console.log('LINE not configured, skipping.');
    }
  } else {
    console.log('No signals today.');
  }

  await runRecommendationScan(today);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
