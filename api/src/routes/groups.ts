import { Hono } from 'hono';
import { Env } from '../types';

interface GroupRow {
  id: string;
  name: string;
  created_at: string;
  count: number;
}

export const groupRoutes = new Hono<{ Bindings: Env }>();

groupRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.created_at, COUNT(wg.watchlist_id) as count
     FROM groups g
     LEFT JOIN watchlist_groups wg ON g.id = wg.group_id
     GROUP BY g.id
     ORDER BY g.created_at ASC`
  ).all<GroupRow>();
  return c.json(results);
});

groupRoutes.post('/', async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)'
  ).bind(id, name.trim(), now).run();
  return c.json({ id, name: name.trim(), created_at: now, count: 0 }, 201);
});

groupRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
