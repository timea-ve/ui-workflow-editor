// GitHub sign-in (GitHub App user-to-server OAuth, web flow). Tokens are kept in this browser only
// (localStorage `fs:github:v1`) and are only ever sent to api.github.com and our token worker, in
// headers or POST bodies — never in URLs, never logged. See docs/GITHUB-SAVE.md.
import { callbackUrl, githubConfig, type GitHubConfig } from './config';

export const AUTH_KEY = 'fs:github:v1';
export const OAUTH_KEY = 'fs:github-oauth:v1';
/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_MS = 5 * 60_000;

export interface GitHubUser {
  login: string;
  avatarUrl: string;
}

export interface StoredAuth {
  accessToken: string;
  refreshToken?: string;
  /** ms epoch; absent = the token doesn't expire. */
  expiresAt?: number;
  refreshExpiresAt?: number;
  user?: GitHubUser;
}

export type AuthState =
  | { status: 'signed-out'; reason?: 'expired' }
  | { status: 'signed-in'; auth: StoredAuth };

/** What the worker passes back from GitHub's token endpoint. */
export interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

export class AuthError extends Error {
  readonly code: string;
  constructor(code: string, message = code) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

// ---------- stored state ----------

const EXPIRED_KEY = 'fs:github-expired:v1';
const listeners = new Set<() => void>();
let cached: { raw: string | null; expired: string | null; state: AuthState } | undefined;

function parse(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as StoredAuth;
    return v && typeof v.accessToken === 'string' && v.accessToken ? v : null;
  } catch {
    return null;
  }
}

/** Stable snapshot (same object until storage changes), so it works with useSyncExternalStore. */
export function getAuthState(): AuthState {
  let raw: string | null = null;
  let expired: string | null = null;
  try {
    raw = localStorage.getItem(AUTH_KEY);
    expired = localStorage.getItem(EXPIRED_KEY);
  } catch { /* storage blocked → signed out */ }
  if (cached && cached.raw === raw && cached.expired === expired) return cached.state;
  const auth = parse(raw);
  const state: AuthState = auth ? { status: 'signed-in', auth } : expired ? { status: 'signed-out', reason: 'expired' } : { status: 'signed-out' };
  cached = { raw, expired, state };
  return state;
}

function emit() {
  listeners.forEach((l) => l());
}

export function saveAuth(auth: StoredAuth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  localStorage.removeItem(EXPIRED_KEY);
  emit();
}

/** Forgets the tokens. Boards stay on this device and in GitHub. */
export function signOut(reason?: 'expired') {
  try {
    localStorage.removeItem(AUTH_KEY);
    if (reason) localStorage.setItem(EXPIRED_KEY, '1');
    else localStorage.removeItem(EXPIRED_KEY);
  } catch { /* ignore */ }
  emit();
}

export function subscribeAuth(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === AUTH_KEY || e.key === EXPIRED_KEY || e.key === null) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

// ---------- pure helpers (unit-tested) ----------

export function tokensFromResponse(res: TokenResponse, now = Date.now(), prev?: StoredAuth): StoredAuth {
  if (res.error || !res.access_token) throw new AuthError(res.error ?? 'no_token', res.error_description ?? 'GitHub did not return a token');
  return {
    accessToken: res.access_token,
    ...(res.refresh_token ? { refreshToken: res.refresh_token } : {}),
    ...(res.expires_in ? { expiresAt: now + res.expires_in * 1000 } : {}),
    ...(res.refresh_token_expires_in ? { refreshExpiresAt: now + res.refresh_token_expires_in * 1000 } : {}),
    ...(prev?.user ? { user: prev.user } : {}),
  };
}

/** True when the access token is expired or about to be (and so should be refreshed first). */
export function needsRefresh(auth: StoredAuth, now = Date.now(), margin = REFRESH_MARGIN_MS): boolean {
  return auth.expiresAt !== undefined && auth.expiresAt - now <= margin;
}

/** A refresh can only work while there is an unexpired refresh token. */
export function canRefresh(auth: StoredAuth, now = Date.now()): boolean {
  return !!auth.refreshToken && (auth.refreshExpiresAt === undefined || auth.refreshExpiresAt > now);
}

export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function authorizeUrl(config: Pick<GitHubConfig, 'clientId'>, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, state });
  return `https://github.com/login/oauth/authorize?${q}`;
}

export interface PendingOAuth {
  state?: string;
  /** App path to return to, e.g. "/b/abc" (relative to the router basename). */
  returnTo: string;
  /** Set when "Give access" was clicked in this tab; the only case where a state-less return is accepted. */
  install?: boolean;
}

export type CallbackCheck =
  | { ok: true; code: string; install: boolean }
  | { ok: false; error: 'denied' | 'state' | 'missing' | 'no-code-install' };

/**
 * Validates GitHub's redirect. A normal sign-in must echo our `state`. After an app *installation*
 * GitHub may redirect here with `code` + `setup_action` but no state (request OAuth on install).
 */
export function checkCallback(params: URLSearchParams, pending: PendingOAuth | null): CallbackCheck {
  if (params.get('error')) return { ok: false, error: 'denied' };
  const code = params.get('code');
  const state = params.get('state');
  const setup = params.get('setup_action');
  if (!code) return setup ? { ok: false, error: 'no-code-install' } : { ok: false, error: 'missing' };
  if (state) {
    if (!pending?.state || pending.state !== state) return { ok: false, error: 'state' };
    return { ok: true, code, install: !!setup };
  }
  // No state: only trust it if this tab started an installation, so a crafted link can't sign
  // this browser into someone else's account (which would upload these boards to their repo).
  if (setup && pending?.install) return { ok: true, code, install: true };
  return { ok: false, error: 'state' };
}

/** A same-app path only (never an absolute URL), so the callback can't be turned into an open redirect. */
export function safeReturnTo(path: string | undefined | null): string {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

// ---------- browser flows ----------

export function readPendingOAuth(): PendingOAuth | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(OAUTH_KEY) ?? 'null') as PendingOAuth | null;
    return v && typeof v.returnTo === 'string' ? v : null;
  } catch {
    return null;
  }
}
export function clearPendingOAuth() {
  try { sessionStorage.removeItem(OAUTH_KEY); } catch { /* ignore */ }
}
/** Remembers where to come back to (used before sign-in and before "Give access"). */
export function rememberReturnTo(returnTo: string, state?: string, install = false) {
  try { sessionStorage.setItem(OAUTH_KEY, JSON.stringify({ returnTo: safeReturnTo(returnTo), ...(state ? { state } : {}), ...(install ? { install } : {}) })); } catch { /* ignore */ }
}

/** Current in-app path (without the router basename). */
export function currentAppPath(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const p = location.pathname.startsWith(`${base}/`) ? location.pathname.slice(base.length) : '/';
  return `${p}${location.search}`;
}

export function startSignIn(returnTo = currentAppPath(), config = githubConfig) {
  if (!config) return;
  const state = randomState();
  rememberReturnTo(returnTo, state);
  location.assign(authorizeUrl(config, callbackUrl(), state));
}

async function postWorker(path: 'token' | 'refresh', body: Record<string, string>, config = githubConfig): Promise<TokenResponse> {
  if (!config) throw new AuthError('not_configured');
  let res: Response;
  try {
    res = await fetch(`${config.workerUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new AuthError('network', 'Could not reach the sign-in service');
  }
  let json: TokenResponse;
  try {
    json = await res.json() as TokenResponse;
  } catch {
    throw new AuthError('bad_response');
  }
  if (!res.ok && !json.error) throw new AuthError(`http_${res.status}`);
  return json;
}

export async function exchangeCode(code: string): Promise<StoredAuth> {
  return tokensFromResponse(await postWorker('token', { code }));
}

export async function fetchUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    cache: 'no-store',
  });
  if (!res.ok) throw new AuthError(`http_${res.status}`);
  const u = await res.json() as { login: string; avatar_url: string };
  return { login: u.login, avatarUrl: u.avatar_url };
}

let refreshing: Promise<StoredAuth | null> | undefined;

/**
 * Swaps the refresh token for new tokens. On a definite failure (GitHub says no) the user is signed
 * out with a calm "Sign in again"; on a network failure the old tokens are kept and `null` returned.
 */
export function refreshTokens(): Promise<StoredAuth | null> {
  refreshing ??= (async () => {
    const state = getAuthState();
    if (state.status !== 'signed-in') return null;
    const { auth } = state;
    if (!canRefresh(auth)) { signOut('expired'); return null; }
    try {
      const next = tokensFromResponse(await postWorker('refresh', { refresh_token: auth.refreshToken! }), Date.now(), auth);
      saveAuth(next);
      return next;
    } catch (e) {
      if (e instanceof AuthError && e.code === 'network') return null;
      signOut('expired');
      return null;
    }
  })().finally(() => { refreshing = undefined; });
  return refreshing;
}

/** A usable access token, refreshing first if it's about to expire. `null` = signed out / unreachable. */
export async function getAccessToken(): Promise<string | null> {
  const state = getAuthState();
  if (state.status !== 'signed-in') return null;
  if (!needsRefresh(state.auth)) return state.auth.accessToken;
  const next = await refreshTokens();
  if (next) return next.accessToken;
  // Refresh unreachable but the token may still be valid for a few minutes.
  const now = getAuthState();
  return now.status === 'signed-in' && (now.auth.expiresAt ?? Infinity) > Date.now() ? now.auth.accessToken : null;
}
