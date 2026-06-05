import { Hono } from 'hono';
import { Env, AlgorithmRow } from '../types';

export const algorithmRoutes = new Hono<{ Bindings: Env }>();

algorithmRoutes.get('/:id/algorithm', async (c) => {
  const { id } = c.req.param();

  const watchlistRow = await c.env.DB.prepare(
    'SELECT algorithm_source_group_id FROM watchlist WHERE id = ?'
  ).bind(id).first<{ algorithm_source_group_id: string | null }>();

  if (!watchlistRow) return c.json({ error: 'Not found' }, 404);

  if (watchlistRow.algorithm_source_group_id) {
    const groupRow = await c.env.DB.prepare(
      `SELECT g.id, g.name, g.algorithm_template_id, at.name as template_name, at.conditions
       FROM groups g
       LEFT JOIN algorithm_templates at ON g.algorithm_template_id = at.id
       WHERE g.id = ?`
    ).bind(watchlistRow.algorithm_source_group_id).first<{
      id: string; name: string;
      algorithm_template_id: string | null;
      template_name: string | null;
      conditions: string | null;
    }>();

    const conditions = groupRow?.conditions
      ? JSON.parse(groupRow.conditions)
      : { operator: 'AND', conditions: [] };

    return c.json({
      source: 'group',
      sourceGroupId: watchlistRow.algorithm_source_group_id,
      sourceGroupName: groupRow?.name ?? '',
      templateName: groupRow?.template_name ?? null,
      conditions,
    });
  }

  const row = await c.env.DB.prepare(
    'SELECT * FROM algorithms WHERE watchlist_id = ?'
  ).bind(id).first<AlgorithmRow>();

  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({
    source: 'custom',
    conditions: JSON.parse(row.conditions),
  });
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
