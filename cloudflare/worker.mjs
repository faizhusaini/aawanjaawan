const LIMITS = {
  name: 60,
  phone: 24,
  route: 3,
  date: 10,
  mode: 20,
  help: 40,
  note: 350,
  type: 7,
};

export function indiaToday(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function validatePost(input, today = indiaToday()) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid post.');
  const post = {};
  for (const [key, limit] of Object.entries(LIMITS)) {
    const value = input[key] ?? (key === 'note' ? '' : null);
    if (
      typeof value !== 'string' ||
      (key !== 'note' && !value.trim()) ||
      value.trim().length > limit
    ) {
      throw new Error(`Please check your ${key}.`);
    }
    post[key] = value.trim();
  }
  if (
    !['lko', 'hyd'].includes(post.route) ||
    !['trip', 'request'].includes(post.type)
  )
    throw new Error('Choose a valid route and post type.');
  const modes =
    post.type === 'trip'
      ? ['Flight', 'Train', 'Car', 'Not decided']
      : ['Any mode', 'Flight', 'Train', 'Car', 'Not decided'];
  const helps =
    post.type === 'trip'
      ? [
          'Just sharing my trip',
          'A small parcel',
          'Travel company',
          'Anything I can',
        ]
      : ['Find a traveller', 'A small parcel', 'Travel company', 'Other'];
  if (!modes.includes(post.mode))
    throw new Error('Choose a valid travel mode.');
  if (!helps.includes(post.help))
    throw new Error('Choose a valid help option.');
  const parsed = new Date(post.date + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(post.date) ||
    isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== post.date ||
    post.date < today
  )
    throw new Error('Choose today or a future travel date.');
  const digits = post.phone.replace(/\D/g, '');
  if (!/^[+0-9 ()-]+$/.test(post.phone) || !/^\d{10,15}$/.test(digits))
    throw new Error('Enter a valid WhatsApp number including country code.');
  post.phone = '+' + (digits.length === 10 ? '91' : '') + digits;
  return post;
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}

async function readJson(request) {
  // Enforce the real body size, including chunked bodies without Content-Length.
  if (Number(request.headers.get('Content-Length') || 0) > 8192)
    throw new Error('Please keep your post short.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid post.');
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new Error('Please keep your post short.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Please send a valid JSON post.');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Keep one canonical public address when www is attached as a custom domain.
    if (url.hostname === 'www.aawanjaawan.fun') {
      url.hostname = 'aawanjaawan.fun';
      return Response.redirect(url.toString(), 308);
    }
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    if (url.pathname === '/api/health' && request.method === 'GET') {
      try {
        if (!env.DB) throw new Error('Missing database binding');
        await env.DB.prepare('SELECT id FROM posts LIMIT 1').all();
        return json({ ok: true, storage: 'd1' });
      } catch {
        return json(
          { ok: false, error: 'Community database is not ready.' },
          503,
        );
      }
    }
    if (url.pathname !== '/api/posts')
      return json({ error: 'Not found.' }, 404);
    if (!['GET', 'POST'].includes(request.method))
      return json({ error: 'Method not allowed.' }, 405, {
        Allow: 'GET, POST',
      });
    if (!env.DB)
      return json({ error: 'Community database is not configured yet.' }, 503);
    if (request.method === 'GET') {
      try {
        const result = await env.DB.prepare(
          "SELECT id,name,phone,route,date,mode,help,note,type,created FROM posts WHERE status='active' AND date>=? ORDER BY created DESC",
        )
          .bind(indiaToday())
          .all();
        return json(result.results);
      } catch {
        return json(
          { error: 'Unable to load community posts. Please try again.' },
          503,
        );
      }
    }
    // Browsers can only post from the same site; no permissive CORS endpoint.
    const origin = request.headers.get('Origin');
    if (
      (origin && origin !== url.origin) ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site'
    ) {
      return json({ error: 'Please post from the community board.' }, 403);
    }
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers.get('Content-Type') || '',
      )
    ) {
      return json({ error: 'Send posts as application/json.' }, 415);
    }
    let post;
    try {
      post = validatePost(await readJson(request));
    } catch (error) {
      return json({ error: error.message }, 400);
    }
    post.id = 'post-' + crypto.randomUUID();
    post.created = Date.now();
    try {
      await env.DB.prepare(
        'INSERT INTO posts (id,name,phone,route,date,mode,help,note,type,created,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      )
        .bind(
          post.id,
          post.name,
          post.phone,
          post.route,
          post.date,
          post.mode,
          post.help,
          post.note,
          post.type,
          post.created,
          'active',
        )
        .run();
      return json(post, 201);
    } catch {
      return json(
        {
          error:
            'Unable to confirm your post was saved. Check the board before retrying.',
        },
        503,
      );
    }
  },
};
