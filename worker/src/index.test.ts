// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { GITHUB_TOKEN_URL, type Env } from './index';

const env: Env = { GITHUB_CLIENT_ID: 'Iv1.test', GITHUB_CLIENT_SECRET: 'shh', ALLOWED_ORIGINS: 'https://timea-ve.github.io, http://localhost:5173' };
const ORIGIN = 'https://timea-ve.github.io';

function req(path: string, init: { method?: string; origin?: string | null; body?: unknown; raw?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.origin !== null) headers.Origin = init.origin ?? ORIGIN;
  const body = init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined);
  return new Request(`https://auth.example.workers.dev${path}`, { method: init.method ?? 'POST', headers, body });
}

function mockGitHub(response: unknown = { access_token: 'ghu_x', refresh_token: 'ghr_y', expires_in: 28800 }, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('auth worker', () => {
  it('exchanges a code, adding the client id + secret, and returns GitHub’s JSON', async () => {
    const fetchMock = mockGitHub();
    const res = await worker.fetch(req('/token', { body: { code: 'abc123' } }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ access_token: 'ghu_x', refresh_token: 'ghr_y', expires_in: 28800 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GITHUB_TOKEN_URL);
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ client_id: 'Iv1.test', client_secret: 'shh', code: 'abc123' });
  });

  it('refreshes with grant_type=refresh_token', async () => {
    const fetchMock = mockGitHub();
    const res = await worker.fetch(req('/refresh', { origin: 'http://localhost:5173', body: { refresh_token: 'ghr_abc.def' } }), env);
    expect(res.status).toBe(200);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ client_id: 'Iv1.test', client_secret: 'shh', grant_type: 'refresh_token', refresh_token: 'ghr_abc.def' });
  });

  it('passes GitHub errors through', async () => {
    mockGitHub({ error: 'bad_verification_code', error_description: 'expired' });
    const res = await worker.fetch(req('/token', { body: { code: 'old' } }), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ error: 'bad_verification_code' });
  });

  it('answers CORS preflight for allowed origins', async () => {
    const res = await worker.fetch(req('/token', { method: 'OPTIONS' }), env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });

  it('rejects other origins (and missing Origin) with 403, without calling GitHub', async () => {
    const fetchMock = mockGitHub();
    for (const origin of ['https://evil.example', null]) {
      const res = await worker.fetch(req('/token', { origin, body: { code: 'abc' } }), env);
      expect(res.status).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
    const pre = await worker.fetch(req('/token', { method: 'OPTIONS', origin: 'https://evil.example' }), env);
    expect(pre.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the default origin list when ALLOWED_ORIGINS is unset', async () => {
    mockGitHub();
    const res = await worker.fetch(req('/token', { origin: 'http://localhost:5180', body: { code: 'abc' } }), { ...env, ALLOWED_ORIGINS: undefined });
    expect(res.status).toBe(200);
  });

  it('validates the input shape and size', async () => {
    const fetchMock = mockGitHub();
    const bad = [
      req('/token', { raw: 'not json' }),
      req('/token', { body: [] }),
      req('/token', { body: { code: 42 } }),
      req('/token', { body: { code: 'has spaces' } }),
      req('/token', { body: {} }),
      req('/refresh', { body: { code: 'abc' } }),
      req('/refresh', { body: { refresh_token: 'x'.repeat(1025) } }),
      req('/token', { raw: JSON.stringify({ code: 'a', pad: 'x'.repeat(4000) }) }),
    ];
    for (const r of bad) expect((await worker.fetch(r, env)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('404s unknown paths and 405s non-POST methods', async () => {
    mockGitHub();
    expect((await worker.fetch(req('/nope', { body: { code: 'a' } }), env)).status).toBe(404);
    expect((await worker.fetch(req('/token', { method: 'GET' }), env)).status).toBe(405);
  });

  it('reports a missing secret as a server error', async () => {
    mockGitHub();
    const res = await worker.fetch(req('/token', { body: { code: 'a' } }), { ...env, GITHUB_CLIENT_SECRET: '' });
    expect(res.status).toBe(500);
  });

  it('returns 502 when GitHub is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    const res = await worker.fetch(req('/token', { body: { code: 'a' } }), env);
    expect(res.status).toBe(502);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });
});
