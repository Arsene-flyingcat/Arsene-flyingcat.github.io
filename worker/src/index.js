/**
 * Cloudflare Worker — Proxy between the blog and Firestore REST API.
 * Bypasses China's GFW block on googleapis.com / gstatic.com.
 * Also handles background visitor IP tracking via KV.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim());
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (url.pathname === '/api/comments' && request.method === 'GET') {
        return await handleGet(url, env, corsHeaders);
      }
      if (url.pathname === '/api/comments' && request.method === 'POST') {
        return await handlePost(request, env, corsHeaders);
      }
      // ── Visitor tracking ───────────────────────────────────────
      if (url.pathname === '/api/track' && request.method === 'POST') {
        return await handleTrack(request, env, corsHeaders);
      }
      if (url.pathname === '/api/visits' && request.method === 'GET') {
        return await handleVisits(url, env, corsHeaders);
      }
      return json({ error: 'Not found' }, 404, corsHeaders);
    } catch (err) {
      return json({ error: 'Internal error', detail: err.message }, 500, corsHeaders);
    }
  },
};

// ── GET /api/comments?page_path=... ──────────────────────────────

async function handleGet(url, env, corsHeaders) {
  const pagePath = url.searchParams.get('page_path');
  if (!pagePath) {
    return json({ error: 'page_path query parameter is required' }, 400, corsHeaders);
  }

  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents:runQuery?key=${env.FIREBASE_API_KEY}`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: 'comments' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'page_path' },
          op: 'EQUAL',
          value: { stringValue: pagePath },
        },
      },
      orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'ASCENDING' }],
    },
  };

  const resp = await fetch(firestoreUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: 'Firestore query failed', detail: text }, resp.status, corsHeaders);
  }

  const raw = await resp.json();
  const comments = raw
    .filter((r) => r.document)
    .map((r) => docToComment(r.document));

  return json(comments, 200, corsHeaders);
}

// ── POST /api/comments ───────────────────────────────────────────

async function handlePost(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, corsHeaders);
  }

  // Honeypot
  if (body.website) {
    return json({ error: 'Spam detected' }, 400, corsHeaders);
  }

  const { page_path, author_name, content, parent_id } = body;

  // Validation
  if (!page_path || typeof page_path !== 'string' || !page_path.startsWith('/')) {
    return json({ error: 'page_path is required and must start with /' }, 400, corsHeaders);
  }
  if (!author_name || typeof author_name !== 'string' || author_name.trim().length === 0 || author_name.length > 50) {
    return json({ error: 'author_name is required (max 50 chars)' }, 400, corsHeaders);
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 2000) {
    return json({ error: 'content is required (max 2000 chars)' }, 400, corsHeaders);
  }

  const created_at = new Date().toISOString();

  const fields = {
    page_path: { stringValue: page_path },
    author_name: { stringValue: author_name.trim() },
    content: { stringValue: content.trim() },
    created_at: { timestampValue: created_at },
  };
  if (parent_id) {
    fields.parent_id = { stringValue: parent_id };
  }

  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/comments?key=${env.FIREBASE_API_KEY}`;

  const resp = await fetch(firestoreUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: 'Firestore write failed', detail: text }, resp.status, corsHeaders);
  }

  const doc = await resp.json();
  return json(docToComment(doc), 201, corsHeaders);
}

// ── POST /api/track — record a visit silently ────────────────────

async function handleTrack(request, env, corsHeaders) {
  if (!env.VISITS) {
    return json({ ok: false, reason: 'KV not bound' }, 200, corsHeaders);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const country = request.headers.get('CF-IPCountry') || '';
  const ua = request.headers.get('User-Agent') || '';
  const cf = request.cf || {};
  const city = cf.city || '';
  const region = cf.region || '';

  let page = '/';
  try {
    const text = await request.text();
    const body = JSON.parse(text);
    page = body.page || '/';
  } catch { /* keep defaults */ }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const id = crypto.randomUUID();

  const visit = { ip, country, city, region, page, ua, ts: now.toISOString() };

  await env.VISITS.put(`v:${date}:${id}`, JSON.stringify(visit), {
    expirationTtl: 90 * 86400, // auto-delete after 90 days
  });

  return json({ ok: true }, 200, corsHeaders);
}

// ── GET /api/visits?token=...&date=...&days=... — query visits ──

async function handleVisits(url, env, corsHeaders) {
  const token = url.searchParams.get('token');
  if (!token || token !== env.ADMIN_TOKEN) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }
  if (!env.VISITS) {
    return json({ error: 'KV not bound' }, 500, corsHeaders);
  }

  const days = Math.min(parseInt(url.searchParams.get('days')) || 1, 30);
  const result = {};

  for (let d = 0; d < days; d++) {
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const prefix = `v:${date}:`;
    const list = await env.VISITS.list({ prefix, limit: 1000 });
    const visits = [];
    for (const key of list.keys) {
      const val = await env.VISITS.get(key.name, 'json');
      if (val) visits.push(val);
    }
    result[date] = { count: visits.length, visits };
  }

  return json(result, 200, corsHeaders);
}

// ── Helpers ──────────────────────────────────────────────────────

function docToComment(doc) {
  const f = doc.fields || {};
  const name = doc.name || '';
  const id = name.split('/').pop();
  return {
    id,
    page_path: f.page_path?.stringValue ?? '',
    author_name: f.author_name?.stringValue ?? '',
    content: f.content?.stringValue ?? '',
    created_at: f.created_at?.timestampValue ?? null,
    parent_id: f.parent_id?.stringValue ?? null,
  };
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
