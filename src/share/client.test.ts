import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDoc } from '../flow/ops';
import { createBoardMeta, getBoard } from '../platform/boardIndex';
import { getShareState, publishShare, revokeShare } from './client';
import { decodeShare } from './link';

beforeEach(() => localStorage.clear());

function dataOf(url: string): string {
  const prefix = `${location.origin}/s/v1#`;
  expect(url.startsWith(prefix)).toBe(true);
  return url.slice(prefix.length);
}

describe('share client', () => {
  it('publish builds a link that carries the board, remembers it and sets shareId', async () => {
    const board = createBoardMeta({ title: 'Checkout' });
    const before = getBoard(board.id)!.updatedAt;
    const doc = emptyDoc();
    doc.flowNames = { f: 'Sign up' };
    const out = await publishShare(board.id, 'Checkout', doc);
    expect(out.created).toBe(true);
    await expect(decodeShare(dataOf(out.url))).resolves.toMatchObject({ title: 'Checkout', doc: { flowNames: { f: 'Sign up' } } });
    expect(JSON.parse(localStorage.getItem('fs:shares:v2')!)[board.id]).toMatchObject({ id: out.id, url: out.url });
    expect(getShareState(board.id)?.url).toBe(out.url);
    expect(getBoard(board.id)?.shareId).toBe(out.id);
    expect(getBoard(board.id)?.updatedAt).toBe(before);
  });

  it('updating replaces the link with the latest copy and keeps the board marker', async () => {
    const board = createBoardMeta();
    const first = await publishShare(board.id, 'Old', emptyDoc());
    const second = await publishShare(board.id, 'New', emptyDoc());
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(second.url).not.toBe(first.url);
    await expect(decodeShare(dataOf(second.url))).resolves.toMatchObject({ title: 'New' });
    expect(getShareState(board.id)?.url).toBe(second.url);
  });

  it('turning off forgets the link and clears shareId', async () => {
    const board = createBoardMeta();
    await publishShare(board.id, 'x', emptyDoc());
    await revokeShare(board.id);
    expect(getShareState(board.id)).toBeNull();
    expect(getBoard(board.id)?.shareId).toBeUndefined();
  });

  it('ignores links from the old share server', async () => {
    const board = createBoardMeta();
    localStorage.setItem('fs:shares:v1', JSON.stringify({ [board.id]: { id: 'a'.repeat(22), editToken: 't', publishedAt: 1 } }));
    expect(getShareState(board.id)).toBeNull();
  });
});
