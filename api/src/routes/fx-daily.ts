import { Hono } from 'hono';
import { Env, FxDailyRow } from '../types';

export const fxDailyRoutes = new Hono<{ Bindings: Env }>();

fxDailyRoutes.get('/', async (c) => {
  const limit = Math.max(1, parseInt(c.req.query('limit') ?? '90', 10) || 90);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM fx_daily ORDER BY date DESC LIMIT ?'
  ).bind(limit).all<FxDailyRow>();
  return c.json([...results].reverse());
});

fxDailyRoutes.post('/', async (c) => {
  const { date, rates_json } = await c.req.json<{ date: string; rates_json: string }>();
  if (!date || !rates_json) return c.json({ error: 'date and rates_json required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO fx_daily (id, date, rates_json, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET rates_json = excluded.rates_json'
  ).bind(id, date, rates_json, now).run();

  return c.json({ success: true });
});
