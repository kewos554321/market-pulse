import { createMiddleware } from 'hono/factory';
import { Env } from '../types';

export const apiKeyAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (c.req.path === '/line/webhook') {
    await next();
    return;
  }
  const key = c.req.header('X-API-Key');
  if (!key || key !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
