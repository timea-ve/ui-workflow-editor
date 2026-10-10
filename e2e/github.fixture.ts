import { expect, type Page, type Route } from '@playwright/test';

// A fake GitHub (OAuth authorize page, token worker, REST API) for the "Save to GitHub" e2e tests.
// The app under test runs on the second Playwright web server (port 5181), built with dummy
// VITE_GITHUB_* values that point here.

export const GITHUB_BASE_URL = 'http://localhost:5181';
export const WORKER_URL = 'https://auth.test.example';
export const LOGIN = 'timea-ve';
export const REPO = 'ui-workflow-boards';
const AVATAR = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#888"/></svg>')}`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version',
};

export interface FakeBoard { id: string; title: string; updatedAt?: number; screen?: string }

export function boardFile(b: FakeBoard): string {
  const frames = b.screen
    ? { s1: { id: 's1', kind: 'frame', name: b.screen, device: 'mobile', x: 0, y: 0, w: 390, h: 844, z: 'a0' } }
    : {};
  return `${JSON.stringify({
    format: 'ui-workflow-editor/board',
    version: 1,
    board: { id: b.id, title: b.title, schemaVersion: 1, createdAt: 1, updatedAt: b.updatedAt ?? Date.now() },
    doc: { frames, elements: {}, connectors: {}, links: {}, variants: {}, flowNames: {} },
  }, null, 2)}\n`;
}

export class FakeGitHub {
  files = new Map<string, { text: string; sha: string }>();
  puts: { id: string; text: string }[] = [];
  deletes: string[] = [];
  /** false → the app hasn't been given access to the repo yet. */
  installed = true;
  private seq = 0;

  addBoard(b: FakeBoard) {
    this.files.set(b.id, { text: boardFile(b), sha: `sha${++this.seq}` });
  }
  board(id: string): { board: { title: string } } | null {
    const f = this.files.get(id);
    return f ? JSON.parse(f.text) : null;
  }

  async install(page: Page) {
    // GitHub's authorize page: approve at once and come back with the same state.
    await page.route('https://github.com/login/oauth/authorize**', (route) => {
      const url = new URL(route.request().url());
      const back = new URL(url.searchParams.get('redirect_uri')!);
      back.searchParams.set('code', 'test-code');
      back.searchParams.set('state', url.searchParams.get('state') ?? '');
      return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(back.toString())})</script>` });
    });
    await page.route(`${WORKER_URL}/**`, (route) => this.worker(route));
    await page.route('https://api.github.com/**', (route) => this.api(route));
  }

  private json(route: Route, body: unknown, status = 200) {
    return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  }

  private worker(route: Route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = req.postDataJSON() as { code?: string; refresh_token?: string };
    if (body.code !== 'test-code' && body.refresh_token !== 'ghr_test') return this.json(route, { error: 'bad_verification_code' });
    return this.json(route, { access_token: 'ghu_test', refresh_token: 'ghr_test', expires_in: 28800, refresh_token_expires_in: 15811200 });
  }

  private api(route: Route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    expect(req.headers().authorization).toBe('Bearer ghu_test');
    expect(req.url()).not.toContain('ghu_test');
    const url = new URL(req.url());
    const p = url.pathname;
    const contents = `/repos/${LOGIN}/${REPO}/contents/boards`;

    if (p === '/user') return this.json(route, { login: LOGIN, avatar_url: AVATAR });
    if (p === '/user/installations') return this.json(route, { installations: this.installed ? [{ id: 7 }] : [] });
    if (p === '/user/installations/7/repositories') {
      return this.json(route, { repositories: [{ name: REPO, owner: { login: LOGIN }, default_branch: 'main' }] });
    }
    if (p === `/repos/${LOGIN}/${REPO}`) {
      return this.installed ? this.json(route, { owner: { login: LOGIN }, default_branch: 'main' }) : this.json(route, { message: 'Not Found' }, 404);
    }
    if (p === contents && req.method() === 'GET') {
      if (this.files.size === 0) return this.json(route, { message: 'Not Found' }, 404);
      return this.json(route, [...this.files].map(([id, f]) => ({ name: `${id}.json`, sha: f.sha, type: 'file' })));
    }
    const m = p.startsWith(`${contents}/`) ? /^([\w-]+)\.json$/.exec(p.slice(contents.length + 1)) : null;
    if (m) {
      const id = m[1];
      const cur = this.files.get(id);
      if (req.method() === 'GET') {
        return cur
          ? this.json(route, { sha: cur.sha, encoding: 'base64', content: Buffer.from(cur.text, 'utf8').toString('base64') })
          : this.json(route, { message: 'Not Found' }, 404);
      }
      const body = req.postDataJSON() as { content?: string; sha?: string; branch?: string };
      if ((cur?.sha ?? undefined) !== body.sha) return this.json(route, { message: 'sha mismatch' }, cur ? 409 : 422);
      if (req.method() === 'PUT') {
        const text = Buffer.from(body.content ?? '', 'base64').toString('utf8');
        const next = { text, sha: `sha${++this.seq}` };
        this.files.set(id, next);
        this.puts.push({ id, text });
        return this.json(route, { content: { sha: next.sha } }, cur ? 200 : 201);
      }
      if (req.method() === 'DELETE') {
        this.files.delete(id);
        this.deletes.push(id);
        return this.json(route, { commit: {} });
      }
    }
    return this.json(route, { message: 'Not Found' }, 404);
  }
}

/** Already signed in (as after a successful callback). */
export async function seedSignedIn(page: Page) {
  await page.evaluate(({ login, avatar }) => {
    localStorage.setItem('fs:github:v1', JSON.stringify({
      accessToken: 'ghu_test', refreshToken: 'ghr_test', expiresAt: Date.now() + 8 * 3600_000,
      refreshExpiresAt: Date.now() + 180 * 86400_000, user: { login, avatarUrl: avatar },
    }));
  }, { login: LOGIN, avatar: AVATAR });
}
