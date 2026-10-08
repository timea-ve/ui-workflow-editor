// Share-link API (read-only snapshots of a board). Framework: Hono — runs in Vite dev/preview
// (see vite.config.ts) and on Vercel Functions (see server/vercel.ts) unchanged.
//
//   POST   /api/shares            {title, doc}        → 201 {id, editToken}
//   PUT    /api/shares/:id        x-edit-token, {title, doc} → 200 {id, updatedAt}
//   DELETE /api/shares/:id        x-edit-token        → 200 {id, revoked: true}
//   GET    /api/shares/:id                            → 200 {title, doc, updatedAt} | 404 | 410
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { nanoid } from 'nanoid';
import type { ShareStore } from './store.ts';
import { validateBoardDoc, validateTitle } from './validate.ts';

export const MAX_BODY_BYTES = 5 * 1024 * 1024;
export const ID_LENGTH = 22;
const ID_RE = /^[A-Za-z0-9_-]{22}$/;

export interface ShareApiOptions {
  store: ShareStore;
  /** Write requests (POST/PUT/DELETE) allowed per IP per window. Default 30/min. */
  rateLimit?: { max: number; windowMs: number };
  /** Override how the client IP is read (tests, other hosts). */
  getIp?: (c: Context) => string;
  now?: () => number;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison of a presented token against the stored hash. */
export function tokenMatches(presented: string | undefined, storedHash: string): boolean {
  if (!presented) return false;
  const a = Buffer.from(hashToken(presented), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function defaultIp(c: Context): string {
  const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (fwd) return fwd;
  const real = c.req.header('x-real-ip');
  if (real) return real;
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? 'unknown';
}

/** Fixed-window in-memory counter. Per process — good enough for one dev server / one function instance. */
function createRateLimiter(max: number, windowMs: number, now: () => number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): { ok: boolean; retryAfter: number } => {
    const t = now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return { ok: true, retryAfter: 0 };
    }
    entry.count++;
    return { ok: entry.count <= max, retryAfter: Math.ceil((entry.resetAt - t) / 1000) };
  };
}

export function createShareApi(opts: ShareApiOptions) {
  const { store } = opts;
  const now = opts.now ?? Date.now;
  const getIp = opts.getIp ?? defaultIp;
  const limit = opts.rateLimit ?? { max: 30, windowMs: 60_000 };
  const allow = createRateLimiter(limit.max, limit.windowMs, now);

  const app = new Hono().basePath('/api/shares');

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
  });

  app.on(['POST', 'PUT', 'DELETE'], '*', async (c, next) => {
    const r = allow(getIp(c));
    if (!r.ok) {
      c.header('Retry-After', String(r.retryAfter));
      return c.json({ error: 'Too many requests. Try again in a minute.' }, 429);
    }
    await next();
  });

  const limitBody = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'This board is too large to share (max 5 MB).' }, 413),
  });

  async function readPayload(c: Context) {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return { error: 'Body must be JSON' } as const;
    }
    if (typeof body !== 'object' || body === null) return { error: 'Body must be an object' } as const;
    const { title, doc } = body as { title?: unknown; doc?: unknown };
    const t = validateTitle(title);
    if (!t.ok) return { error: t.error } as const;
    const d = validateBoardDoc(doc);
    if (!d.ok) return { error: d.error } as const;
    return { title: t.value, doc: d.value } as const;
  }

  async function authorised(c: Context) {
    const id = c.req.param('id') ?? '';
    if (!ID_RE.test(id)) return { res: c.json({ error: 'Not found' }, 404) } as const;
    const rec = await store.get(id);
    if (!rec) return { res: c.json({ error: 'Not found' }, 404) } as const;
    if (!tokenMatches(c.req.header('x-edit-token'), rec.tokenHash)) return { res: c.json({ error: 'Forbidden' }, 403) } as const;
    if (rec.revokedAt) return { res: c.json({ error: 'This link has been turned off' }, 410) } as const;
    return { rec } as const;
  }

  app.post('/', limitBody, async (c) => {
    const p = await readPayload(c);
    if ('error' in p) return c.json({ error: p.error }, 400);
    const id = nanoid(ID_LENGTH);
    const editToken = randomBytes(32).toString('base64url');
    const t = now();
    await store.put({ id, title: p.title, doc: p.doc, tokenHash: hashToken(editToken), createdAt: t, updatedAt: t });
    return c.json({ id, editToken }, 201);
  });

  app.put('/:id', limitBody, async (c) => {
    const a = await authorised(c);
    if ('res' in a) return a.res;
    const p = await readPayload(c);
    if ('error' in p) return c.json({ error: p.error }, 400);
    const updatedAt = now();
    await store.put({ ...a.rec, title: p.title, doc: p.doc, updatedAt });
    return c.json({ id: a.rec.id, updatedAt });
  });

  app.delete('/:id', async (c) => {
    const a = await authorised(c);
    if ('res' in a) return a.res;
    const t = now();
    await store.put({ ...a.rec, doc: null, revokedAt: t, updatedAt: t });
    return c.json({ id: a.rec.id, revoked: true });
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    if (!ID_RE.test(id)) return c.json({ error: 'Not found' }, 404);
    const rec = await store.get(id);
    if (!rec) return c.json({ error: 'Not found' }, 404);
    if (rec.revokedAt) return c.json({ error: 'This link has been turned off' }, 410);
    return c.json({ title: rec.title, doc: rec.doc, updatedAt: rec.updatedAt });
  });

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    console.error('[share api]', err);
    return c.json({ error: 'Something went wrong on our side.' }, 500);
  });

  return app;
}

export type ShareApp = ReturnType<typeof createShareApi>;
