/**
 * Vercel Serverless Function — Proxy between the blog and Firestore REST API.
 * Bypasses China's GFW block on googleapis.com / gstatic.com.
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'my-personal-web-413c5';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyB-DjO1mIz5HegiZwRvsBxfBlsVrRwteKo';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://arsene-flyingcat.github.io';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    }
    if (req.method === 'POST') {
      return await handlePost(req, res);
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}

// ── GET /api/comments?page_path=... ──────────────────────────────

async function handleGet(req, res) {
  const pagePath = req.query.page_path;
  if (!pagePath) {
    return res.status(400).json({ error: 'page_path query parameter is required' });
  }

  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents:runQuery?key=${API_KEY}`;

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
    return res.status(resp.status).json({ error: 'Firestore query failed', detail: text });
  }

  const raw = await resp.json();
  const comments = raw
    .filter((r) => r.document)
    .map((r) => docToComment(r.document));

  return res.status(200).json(comments);
}

// ── POST /api/comments ───────────────────────────────────────────

async function handlePost(req, res) {
  const body = req.body;

  // Honeypot
  if (body.website) {
    return res.status(400).json({ error: 'Spam detected' });
  }

  const { page_path, author_name, content, parent_id } = body;

  // Validation
  if (!page_path || typeof page_path !== 'string' || !page_path.startsWith('/')) {
    return res.status(400).json({ error: 'page_path is required and must start with /' });
  }
  if (!author_name || typeof author_name !== 'string' || author_name.trim().length === 0 || author_name.length > 50) {
    return res.status(400).json({ error: 'author_name is required (max 50 chars)' });
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 2000) {
    return res.status(400).json({ error: 'content is required (max 2000 chars)' });
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
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/comments?key=${API_KEY}`;

  const resp = await fetch(firestoreUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return res.status(resp.status).json({ error: 'Firestore write failed', detail: text });
  }

  const doc = await resp.json();
  return res.status(201).json(docToComment(doc));
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
