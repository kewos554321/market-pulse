import { Hono } from 'hono';
import { Env, AlgorithmRow } from '../types';

export const algorithmRoutes = new Hono<{ Bindings: Env }>();

algorithmRoutes.get('/:id/algorithm', async (c) => {
  const { id } = c.req.param();

  const watchlistRow = await c.env.DB.prepare(
    'SELECT algorithm_template_id FROM watchlist WHERE id = ?'
  ).bind(id).first<{ algorithm_template_id: string | null }>();

  if (!watchlistRow) return c.json({ error: 'Not found' }, 404);

  if (watchlistRow.algorithm_template_id) {
    const tmplRow = await c.env.DB.prepare(
      'SELECT id, name, conditions FROM algorithm_templates WHERE id = ?'
    ).bind(watchlistRow.algorithm_template_id).first<{
      id: string; name: string; conditions: string;
    }>();

    const conditions = tmplRow?.conditions
      ? JSON.parse(tmplRow.conditions)
      : { operator: 'AND', conditions: [] };

    return c.json({
      source: 'template',
      templateId: watchlistRow.algorithm_template_id,
      templateName: tmplRow?.name ?? null,
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
