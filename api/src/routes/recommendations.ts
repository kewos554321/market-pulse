import { Hono } from 'hono';
import { Env, RecommendationRow } from '../types';

export const recommendationsRoutes = new Hono<{ Bindings: Env }>();

recommendationsRoutes.get('/', async (c) => {
  const { results: dateRow } = await c.env.DB.prepare(
    'SELECT MAX(date) as latest_date FROM recommendations'
  ).all<{ latest_date: string | null }>();

  const latestDate = dateRow[0]?.latest_date;
  if (!latestDate) return c.json({ date: null, items: [] });

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM recommendations WHERE date = ? ORDER BY symbol ASC'
  ).bind(latestDate).all<RecommendationRow>();

  return c.json({
    date: latestDate,
    items: results.map((r) => ({
      ...r,
      strategies: JSON.parse(r.strategies) as string[],
    })),
  });
});

recommendationsRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    date: string;
    items: { symbol: string; name: string; close_price: number; strategies: string[] }[];
  }>();

  if (!body.date) return c.json({ error: 'date required' }, 400);

  const now = new Date().toISOString();

  const stmts = [
    c.env.DB.prepare('DELETE FROM recommendations WHERE date = ?').bind(body.date),
    ...body.items.map((item) =>
      c.env.DB.prepare(
        'INSERT INTO recommendations (date, symbol, name, close_price, strategies, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(body.date, item.symbol, item.name, item.close_price, JSON.stringify(item.strategies), now)
    ),
  ];

  await c.env.DB.batch(stmts);
  return c.json({ inserted: body.items.length }, 201);
});
