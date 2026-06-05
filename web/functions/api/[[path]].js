const API_BASE = 'https://market-pulse-api.kewos554321.workers.dev';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const apiPath = url.pathname.replace(/^\/api/, '') || '/';
  const targetUrl = `${API_BASE}${apiPath}${url.search}`;

  const headers = new Headers(context.request.headers);
  if (context.env.API_KEY) headers.set('X-API-Key', context.env.API_KEY);

  const hasBody = !['GET', 'HEAD'].includes(context.request.method);
  return fetch(
    new Request(targetUrl, {
      method: context.request.method,
      headers,
      body: hasBody ? context.request.body : null,
    })
  );
}
