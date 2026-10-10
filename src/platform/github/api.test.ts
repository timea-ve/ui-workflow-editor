import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64, encodeBase64, findBoardsRepo, githubBoardsApi, isBoardId } from './api';
import { saveAuth } from './auth';

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockApi(handler: Handler) {
  const fn = vi.fn(async (url: string, init: RequestInit) => handler(new URL(url), init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => { localStorage.clear(); saveAuth({ accessToken: 'tok' }); });
afterEach(() => vi.unstubAllGlobals());

describe('base64', () => {
  it('round-trips UTF-8 (emoji, accents) and large text', () => {
    const text = `Café ✓ 🚀 ${'x'.repeat(100_000)}`;
    expect(decodeBase64(encodeBase64(text))).toBe(text);
    expect(decodeBase64('SGk=\n')).toBe('Hi');
  });
});

describe('findBoardsRepo', () => {
  it('finds ui-workflow-boards across installations, preferring the user’s own', async () => {
    mockApi((url) => {
      if (url.pathname === '/user/installations') return jsonRes({ installations: [{ id: 1 }, { id: 2 }] });
      if (url.pathname === '/user/installations/1/repositories') return jsonRes({ repositories: [{ name: 'ui-workflow-boards', owner: { login: 'some-org' } }] });
      if (url.pathname === '/user/installations/2/repositories') return jsonRes({ repositories: [{ name: 'other', owner: { login: 'Timea-VE' } }, { name: 'ui-workflow-boards', owner: { login: 'Timea-VE' }, default_branch: 'trunk' }] });
      return jsonRes({}, 404);
    });
    expect(await findBoardsRepo('timea-ve')).toEqual({ owner: 'Timea-VE', name: 'ui-workflow-boards', branch: 'trunk' });
  });

  it('returns null when the app has no access to the repo', async () => {
    mockApi((url) => url.pathname === '/user/installations' ? jsonRes({ installations: [] }) : jsonRes({}, 404));
    expect(await findBoardsRepo('timea-ve')).toBeNull();
  });
});

describe('githubBoardsApi', () => {
  const api = githubBoardsApi({ owner: 'timea-ve', name: 'ui-workflow-boards', branch: 'main' });
  const path = '/repos/timea-ve/ui-workflow-boards/contents/boards';

  it('sends the token in the header only, with GitHub’s API headers', async () => {
    const fetchMock = mockApi(() => jsonRes([]));
    await api.list();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('tok');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
  });

  it('lists board files (ignoring others) and treats a missing folder as empty', async () => {
    mockApi(() => jsonRes([
      { name: 'abc.json', sha: 's1', type: 'file' },
      { name: 'README.md', sha: 's2', type: 'file' },
      { name: 'x.json', sha: 's3', type: 'dir' },
      { name: '../evil.json', sha: 's4', type: 'file' },
    ]));
    expect(await api.list()).toEqual([{ id: 'abc', sha: 's1' }]);
    mockApi(() => jsonRes({ message: 'Not Found' }, 404));
    expect(await api.list()).toEqual([]);
  });

  it('gets, puts (with sha + branch) and deletes files', async () => {
    const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
    mockApi((url, init) => {
      calls.push({ method: init.method ?? 'GET', path: url.pathname, body: init.body ? JSON.parse(init.body as string) : undefined });
      if (init.method === 'PUT') return jsonRes({ content: { sha: 'new' } });
      if (init.method === 'DELETE') return jsonRes({ commit: {} });
      if (url.pathname.endsWith('/gone.json')) return jsonRes({}, 404);
      return jsonRes({ content: encodeBase64('{"ü":1}'), encoding: 'base64', sha: 'old' });
    });
    expect(await api.get('abc')).toEqual({ text: '{"ü":1}', sha: 'old' });
    expect(await api.get('gone')).toBeNull();
    expect(await api.put('abc', 'hello ✓', 'old', 'Save')).toEqual({ sha: 'new' });
    await api.remove('abc', 'new', 'Delete');
    expect(calls[2]).toEqual({ method: 'PUT', path: `${path}/abc.json`, body: { message: 'Save', content: encodeBase64('hello ✓'), branch: 'main', sha: 'old' } });
    expect(calls[3]).toEqual({ method: 'DELETE', path: `${path}/abc.json`, body: { message: 'Delete', sha: 'new', branch: 'main' } });
  });

  it('raises sha mismatches and network failures as typed errors', async () => {
    mockApi(() => jsonRes({ message: 'sha mismatch' }, 409));
    await expect(api.put('abc', 'x', 'old', 'Save')).rejects.toMatchObject({ status: 409, isConflict: true });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(api.list()).rejects.toMatchObject({ status: 0, isTransient: true });
  });

  it('validates board ids', () => {
    expect(isBoardId('V1StGXR8_Z5jdHi6B-myT')).toBe(true);
    expect(isBoardId('../x')).toBe(false);
    expect(isBoardId('')).toBe(false);
  });
});
