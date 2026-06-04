import { Hono } from 'hono';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import { Env, WatchlistRow } from '../types';

export const watchlistRoutes = new Hono<{ Bindings: Env }>();

watchlistRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT w.id, w.symbol, w.name, w.enabled, w.created_at,
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
     GROUP BY w.id
     ORDER BY w.created_at DESC`
  ).all<WatchlistRow & { groups: string }>();

  return c.json(results.map((r) => ({
    ...r,
    groups: JSON.parse(r.groups as string) as { id: string; name: string }[],
  })));
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
