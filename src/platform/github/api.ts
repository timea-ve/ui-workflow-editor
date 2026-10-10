// Minimal GitHub REST client (fetch + bearer token; api.github.com allows CORS for this).
// The token goes in the Authorization header only — never in a URL or a log line.
import { BOARDS_REPO } from './config';
import { getAccessToken, getAuthState, refreshTokens, signOut } from './auth';

const API = 'https://api.github.com';
const BOARDS_DIR = 'boards';

export type RepoRef = { owner: string; name: string; branch: string };

export class GitHubError extends Error {
  /** 0 = network failure. */
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GitHubError';
  }
  get isConflict() { return this.status === 409 || this.status === 422; }
  get isNotFound() { return this.status === 404; }
  /** Worth retrying later: offline, rate-limited, or GitHub having a bad moment. */
  get isTransient() { return this.status === 0 || this.status === 403 || this.status === 429 || this.status >= 500; }
}

export class SignedOutError extends Error {
  constructor() {
    super('Not signed in to GitHub');
    this.name = 'SignedOutError';
  }
}

/** No usable token: signed out for real, or the sign-in service is unreachable (retry later). */
const noToken = () => (getAuthState().status === 'signed-in' ? new GitHubError(0, 'Could not refresh the GitHub sign-in') : new SignedOutError());

/** One authenticated request. Retries once with fresh tokens after a 401. */
export async function gh<T>(path: string, init: { method?: string; body?: unknown; accept?: string } = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken();
    if (!token) throw noToken();
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: init.accept ?? 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        // GitHub sends `Cache-Control: max-age=60`; a stale listing would hide other devices' changes.
        cache: 'no-store',
      });
    } catch {
      throw new GitHubError(0, 'Network error');
    }
    if (res.status === 401 && attempt === 0) {
      if (!(await refreshTokens())) throw noToken();
      continue;
    }
    if (res.status === 401) { signOut('expired'); throw new SignedOutError(); }
    if (!res.ok) throw new GitHubError(res.status, `GitHub ${init.method ?? 'GET'} ${path.split('?')[0]} → ${res.status}`);
    if (res.status === 204) return undefined as T;
    const type = res.headers.get('content-type') ?? '';
    return (type.includes('json') ? await res.json() : await res.text()) as T;
  }
  throw new SignedOutError();
}

// ---------- base64 (UTF-8 safe) ----------

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---------- repo discovery ----------

interface Installation { id: number }
interface Repo { name: string; owner: { login: string }; default_branch?: string }

/** The user's `ui-workflow-boards` repo, if the app has been given access to it. */
export async function findBoardsRepo(login: string): Promise<RepoRef | null> {
  const { installations } = await gh<{ installations: Installation[] }>('/user/installations?per_page=100');
  let fallback: RepoRef | null = null;
  for (const inst of installations ?? []) {
    for (let page = 1; page <= 10; page++) {
      const { repositories } = await gh<{ repositories: Repo[] }>(`/user/installations/${inst.id}/repositories?per_page=100&page=${page}`);
      for (const r of repositories ?? []) {
        if (r.name !== BOARDS_REPO) continue;
        const ref = { owner: r.owner.login, name: r.name, branch: r.default_branch || 'main' };
        if (r.owner.login.toLowerCase() === login.toLowerCase()) return ref;
        fallback ??= ref;
      }
      if (!repositories || repositories.length < 100) break;
    }
  }
  return fallback;
}

// ---------- board files (Contents API) ----------

export interface RemoteEntry { id: string; sha: string }

/** The calls the sync engine needs; `githubBoardsApi` is the real one, tests use a fake. */
export interface BoardsApi {
  list(): Promise<RemoteEntry[]>;
  get(id: string): Promise<{ text: string; sha: string } | null>;
  /** Creates (no sha) or updates (sha = the version being replaced). Throws GitHubError 409/422 on mismatch. */
  put(id: string, text: string, sha: string | undefined, message: string): Promise<{ sha: string }>;
  remove(id: string, sha: string, message: string): Promise<void>;
}

const FILE_RE = /^([A-Za-z0-9_-]{1,64})\.json$/;
export const isBoardId = (id: string) => FILE_RE.test(`${id}.json`);

export function githubBoardsApi(repo: RepoRef): BoardsApi {
  const base = `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents/${BOARDS_DIR}`;
  const ref = `ref=${encodeURIComponent(repo.branch)}`;
  return {
    async list() {
      try {
        const items = await gh<{ name: string; sha: string; type: string }[]>(`${base}?${ref}`);
        return (Array.isArray(items) ? items : []).flatMap((f) => {
          const m = f.type === 'file' ? FILE_RE.exec(f.name) : null;
          return m ? [{ id: m[1], sha: f.sha }] : [];
        });
      } catch (e) {
        if (e instanceof GitHubError && e.isNotFound) return []; // no boards/ folder yet
        throw e;
      }
    },
    async get(id) {
      try {
        const f = await gh<{ content?: string; encoding?: string; sha: string }>(`${base}/${id}.json?${ref}`);
        if (f.encoding === 'base64' && f.content) return { text: decodeBase64(f.content), sha: f.sha };
        // Files over 1 MB come back without content; ask for the raw bytes instead.
        const text = await gh<string>(`${base}/${id}.json?${ref}`, { accept: 'application/vnd.github.raw+json' });
        return { text: typeof text === 'string' ? text : JSON.stringify(text), sha: f.sha };
      } catch (e) {
        if (e instanceof GitHubError && e.isNotFound) return null;
        throw e;
      }
    },
    async put(id, text, sha, message) {
      const res = await gh<{ content: { sha: string } }>(`${base}/${id}.json`, {
        method: 'PUT',
        body: { message, content: encodeBase64(text), branch: repo.branch, ...(sha ? { sha } : {}) },
      });
      return { sha: res.content.sha };
    },
    async remove(id, sha, message) {
      await gh(`${base}/${id}.json`, { method: 'DELETE', body: { message, sha, branch: repo.branch } });
    },
  };
}
