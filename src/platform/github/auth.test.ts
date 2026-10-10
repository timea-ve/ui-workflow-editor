import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_KEY, authorizeUrl, canRefresh, checkCallback, getAuthState, needsRefresh, randomState, safeReturnTo,
  saveAuth, signOut, tokensFromResponse, type StoredAuth,
} from './auth';
import { callbackUrl, readGitHubConfig } from './config';

const NOW = 1_700_000_000_000;
const params = (q: string) => new URLSearchParams(q);

describe('config', () => {
  it('is off unless all three values are set', () => {
    expect(readGitHubConfig({})).toBeNull();
    expect(readGitHubConfig({ VITE_GITHUB_CLIENT_ID: 'id', VITE_GITHUB_APP_SLUG: 'slug' })).toBeNull();
    expect(readGitHubConfig({ VITE_GITHUB_CLIENT_ID: ' ', VITE_GITHUB_APP_SLUG: 'slug', VITE_AUTH_WORKER_URL: 'https://w' })).toBeNull();
    expect(readGitHubConfig({ VITE_GITHUB_CLIENT_ID: 'id', VITE_GITHUB_APP_SLUG: 'slug', VITE_AUTH_WORKER_URL: 'https://w.dev//' }))
      .toEqual({ clientId: 'id', appSlug: 'slug', workerUrl: 'https://w.dev' });
  });

  it('builds the callback URL under the base path', () => {
    expect(callbackUrl('https://timea-ve.github.io', '/ui-workflow-editor/')).toBe('https://timea-ve.github.io/ui-workflow-editor/auth/callback');
    expect(callbackUrl('http://localhost:5173', '/')).toBe('http://localhost:5173/auth/callback');
  });
});

describe('sign-in redirect', () => {
  it('sends client_id, redirect_uri and state to GitHub', () => {
    const url = new URL(authorizeUrl({ clientId: 'Iv1.abc' }, 'http://localhost:5173/auth/callback', 'st8'));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: 'Iv1.abc', redirect_uri: 'http://localhost:5173/auth/callback', state: 'st8' });
  });

  it('makes unguessable states', () => {
    const a = randomState();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomState()).not.toBe(a);
  });

  it('only returns to same-app paths', () => {
    expect(safeReturnTo('/b/abc?x=1')).toBe('/b/abc?x=1');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
  });
});

describe('checkCallback', () => {
  const pending = { state: 'abc', returnTo: '/' };
  it('accepts a code with the matching state', () => {
    expect(checkCallback(params('code=c1&state=abc'), pending)).toEqual({ ok: true, code: 'c1', install: false });
  });
  it('rejects a wrong or unexpected state', () => {
    expect(checkCallback(params('code=c1&state=nope'), pending)).toEqual({ ok: false, error: 'state' });
    expect(checkCallback(params('code=c1&state=abc'), null)).toEqual({ ok: false, error: 'state' });
    expect(checkCallback(params('code=c1&state=abc'), { returnTo: '/' })).toEqual({ ok: false, error: 'state' });
  });
  it('rejects a code without state (unless it comes from an install)', () => {
    expect(checkCallback(params('code=c1'), pending)).toEqual({ ok: false, error: 'state' });
    expect(checkCallback(params('code=c1&installation_id=9&setup_action=install'), { returnTo: '/', install: true })).toEqual({ ok: true, code: 'c1', install: true });
    expect(checkCallback(params('code=c1&installation_id=9&setup_action=install'), null)).toEqual({ ok: false, error: 'state' });
    expect(checkCallback(params('code=c1&installation_id=9&setup_action=install'), { returnTo: '/' })).toEqual({ ok: false, error: 'state' });
    expect(checkCallback(params('code=c1&installation_id=9&setup_action=update'), { ...pending, install: true })).toEqual({ ok: true, code: 'c1', install: true });
  });
  it('reports cancel and missing code', () => {
    expect(checkCallback(params('error=access_denied&state=abc'), pending)).toEqual({ ok: false, error: 'denied' });
    expect(checkCallback(params(''), pending)).toEqual({ ok: false, error: 'missing' });
    expect(checkCallback(params('installation_id=9&setup_action=install'), null)).toEqual({ ok: false, error: 'no-code-install' });
  });
});

describe('tokens and expiry', () => {
  it('turns GitHub’s response into stored tokens with absolute expiry', () => {
    const auth = tokensFromResponse({ access_token: 'ghu_a', refresh_token: 'ghr_b', expires_in: 28800, refresh_token_expires_in: 15811200 }, NOW);
    expect(auth).toEqual({ accessToken: 'ghu_a', refreshToken: 'ghr_b', expiresAt: NOW + 28_800_000, refreshExpiresAt: NOW + 15_811_200_000 });
  });
  it('keeps the user across a refresh', () => {
    const prev: StoredAuth = { accessToken: 'old', user: { login: 'timea-ve', avatarUrl: 'a' } };
    expect(tokensFromResponse({ access_token: 'new' }, NOW, prev)).toEqual({ accessToken: 'new', user: prev.user });
  });
  it('throws on GitHub errors', () => {
    expect(() => tokensFromResponse({ error: 'bad_verification_code' })).toThrow(expect.objectContaining({ code: 'bad_verification_code' }));
    expect(() => tokensFromResponse({})).toThrow();
  });
  it('refreshes shortly before expiry, never for non-expiring tokens', () => {
    expect(needsRefresh({ accessToken: 'a', expiresAt: NOW + 60 * 60_000 }, NOW)).toBe(false);
    expect(needsRefresh({ accessToken: 'a', expiresAt: NOW + 4 * 60_000 }, NOW)).toBe(true);
    expect(needsRefresh({ accessToken: 'a', expiresAt: NOW - 1 }, NOW)).toBe(true);
    expect(needsRefresh({ accessToken: 'a' }, NOW)).toBe(false);
  });
  it('can only refresh with a live refresh token', () => {
    expect(canRefresh({ accessToken: 'a' }, NOW)).toBe(false);
    expect(canRefresh({ accessToken: 'a', refreshToken: 'r' }, NOW)).toBe(true);
    expect(canRefresh({ accessToken: 'a', refreshToken: 'r', refreshExpiresAt: NOW + 1 }, NOW)).toBe(true);
    expect(canRefresh({ accessToken: 'a', refreshToken: 'r', refreshExpiresAt: NOW }, NOW)).toBe(false);
  });
});

describe('stored sign-in', () => {
  beforeEach(() => localStorage.clear());

  it('saves, reads back a stable snapshot, and signs out (tokens only)', () => {
    localStorage.setItem('fs:boards:v1', '[]');
    expect(getAuthState()).toEqual({ status: 'signed-out' });
    saveAuth({ accessToken: 'ghu_a' });
    const s = getAuthState();
    expect(s).toEqual({ status: 'signed-in', auth: { accessToken: 'ghu_a' } });
    expect(getAuthState()).toBe(s);
    signOut();
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(localStorage.getItem('fs:boards:v1')).toBe('[]');
    expect(getAuthState()).toEqual({ status: 'signed-out' });
  });

  it('remembers an expired sign-out so the UI can say “Sign in again”', () => {
    saveAuth({ accessToken: 'ghu_a' });
    signOut('expired');
    expect(getAuthState()).toEqual({ status: 'signed-out', reason: 'expired' });
    saveAuth({ accessToken: 'ghu_b' });
    expect(getAuthState().status).toBe('signed-in');
  });

  it('treats corrupt storage as signed out', () => {
    localStorage.setItem(AUTH_KEY, '{nope');
    expect(getAuthState()).toEqual({ status: 'signed-out' });
  });
});

describe('token refresh (via the worker)', () => {
  const WORKER = 'https://auth.test.example';
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'Iv1.test');
    vi.stubEnv('VITE_GITHUB_APP_SLUG', 'test-app');
    vi.stubEnv('VITE_AUTH_WORKER_URL', WORKER);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const expiring = (): StoredAuth => ({ accessToken: 'old', refreshToken: 'ghr_old', expiresAt: Date.now() + 1000, user: { login: 'me', avatarUrl: '' } });

  it('refreshes an about-to-expire token before use, posting only to the worker', async () => {
    const auth = await import('./auth');
    auth.saveAuth(expiring());
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: 'new', refresh_token: 'ghr_new', expires_in: 28800 })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await auth.getAccessToken()).toBe('new');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${WORKER}/refresh`);
    expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'ghr_old' });
    const s = auth.getAuthState();
    expect(s.status === 'signed-in' && s.auth).toMatchObject({ accessToken: 'new', refreshToken: 'ghr_new', user: { login: 'me' } });
  });

  it('signs out calmly (reason: expired) when GitHub refuses the refresh', async () => {
    const auth = await import('./auth');
    auth.saveAuth(expiring());
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'bad_refresh_token' }))));
    expect(await auth.getAccessToken()).toBeNull();
    expect(auth.getAuthState()).toEqual({ status: 'signed-out', reason: 'expired' });
  });

  it('keeps the tokens when the worker is unreachable', async () => {
    const auth = await import('./auth');
    auth.saveAuth(expiring());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await auth.getAccessToken()).toBe('old'); // still valid for a moment
    expect(auth.getAuthState().status).toBe('signed-in');
  });

  it('retries an API call once after a 401 with refreshed tokens', async () => {
    const auth = await import('./auth');
    const api = await import('./api');
    auth.saveAuth({ ...expiring(), expiresAt: Date.now() + 3_600_000 });
    const seen: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url === `${WORKER}/refresh`) return new Response(JSON.stringify({ access_token: 'new' }));
      const authz = (init.headers as Record<string, string>).Authorization;
      seen.push(authz);
      expect(url).not.toContain('old');
      return authz === 'Bearer new'
        ? new Response(JSON.stringify({ ok: 1 }), { headers: { 'content-type': 'application/json' } })
        : new Response('', { status: 401 });
    }));
    expect(await api.gh('/user')).toEqual({ ok: 1 });
    expect(seen).toEqual(['Bearer old', 'Bearer new']);
  });
});
