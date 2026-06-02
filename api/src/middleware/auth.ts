import { createMiddleware } from 'hono/factory';
import { Env } from '../types';

export const apiKeyAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const key = c.req.header('X-API-Key');
  if (!key || key !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
