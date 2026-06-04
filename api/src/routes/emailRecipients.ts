import { Hono } from 'hono';
import { Env, EmailRecipientRow } from '../types';

export const emailRecipientsRoutes = new Hono<{ Bindings: Env }>();

emailRecipientsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM email_recipients ORDER BY created_at ASC'
  ).all<EmailRecipientRow>();
  return c.json(results);
});

emailRecipientsRoutes.post('/', async (c) => {
  const { email, label } = await c.req.json<{ email: string; label?: string }>();
  if (!email) return c.json({ error: 'email required' }, 400);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return c.json({ error: 'invalid email format' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      'INSERT INTO email_recipients (id, email, label, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, email.trim().toLowerCase(), label?.trim() ?? null, now).run();
  } catch {
    return c.json({ error: 'email already exists' }, 409);
  }

  return c.json({ id, email: email.trim().toLowerCase(), label: label?.trim() ?? null, created_at: now }, 201);
});

emailRecipientsRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await c.env.DB.prepare(
    'DELETE FROM email_recipients WHERE id = ?'
  ).bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ success: true });
});
