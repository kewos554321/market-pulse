import { Hono } from 'hono';
import { Env, SignalRow } from '../types';

export const signalRoutes = new Hono<{ Bindings: Env }>();

signalRoutes.get('/', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM signals ORDER BY triggered_at DESC LIMIT ?'
  ).bind(limit).all<SignalRow>();
  return c.json(results);
});

signalRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    signals: {
      watchlist_id: string;
      symbol: string;
      close_price: number;
      conditions_snapshot: unknown;
    }[];
  }>();

  if (!body.signals?.length) return c.json({ inserted: 0 });

  const now = new Date().toISOString();
  const stmts = body.signals.map((s) =>
    c.env.DB.prepare(
      'INSERT INTO signals (id, watchlist_id, symbol, triggered_at, conditions_snapshot, close_price, notified) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).bind(
      crypto.randomUUID(),
      s.watchlist_id,
      s.symbol,
      now,
      JSON.stringify(s.conditions_snapshot),
      s.close_price
    )
  );

  await c.env.DB.batch(stmts);
  return c.json({ inserted: stmts.length }, 201);
});
