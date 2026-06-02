import { Hono } from 'hono';
import { Env, WatchlistRow } from '../types';

export const watchlistRoutes = new Hono<{ Bindings: Env }>();

watchlistRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM watchlist ORDER BY created_at DESC'
  ).all<WatchlistRow>();
  return c.json(results);
});

watchlistRoutes.post('/', async (c) => {
  const { symbol, name } = await c.req.json<{ symbol: string; name: string }>();
  if (!symbol || !name) return c.json({ error: 'symbol and name required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO watchlist (id, symbol, name, enabled, created_at) VALUES (?, ?, ?, 1, ?)'
  ).bind(id, symbol.trim(), name.trim(), now).run();

  await c.env.DB.prepare(
    'INSERT INTO algorithms (id, watchlist_id, conditions, updated_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, '{"operator":"AND","conditions":[]}', now).run();

  return c.json({ id, symbol: symbol.trim(), name: name.trim(), enabled: 1, created_at: now }, 201);
});

watchlistRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare('DELETE FROM watchlist WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

watchlistRoutes.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const { enabled } = await c.req.json<{ enabled: boolean }>();
  const result = await c.env.DB.prepare(
    'UPDATE watchlist SET enabled = ? WHERE id = ?'
  ).bind(enabled ? 1 : 0, id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
