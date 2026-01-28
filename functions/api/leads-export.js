/**
 * GET /api/leads-export — Protected endpoint to export all leads as JSON array.
 * Requires X-Export-Key header matching the EXPORT_KEY secret.
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  const headers = { 'Content-Type': 'application/json' };

  // Authenticate
  const exportKey = request.headers.get('X-Export-Key');
  if (!exportKey || !env.EXPORT_KEY || exportKey !== env.EXPORT_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers,
    });
  }

  if (!env.LEADS) {
    return new Response(JSON.stringify({ error: 'KV namespace not configured' }), {
      status: 500,
      headers,
    });
  }

  const leads = [];
  let cursor = undefined;

  // Paginate through all KV keys with prefix "lead:"
  do {
    const listResult = await env.LEADS.list({ prefix: 'lead:', cursor, limit: 1000 });
    const values = await Promise.all(
      listResult.keys.map(async (key) => {
        const val = await env.LEADS.get(key.name, { type: 'json' });
        return val;
      })
    );
    leads.push(...values.filter(Boolean));
    cursor = listResult.list_complete ? undefined : listResult.cursor;
  } while (cursor);

  return new Response(JSON.stringify(leads, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
