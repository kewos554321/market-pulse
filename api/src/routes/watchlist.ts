import { Hono } from 'hono';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import { Env, WatchlistRow } from '../types';

export const watchlistRoutes = new Hono<{ Bindings: Env }>();

watchlistRoutes.get('/', async (c) => {
  const assetType = c.req.query('asset_type');
  const whereClause = assetType ? 'WHERE w.asset_type = ?' : '';
  const query = `
    SELECT w.id, w.symbol, w.name, w.enabled, w.asset_type, w.algorithm_template_id, w.created_at,
      at2.name as algorithm_template_name,
      COALESCE(
        json_group_array(
          CASE WHEN g.id IS NOT NULL
            THEN json_object('id', g.id, 'name', g.name)
            ELSE NULL
          END
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'
      ) as groups
    FROM watchlist w
    LEFT JOIN watchlist_groups wg ON w.id = wg.watchlist_id
    LEFT JOIN groups g ON wg.group_id = g.id
    LEFT JOIN algorithm_templates at2 ON w.algorithm_template_id = at2.id
    ${whereClause}
    GROUP BY w.id
    ORDER BY w.created_at DESC
  `;
  const { results } = assetType
    ? await c.env.DB.prepare(query).bind(assetType).all<WatchlistRow & { groups: string; algorithm_template_name: string | null }>()
    : await c.env.DB.prepare(query).all<WatchlistRow & { groups: string; algorithm_template_name: string | null }>();
  return c.json(results.map((r) => ({
    ...r,
    groups: JSON.parse(r.groups as string),
    algorithmTemplate: r.algorithm_template_id
      ? { id: r.algorithm_template_id, name: r.algorithm_template_name! }
      : null,
  })));
});

watchlistRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const query = `
    SELECT w.id, w.symbol, w.name, w.enabled, w.asset_type, w.algorithm_template_id, w.created_at,
      at2.name as algorithm_template_name,
      COALESCE(
        json_group_array(
          CASE WHEN g.id IS NOT NULL
            THEN json_object('id', g.id, 'name', g.name)
            ELSE NULL
          END
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'
      ) as groups
    FROM watchlist w
    LEFT JOIN watchlist_groups wg ON w.id = wg.watchlist_id
    LEFT JOIN groups g ON wg.group_id = g.id
    LEFT JOIN algorithm_templates at2 ON w.algorithm_template_id = at2.id
    WHERE w.id = ?
    GROUP BY w.id
  `;
  const row = await c.env.DB.prepare(query).bind(id).first<WatchlistRow & { groups: string; algorithm_template_name: string | null }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({
    ...row,
    groups: JSON.parse(row.groups as string),
    algorithmTemplate: row.algorithm_template_id
      ? { id: row.algorithm_template_id, name: row.algorithm_template_name! }
      : null,
  });
});

watchlistRoutes.post('/', async (c) => {
  const { symbol, name, asset_type = 'tw_stock', templateId = null } = await c.req.json<{
    symbol: string;
    name: string;
    asset_type?: string;
    templateId?: string | null;
  }>();
  if (!symbol || !name) return c.json({ error: 'symbol and name required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO watchlist (id, symbol, name, enabled, asset_type, algorithm_template_id, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)'
  ).bind(id, symbol.trim(), name.trim(), asset_type, templateId, now).run();

  await c.env.DB.prepare(
    'INSERT INTO algorithms (id, watchlist_id, conditions, updated_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), id, '{"operator":"AND","conditions":[]}', now).run();

  return c.json({
    id, symbol: symbol.trim(), name: name.trim(),
    enabled: 1, asset_type, groups: [],
    algorithm_template_id: templateId,
    algorithmTemplate: null,
    created_at: now,
  }, 201);
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

watchlistRoutes.put('/:id/groups', async (c) => {
  const { id } = c.req.param();
  const { groupIds } = await c.req.json<{ groupIds: string[] }>();
  if (!Array.isArray(groupIds)) return c.json({ error: 'groupIds array required' }, 400);

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare('DELETE FROM watchlist_groups WHERE watchlist_id = ?').bind(id),
    ...groupIds.map((gid) =>
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO watchlist_groups (watchlist_id, group_id) VALUES (?, ?)'
      ).bind(id, gid)
    ),
  ];
  await c.env.DB.batch(stmts);
  return c.json({ success: true });
});

watchlistRoutes.put('/:id/algorithm-template', async (c) => {
  const { id } = c.req.param();
  const { templateId } = await c.req.json<{ templateId: string | null }>();

  const result = await c.env.DB.prepare(
    'UPDATE watchlist SET algorithm_template_id = ? WHERE id = ?'
  ).bind(templateId ?? null, id).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
