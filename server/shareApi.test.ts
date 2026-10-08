// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createShareApi, hashToken, tokenMatches, MAX_BODY_BYTES } from './shareApi';
import { MemoryShareStore } from './store';
import { validateBoardDoc } from './validate';

const doc = {
  frames: { f1: { id: 'f1', kind: 'frame', name: 'Sign up', device: 'mobile', x: 0, y: 0, w: 375, h: 812, z: 'a0' } },
  elements: { e1: { id: 'e1', type: 'button', parentId: 'f1', x: 20, y: 100, w: 120, h: 40, z: 'a0', props: { label: 'Go' } } },
  connectors: {},
  links: {},
  variants: {},
  flowNames: {},
};

function setup(rate = { max: 1000, windowMs: 60_000 }) {
  const store = new MemoryShareStore();
  const app = createShareApi({ store, rateLimit: rate, getIp: (c) => c.req.header('x-test-ip') ?? 'a' });
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { app, store, call };
}

async function create(call: ReturnType<typeof setup>['call']) {
  const res = await call('POST', '/api/shares', { title: 'My board', doc });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; editToken: string };
}

describe('share API', () => {
  it('creates and reads a snapshot', async () => {
    const { call, store } = setup();
    const { id, editToken } = await create(call);
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(editToken.length).toBeGreaterThanOrEqual(32);
    const stored = await store.get(id);
    expect(stored?.tokenHash).toBe(hashToken(editToken));
    expect(JSON.stringify(stored)).not.toContain(editToken);

    const res = await call('GET', `/api/shares/${id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    const body = await res.json();
    expect(body.title).toBe('My board');
    expect(body.doc.frames.f1.name).toBe('Sign up');
    expect(typeof body.updatedAt).toBe('number');
  });

  it('updates with the right token, keeps the same id', async () => {
    const { call } = setup();
    const { id, editToken } = await create(call);
    const next = { ...doc, frames: { f1: { ...doc.frames.f1, name: 'Welcome' } } };
    const res = await call('PUT', `/api/shares/${id}`, { title: 'Renamed', doc: next }, { 'x-edit-token': editToken });
    expect(res.status).toBe(200);
    const got = await (await call('GET', `/api/shares/${id}`)).json();
    expect(got.title).toBe('Renamed');
    expect(got.doc.frames.f1.name).toBe('Welcome');
  });

  it('rejects a wrong or missing token with 403', async () => {
    const { call } = setup();
    const { id } = await create(call);
    expect((await call('PUT', `/api/shares/${id}`, { title: 'x', doc }, { 'x-edit-token': 'nope' })).status).toBe(403);
    expect((await call('PUT', `/api/shares/${id}`, { title: 'x', doc })).status).toBe(403);
    expect((await call('DELETE', `/api/shares/${id}`, undefined, { 'x-edit-token': 'nope' })).status).toBe(403);
  });

  it('revokes: GET and PUT then answer 410', async () => {
    const { call, store } = setup();
    const { id, editToken } = await create(call);
    const del = await call('DELETE', `/api/shares/${id}`, undefined, { 'x-edit-token': editToken });
    expect(del.status).toBe(200);
    expect((await call('GET', `/api/shares/${id}`)).status).toBe(410);
    expect((await call('PUT', `/api/shares/${id}`, { title: 'x', doc }, { 'x-edit-token': editToken })).status).toBe(410);
    expect((await store.get(id))?.doc).toBeNull();
  });

  it('404s for unknown or malformed ids', async () => {
    const { call } = setup();
    expect((await call('GET', '/api/shares/aaaaaaaaaaaaaaaaaaaaaa')).status).toBe(404);
    expect((await call('GET', '/api/shares/..%2F..%2Fetc')).status).toBe(404);
    expect((await call('GET', '/api/shares/short')).status).toBe(404);
  });

  it('rejects oversize bodies with 413', async () => {
    const { call } = setup();
    const big = 'x'.repeat(MAX_BODY_BYTES + 10);
    const res = await call('POST', '/api/shares', { title: 'big', doc: { ...doc, flowNames: { a: big } } });
    expect(res.status).toBe(413);
  });

  it('rejects invalid payloads with 400', async () => {
    const { call } = setup();
    expect((await call('POST', '/api/shares', 'not json')).status).toBe(400);
    expect((await call('POST', '/api/shares', { title: 'x' })).status).toBe(400);
    expect((await call('POST', '/api/shares', { title: 'x', doc: { frames: [] } })).status).toBe(400);
    expect((await call('POST', '/api/shares', { title: 'x', doc: { ...doc, frames: { f1: { name: 'A', x: 'no' } } } })).status).toBe(400);
    expect((await call('POST', '/api/shares', { title: 42, doc })).status).toBe(400);
  });

  it('rate-limits writes per IP with 429', async () => {
    const { call } = setup({ max: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) expect((await call('POST', '/api/shares', { title: 't', doc })).status).toBe(201);
    const limited = await call('POST', '/api/shares', { title: 't', doc });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    // Another IP is unaffected; reads are never limited.
    expect((await call('POST', '/api/shares', { title: 't', doc }, { 'x-test-ip': 'b' })).status).toBe(201);
  });
});

describe('helpers', () => {
  it('tokenMatches is exact', () => {
    const h = hashToken('secret-token');
    expect(tokenMatches('secret-token', h)).toBe(true);
    expect(tokenMatches('secret-tokeN', h)).toBe(false);
    expect(tokenMatches(undefined, h)).toBe(false);
  });

  it('validateBoardDoc fills missing collections and keeps extra keys', () => {
    const r = validateBoardDoc({ frames: {}, elements: {}, future: { a: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.connectors).toEqual({});
      expect((r.value as unknown as Record<string, unknown>).future).toEqual({ a: 1 });
    }
  });
});
