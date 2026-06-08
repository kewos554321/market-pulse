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
  return c.json(results.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    count: r.count,
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
  return c.json({ id, name: name.trim(), created_at: now, count: 0 }, 201);
});

groupRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const { results: orphans } = await c.env.DB.prepare(
    `SELECT w.id FROM watchlist w
     JOIN watchlist_groups wg ON w.id = wg.watchlist_id
     WHERE wg.group_id = ?
     AND (SELECT COUNT(*) FROM watchlist_groups WHERE watchlist_id = w.id) = 1`
  ).bind(id).all<{ id: string }>();

  const result = await c.env.DB.prepare(
    'DELETE FROM groups WHERE id = ?'
  ).bind(id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);

  const deletedWatchlistIds = orphans.map((r) => r.id);

  if (deletedWatchlistIds.length > 0) {
    const placeholders = deletedWatchlistIds.map(() => '?').join(', ');
    await c.env.DB.prepare(
      `DELETE FROM watchlist WHERE id IN (${placeholders})`
    ).bind(...deletedWatchlistIds).run();
  }

  return c.json({ success: true, deletedWatchlistIds });
});

groupRoutes.put('/:id/batch-apply-template', async (c) => {
  const { id } = c.req.param();
  const { templateId } = await c.req.json<{ templateId: string | null }>();

  await c.env.DB.prepare(
    `UPDATE watchlist SET algorithm_template_id = ?
     WHERE id IN (SELECT watchlist_id FROM watchlist_groups WHERE group_id = ?)`
  ).bind(templateId ?? null, id).run();

  return c.json({ success: true });
});
