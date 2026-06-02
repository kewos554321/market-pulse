import { Hono } from 'hono';
import { Env, AlgorithmRow } from '../types';

export const algorithmRoutes = new Hono<{ Bindings: Env }>();

algorithmRoutes.get('/:id/algorithm', async (c) => {
  const { id } = c.req.param();
  const row = await c.env.DB.prepare(
    'SELECT * FROM algorithms WHERE watchlist_id = ?'
  ).bind(id).first<AlgorithmRow>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ ...row, conditions: JSON.parse(row.conditions) });
});

algorithmRoutes.put('/:id/algorithm', async (c) => {
  const { id } = c.req.param();
  const { conditions } = await c.req.json<{ conditions: unknown }>();
  if (!conditions) return c.json({ error: 'conditions required' }, 400);

  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    'UPDATE algorithms SET conditions = ?, updated_at = ? WHERE watchlist_id = ?'
  ).bind(JSON.stringify(conditions), now, id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
