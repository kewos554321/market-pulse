import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { algorithmRoutes } from '../src/routes/algorithms';
import { mockDB, makeEnv, req } from './helpers';

function makeApp() {
  const app = new Hono();
  app.route('/watchlist', algorithmRoutes);
  return app;
}

const emptyTree = { operator: 'AND', conditions: [] };
const customConditions = { operator: 'AND', conditions: [{ indicator: 'RSI', period: 14, op: '<', value: 30 }] };

describe('GET /watchlist/:id/algorithm', () => {
  it('returns 404 when stock not found', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ first: null }]));
    const res = await req(app, 'GET', '/watchlist/nonexistent/algorithm', env);
    expect(res.status).toBe(404);
  });

  it('returns custom algorithm when algorithm_template_id is null', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([
      { first: { algorithm_template_id: null } },
      { first: { id: 'alg-1', watchlist_id: 'stock-1', conditions: JSON.stringify(customConditions), updated_at: '' } },
    ]));
    const res = await req(app, 'GET', '/watchlist/stock-1/algorithm', env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.source).toBe('custom');
    expect(body.conditions).toEqual(customConditions);
  });

  it('returns template algorithm when stock has algorithm_template_id', async () => {
    const app = makeApp();
    const templateConditions = { operator: 'AND', conditions: [{ indicator: 'RSI', period: 14, op: '<', value: 35 }] };
    const env = makeEnv(mockDB([
      { first: { algorithm_template_id: 'tmpl-1' } },
      { first: { id: 'tmpl-1', name: '動能型', conditions: JSON.stringify(templateConditions) } },
    ]));
    const res = await req(app, 'GET', '/watchlist/stock-1/algorithm', env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.source).toBe('template');
    expect(body.templateId).toBe('tmpl-1');
    expect(body.templateName).toBe('動能型');
    expect(body.conditions).toEqual(templateConditions);
  });

  it('returns empty conditions when linked template not found', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([
      { first: { algorithm_template_id: 'tmpl-missing' } },
      { first: null },
    ]));
    const res = await req(app, 'GET', '/watchlist/stock-1/algorithm', env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.source).toBe('template');
    expect(body.templateName).toBeNull();
    expect(body.conditions).toEqual(emptyTree);
  });
});

describe('PUT /watchlist/:id/algorithm', () => {
  it('updates conditions and returns success', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'PUT', '/watchlist/stock-1/algorithm', env, { conditions: customConditions });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('returns 400 when conditions missing', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([]));
    const res = await req(app, 'PUT', '/watchlist/stock-1/algorithm', env, {});
    expect(res.status).toBe(400);
  });

  it('returns 404 when stock not found', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 0 }]));
    const res = await req(app, 'PUT', '/watchlist/nonexistent/algorithm', env, { conditions: customConditions });
    expect(res.status).toBe(404);
  });
});
