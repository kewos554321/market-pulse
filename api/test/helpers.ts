import { Hono } from 'hono';

// Each element corresponds to one prepare() call in order.
// Use `first` for .first<T>(), `all` for .all<T>(), `changes` for .run()
export type MockStep =
  | { first: unknown }
  | { all: unknown[] }
  | { changes: number };

export function mockDB(queue: MockStep[]) {
  let i = 0;
  return {
    prepare(_sql: string) {
      const r: Partial<{ first: unknown; all: unknown[]; changes: number }> = queue[i++] ?? {};
      const stmt = {
        bind(..._args: unknown[]) { return stmt; },
        async first<T>() { return ('first' in r ? r.first : null) as T | null; },
        async all<T>() { return { results: ('all' in r ? r.all : []) as T[] }; },
        async run() { return { meta: { changes: 'changes' in r ? r.changes : 1 } }; },
      };
      return stmt;
    },
    async batch(_stmts: unknown[]) { return []; },
  };
}

export function makeEnv(db: ReturnType<typeof mockDB>) {
  return { DB: db as unknown, API_KEY: 'test' };
}

export async function req(
  app: Hono,
  method: string,
  path: string,
  env: ReturnType<typeof makeEnv>,
  body?: unknown,
) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return app.fetch(new Request(`http://localhost${path}`, init), env as Record<string, unknown>);
}
