import { Hono } from 'hono';
import { Env } from '../types';

interface GroupRow {
  id: string;
  name: string;
  created_at: string;
  count: number;
  algorithm_template_id: string | null;
  template_name: string | null;
}

export const groupRoutes = new Hono<{ Bindings: Env }>();

groupRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.created_at, COUNT(wg.watchlist_id) as count,
            g.algorithm_template_id,
            at.name as template_name
     FROM groups g
     LEFT JOIN watchlist_groups wg ON g.id = wg.group_id
     LEFT JOIN algorithm_templates at ON g.algorithm_template_id = at.id
     GROUP BY g.id
     ORDER BY g.created_at ASC`
  ).all<GroupRow>();
  return c.json(results.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    count: r.count,
    algorithmTemplate: r.algorithm_template_id
      ? { id: r.algorithm_template_id, name: r.template_name! }
      : null,
  })));
});

groupRoutes.post('/', async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)'
  ).bind(id, name.trim(), now).run();
  return c.json({ id, name: name.trim(), created_at: now, count: 0, algorithmTemplate: null }, 201);
});

groupRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

groupRoutes.put('/:id/algorithm-template', async (c) => {
  const { id } = c.req.param();
  const { templateId } = await c.req.json<{ templateId: string | null }>();

  const result = await c.env.DB.prepare(
    'UPDATE groups SET algorithm_template_id = ? WHERE id = ?'
  ).bind(templateId ?? null, id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
