import { Hono } from 'hono';
import { Env, RecommendationStockRow } from '../types';

export const recommendationStocksRoutes = new Hono<{ Bindings: Env }>();

const MAX_STOCKS = 120;

recommendationStocksRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM recommendation_stocks ORDER BY is_default DESC, symbol ASC'
  ).all<RecommendationStockRow>();
  return c.json(results);
});

recommendationStocksRoutes.post('/', async (c) => {
  const { symbol, name } = await c.req.json<{ symbol: string; name: string }>();
  if (!symbol || !name) return c.json({ error: 'symbol and name required' }, 400);

  const { results: existing } = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM recommendation_stocks'
  ).all<{ count: number }>();
  if ((existing[0]?.count ?? 0) >= MAX_STOCKS) {
    return c.json({ error: `Stock pool is full (max ${MAX_STOCKS})` }, 400);
  }

  await c.env.DB.prepare(
    'INSERT INTO recommendation_stocks (symbol, name, is_default) VALUES (?, ?, 0)'
  ).bind(symbol.trim(), name.trim()).run();

  return c.json({ symbol: symbol.trim(), name: name.trim(), is_default: 0 }, 201);
});

recommendationStocksRoutes.delete('/:symbol', async (c) => {
  const { symbol } = c.req.param();
  const result = await c.env.DB.prepare(
    'DELETE FROM recommendation_stocks WHERE symbol = ?'
  ).bind(symbol).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
