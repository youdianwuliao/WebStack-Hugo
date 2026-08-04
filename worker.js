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
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const ipKey = 'rate_' + ip;
        const now = Date.now();
        const last = parseInt(await env.link.get(ipKey) || '0', 10);
        if (now - last < 60000) {
          const count = await env.link.get(kvKey) || '0';
          return new Response(JSON.stringify({ count: parseInt(count) }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        await env.link.put(ipKey, now.toString(), { expirationTtl: 120 });

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