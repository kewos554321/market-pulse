import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { groupRoutes } from '../src/routes/groups';
import { mockDB, makeEnv, req } from './helpers';

function makeApp() {
  const app = new Hono();
  app.route('/groups', groupRoutes);
  return app;
}

describe('DELETE /groups/:id', () => {
  it('returns 404 when group not found', async () => {
    const app = makeApp();
    // queue: [orphan query → empty, delete group → 0 changes]
    const env = makeEnv(mockDB([{ all: [] }, { changes: 0 }]));
    const res = await req(app, 'DELETE', '/groups/missing-id', env);
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Not found');
  });

  it('deletes group with no orphans, returns empty deletedWatchlistIds', async () => {
    const app = makeApp();
    // queue: [orphan query → empty, delete group → 1 change]
    const env = makeEnv(mockDB([{ all: [] }, { changes: 1 }]));
    const res = await req(app, 'DELETE', '/groups/g-1', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; deletedWatchlistIds: string[] };
    expect(body.success).toBe(true);
    expect(body.deletedWatchlistIds).toEqual([]);
  });

  it('deletes group and orphan watchlist items, returns their IDs', async () => {
    const app = makeApp();
    // queue: [orphan query → 2 items, delete group → 1, delete orphans → 2]
    const env = makeEnv(mockDB([
      { all: [{ id: 'w-1' }, { id: 'w-2' }] },
      { changes: 1 },
      { changes: 2 },
    ]));
    const res = await req(app, 'DELETE', '/groups/g-1', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; deletedWatchlistIds: string[] };
    expect(body.success).toBe(true);
    expect(body.deletedWatchlistIds).toEqual(['w-1', 'w-2']);
  });

  it('does not delete watchlist items that belong to other groups', async () => {
    const app = makeApp();
    // orphan query returns empty (items have other groups) → no orphan delete call
    const env = makeEnv(mockDB([{ all: [] }, { changes: 1 }]));
    const res = await req(app, 'DELETE', '/groups/g-1', env);
    const body = await res.json() as { deletedWatchlistIds: string[] };
    expect(body.deletedWatchlistIds).toEqual([]);
  });
});

describe('GET /groups', () => {
  it('returns all groups when no asset_type filter', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{
      all: [
        { id: 'g-1', name: 'Tech', asset_type: 'tw_stock', created_at: '2024-01-01', count: 2 },
        { id: 'g-2', name: 'Crypto', asset_type: 'crypto', created_at: '2024-01-02', count: 1 },
      ],
    }]));
    const res = await req(app, 'GET', '/groups', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; name: string }[];
    expect(body).toHaveLength(2);
  });

  it('filters groups by asset_type query param', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{
      all: [
        { id: 'g-2', name: 'Crypto', asset_type: 'crypto', created_at: '2024-01-02', count: 1 },
      ],
    }]));
    const res = await req(app, 'GET', '/groups?asset_type=crypto', env);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; name: string }[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('g-2');
  });
});

describe('POST /groups', () => {
  it('creates a group with explicit asset_type', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'POST', '/groups', env, { name: 'Tech', asset_type: 'us_stock' });
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string; count: number };
    expect(body.name).toBe('Tech');
    expect(body.count).toBe(0);
  });

  it('defaults asset_type to tw_stock when not provided', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([{ changes: 1 }]));
    const res = await req(app, 'POST', '/groups', env, { name: 'Bancorp' });
    expect(res.status).toBe(201);
  });

  it('rejects unknown asset_type', async () => {
    const app = makeApp();
    const env = makeEnv(mockDB([]));
    const res = await req(app, 'POST', '/groups', env, { name: 'X', asset_type: 'bonds' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid asset_type');
  });
});
