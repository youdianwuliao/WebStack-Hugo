export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/counter') {
      const kvKey = 'visitor_count';

      if (request.method === 'GET') {
        const count = await env.link.get(kvKey) || '0';
        return new Response(JSON.stringify({ count: parseInt(count) }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (request.method === 'POST') {
        const count = await env.link.get(kvKey) || '0';
        const newCount = parseInt(count) + 1;
        await env.link.put(kvKey, newCount.toString());
        return new Response(JSON.stringify({ count: newCount }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};