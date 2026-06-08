import { Hono } from 'hono';
import { Env } from '../types';

const VALID_ASSET_TYPES = ['tw_stock', 'us_stock', 'crypto', 'fx'];

interface GroupRow {
  id: string;
  name: string;
  asset_type: string;
  created_at: string;
  count: number;
}

export const groupRoutes = new Hono<{ Bindings: Env }>();

groupRoutes.get('/', async (c) => {
  const assetType = c.req.query('asset_type');
  const whereClause = assetType ? 'WHERE g.asset_type = ?' : '';
  const query = `
    SELECT g.id, g.name, g.asset_type, g.created_at, COUNT(wg.watchlist_id) as count
    FROM groups g
    LEFT JOIN watchlist_groups wg ON g.id = wg.group_id
    ${whereClause}
    GROUP BY g.id
    ORDER BY g.created_at ASC`;
  const { results } = assetType
    ? await c.env.DB.prepare(query).bind(assetType).all<GroupRow>()
    : await c.env.DB.prepare(query).all<GroupRow>();
  return c.json(results.map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    count: r.count,
  })));
});

groupRoutes.post('/', async (c) => {
  const { name, asset_type = 'tw_stock' } = await c.req.json<{ name: string; asset_type?: string }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  if (!VALID_ASSET_TYPES.includes(asset_type)) return c.json({ error: 'invalid asset_type' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO groups (id, name, asset_type, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, name.trim(), asset_type, now).run();
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
