import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { algorithmTemplateRoutes } from '../src/routes/algorithm-templates';
import { mockDB, makeEnv, req } from './helpers';

function makeApp() {
  const app = new Hono();
  app.route('/algorithm-templates', algorithmTemplateRoutes);
  return app;
}

const validConditions = { operator: 'AND', conditions: [{ indicator: 'RSI', period: 14, op: '<', value: 30 }] };

describe('GET /algorithm-templates', () => {
  it('returns empty list when no templates', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ all: [] }]));
    const res = await req(app, 'GET', '/algorithm-templates', env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('parses conditions JSON from DB', async () => {
    const app = makeApp();
    const row = { id: 't-1', name: '動能型', conditions: JSON.stringify(validConditions), created_at: '', updated_at: '' };
    const env = makeEnv(mockDB([{ all: [row] }]));
    const res = await req(app, 'GET', '/algorithm-templates', env);
    const body = await res.json() as Record<string, unknown>[];
    expect(body[0].conditions).toEqual(validConditions);
    expect(typeof body[0].conditions).toBe('object');
  });
});

describe('POST /algorithm-templates', () => {
  it('returns 400 when name is missing', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([]));
    const res = await req(app, 'POST', '/algorithm-templates', env, { conditions: validConditions });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('name required');
  });

  it('returns 400 when name is blank', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([]));
    const res = await req(app, 'POST', '/algorithm-templates', env, { name: '  ', conditions: validConditions });
    expect(res.status).toBe(400);
  });

  it('returns 400 when conditions are missing', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([]));
    const res = await req(app, 'POST', '/algorithm-templates', env, { name: '動能型' });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('conditions required');
  });

  it('returns 201 with created template', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'POST', '/algorithm-templates', env, { name: '動能型', conditions: validConditions });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe('動能型');
    expect(body.conditions).toEqual(validConditions);
    expect(typeof body.id).toBe('string');
  });
});

describe('PUT /algorithm-templates/:id', () => {
  it('returns 400 when neither name nor conditions provided', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([]));
    const res = await req(app, 'PUT', '/algorithm-templates/t-1', env, {});
    expect(res.status).toBe(400);
  });

  it('returns 404 when template not found', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 0 }]));
    const res = await req(app, 'PUT', '/algorithm-templates/nonexistent', env, { name: '新名字' });
    expect(res.status).toBe(404);
  });

  it('returns success when updating name only', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'PUT', '/algorithm-templates/t-1', env, { name: '新名字' });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });
});

describe('DELETE /algorithm-templates/:id', () => {
  it('returns 404 when template not found', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 0 }]));
    const res = await req(app, 'DELETE', '/algorithm-templates/nonexistent', env);
    expect(res.status).toBe(404);
  });

  it('returns success when template exists', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'DELETE', '/algorithm-templates/t-1', env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });
});
