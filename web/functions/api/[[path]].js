export async function onRequest(context) {
  const url = new URL(context.request.url);
  const apiPath = url.pathname.replace(/^\/api/, '') || '/';
  const targetUrl = `https://api${apiPath}${url.search}`;

  const hasBody = !['GET', 'HEAD'].includes(context.request.method);
  return context.env.API.fetch(
    new Request(targetUrl, {
      method: context.request.method,
      headers: context.request.headers,
      body: hasBody ? context.request.body : null,
    })
  );
}
