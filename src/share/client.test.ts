import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDoc } from '../flow/ops';
import { createBoardMeta, getBoard } from '../platform/boardIndex';
import { fetchShare, getShareState, publishShare, revokeShare, ShareError } from './client';

type Call = { url: string; init: RequestInit };
let calls: Call[];
let replies: (Response | Error)[];

function reply(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  localStorage.clear();
  calls = [];
  replies = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = replies.shift();
    if (!r) throw new Error('unexpected fetch');
    if (r instanceof Error) throw r;
    return r;
  }));
});
afterEach(() => vi.unstubAllGlobals());

const ID = 'a'.repeat(22);
const TOKEN = 't'.repeat(43);

describe('share client', () => {
  it('first publish POSTs, stores the token and sets the board shareId', async () => {
    const board = createBoardMeta({ title: 'Checkout' });
    const before = getBoard(board.id)!.updatedAt;
    replies.push(reply(201, { id: ID, editToken: TOKEN }));
    const out = await publishShare(board.id, 'Checkout', emptyDoc());
    expect(out).toEqual({ url: `${location.origin}/s/${ID}`, id: ID, created: true });
    expect(calls[0].url).toBe('/api/shares');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ title: 'Checkout' });
    expect(JSON.parse(localStorage.getItem('fs:shares:v1')!)[board.id]).toMatchObject({ id: ID, editToken: TOKEN });
    expect(getShareState(board.id)?.url).toBe(out.url);
    expect(getBoard(board.id)?.shareId).toBe(ID);
    expect(getBoard(board.id)?.updatedAt).toBe(before);
  });

  it('republish PUTs to the same link with the edit token', async () => {
    const board = createBoardMeta();
    replies.push(reply(201, { id: ID, editToken: TOKEN }), reply(200, { id: ID, updatedAt: 1 }));
    await publishShare(board.id, 'x', emptyDoc());
    const out = await publishShare(board.id, 'x', emptyDoc());
    expect(out.created).toBe(false);
    expect(calls[1].url).toBe(`/api/shares/${ID}`);
    expect(calls[1].init.method).toBe('PUT');
    expect((calls[1].init.headers as Record<string, string>)['x-edit-token']).toBe(TOKEN);
  });

  it('falls back to a new link when the old one is gone', async () => {
    const board = createBoardMeta();
    const NEW = 'b'.repeat(22);
    replies.push(reply(201, { id: ID, editToken: TOKEN }), reply(410), reply(201, { id: NEW, editToken: TOKEN }));
    await publishShare(board.id, 'x', emptyDoc());
    const out = await publishShare(board.id, 'x', emptyDoc());
    expect(out).toMatchObject({ id: NEW, created: true });
    expect(getBoard(board.id)?.shareId).toBe(NEW);
  });

  it('maps server errors to calm error kinds', async () => {
    const board = createBoardMeta();
    replies.push(reply(413));
    await expect(publishShare(board.id, 'x', emptyDoc())).rejects.toMatchObject({ kind: 'too-large' });
    replies.push(reply(429));
    await expect(publishShare(board.id, 'x', emptyDoc())).rejects.toMatchObject({ kind: 'rate-limited' });
    replies.push(new TypeError('Failed to fetch'));
    await expect(publishShare(board.id, 'x', emptyDoc())).rejects.toMatchObject({ kind: 'network' });
    expect(getShareState(board.id)).toBeNull();
  });

  it('revoke DELETEs, then forgets the link and clears shareId', async () => {
    const board = createBoardMeta();
    replies.push(reply(201, { id: ID, editToken: TOKEN }), reply(200, { id: ID, revoked: true }));
    await publishShare(board.id, 'x', emptyDoc());
    await revokeShare(board.id);
    expect(calls[1].init.method).toBe('DELETE');
    expect(getShareState(board.id)).toBeNull();
    expect(getBoard(board.id)?.shareId).toBeUndefined();
  });

  it('revoke treats an already-gone link as success but keeps state on a network error', async () => {
    const board = createBoardMeta();
    replies.push(reply(201, { id: ID, editToken: TOKEN }), new TypeError('offline'));
    await publishShare(board.id, 'x', emptyDoc());
    await expect(revokeShare(board.id)).rejects.toBeInstanceOf(ShareError);
    expect(getShareState(board.id)).not.toBeNull();
    replies.push(reply(410));
    await revokeShare(board.id);
    expect(getShareState(board.id)).toBeNull();
  });

  it('fetchShare returns the snapshot or a typed error', async () => {
    replies.push(reply(200, { title: 'T', doc: emptyDoc(), updatedAt: 5 }));
    await expect(fetchShare(ID)).resolves.toMatchObject({ title: 'T', updatedAt: 5 });
    replies.push(reply(404));
    await expect(fetchShare(ID)).rejects.toMatchObject({ kind: 'not-found' });
    replies.push(reply(410));
    await expect(fetchShare(ID)).rejects.toMatchObject({ kind: 'revoked' });
    replies.push(reply(500));
    await expect(fetchShare(ID)).rejects.toMatchObject({ kind: 'server' });
  });
});
