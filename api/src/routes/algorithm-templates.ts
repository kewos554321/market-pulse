import { Hono } from 'hono';
import { Env, AlgorithmTemplateRow } from '../types';

export const algorithmTemplateRoutes = new Hono<{ Bindings: Env }>();

algorithmTemplateRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM algorithm_templates ORDER BY created_at ASC'
  ).all<AlgorithmTemplateRow>();
  return c.json(results.map((r) => ({ ...r, conditions: JSON.parse(r.conditions) })));
});

algorithmTemplateRoutes.post('/', async (c) => {
  const { name, conditions } = await c.req.json<{ name: string; conditions: unknown }>();
  if (!name?.trim()) return c.json({ error: 'name required' }, 400);
  if (!conditions) return c.json({ error: 'conditions required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO algorithm_templates (id, name, conditions, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name.trim(), JSON.stringify(conditions), now, now).run();

  return c.json({ id, name: name.trim(), conditions, created_at: now, updated_at: now }, 201);
});

algorithmTemplateRoutes.put('/:id', async (c) => {
  const { id } = c.req.param();
  const { name, conditions } = await c.req.json<{ name?: string; conditions?: unknown }>();
  if (!name?.trim() && !conditions) return c.json({ error: 'name or conditions required' }, 400);

  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (name?.trim()) { fields.push('name = ?'); values.push(name.trim()); }
  if (conditions) { fields.push('conditions = ?'); values.push(JSON.stringify(conditions)); }
  values.push(id);

  const result = await c.env.DB.prepare(
    `UPDATE algorithm_templates SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});

algorithmTemplateRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare(
    'DELETE FROM algorithm_templates WHERE id = ?'
  ).bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
