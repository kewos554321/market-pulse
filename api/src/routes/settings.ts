import { Hono } from 'hono';
import { Env } from '../types';

export const settingsRoutes = new Hono<{ Bindings: Env }>();

settingsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all<{
    key: string;
    value: string;
  }>();
  const map = Object.fromEntries(results.map((r) => [r.key, r.value]));
  return c.json(map);
});

settingsRoutes.put('/', async (c) => {
  const updates = await c.req.json<Record<string, string>>();
  const stmts = Object.entries(updates).map(([key, value]) =>
    c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, value)
  );
  await c.env.DB.batch(stmts);
  return c.json({ success: true });
});
