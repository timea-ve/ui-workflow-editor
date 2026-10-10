// Token-exchange worker for "Save to GitHub" (Cloudflare Worker). The browser can't hold the GitHub
// App's client secret, so this adds it when swapping a sign-in code (or a refresh token) for tokens.
// It stores nothing and logs nothing. See docs/GITHUB-SAVE.md.
//
//   POST /token    { code }           → GitHub's JSON (access_token, refresh_token, expires_in, … or error)
//   POST /refresh  { refresh_token }  → same
//
// CORS: only origins listed in ALLOWED_ORIGINS may call it; everyone else gets 403.

export interface Env {
  GITHUB_CLIENT_ID: string;
  /** `npx wrangler secret put GITHUB_CLIENT_SECRET` */
  GITHUB_CLIENT_SECRET: string;
  /** Comma-separated origins, e.g. "https://timea-ve.github.io,http://localhost:5173". */
  ALLOWED_ORIGINS?: string;
}

export const DEFAULT_ALLOWED_ORIGINS = 'https://timea-ve.github.io,http://localhost:5173,http://localhost:5180';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const MAX_BODY_BYTES = 2048;

const CODE_RE = /^[A-Za-z0-9_-]{1,256}$/;
const TOKEN_RE = /^[A-Za-z0-9_.-]{1,1024}$/;

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS).split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
}

function json(body: unknown, status: number, origin?: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = origin !== '' && allowedOrigins(env).includes(origin);
  if (!allowed) return json({ error: 'origin_not_allowed' }, 403);

  const { pathname } = new URL(request.url);
  const route = pathname === '/token' ? 'token' : pathname === '/refresh' ? 'refresh' : null;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    });
  }
  if (!route) return json({ error: 'not_found' }, 404, origin);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return json({ error: 'server_misconfigured' }, 500, origin);

  const body = await readBody(request);
  if (!body) return json({ error: 'invalid_request' }, 400, origin);

  const params: Record<string, string> = { client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET };
  if (route === 'token') {
    if (typeof body.code !== 'string' || !CODE_RE.test(body.code)) return json({ error: 'invalid_request' }, 400, origin);
    params.code = body.code;
  } else {
    if (typeof body.refresh_token !== 'string' || !TOKEN_RE.test(body.refresh_token)) return json({ error: 'invalid_request' }, 400, origin);
    params.grant_type = 'refresh_token';
    params.refresh_token = body.refresh_token;
  }

  let upstream: Response;
  try {
    upstream = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'ui-workflow-editor-auth' },
      body: JSON.stringify(params),
    });
  } catch {
    return json({ error: 'upstream_unavailable' }, 502, origin);
  }
  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'upstream_unavailable' }, 502, origin);
  }
  // GitHub answers 200 even for errors ({ error: "bad_verification_code" }); pass it through as-is.
  return json(data, upstream.ok ? 200 : 502, origin);
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
