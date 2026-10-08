import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardDoc } from '../model/types';
import * as persistence from '../store/persistence';
import { getBoard, listBoards } from './boardIndex';
import { BoardOpError, createBoard, deleteBoard, duplicateBoard, flushPendingDeletes, UNDO_WINDOW_MS } from './boards';

vi.mock('../store/persistence', () => ({
  writeInitialDoc: vi.fn(async () => {}),
  readBoardDoc: vi.fn(),
  deleteBoardData: vi.fn(async () => {}),
}));

const write = vi.mocked(persistence.writeInitialDoc);
const read = vi.mocked(persistence.readBoardDoc);
const del = vi.mocked(persistence.deleteBoardData);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  write.mockResolvedValue(undefined);
  del.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('createBoard', () => {
  it('creates a blank board with an empty doc', async () => {
    const b = await createBoard();
    expect(b.title).toBe('Untitled board');
    expect(getBoard(b.id)).toBeDefined();
    const doc = write.mock.calls[0][1];
    expect(write.mock.calls[0][0]).toBe(b.id);
    expect(Object.keys(doc.frames)).toHaveLength(0);
  });

  it('seeds a template board titled after the template', async () => {
    const b = await createBoard({ templateId: 'checkout' });
    expect(b.title).toBe('Checkout');
    expect(b.templateId).toBe('checkout');
    expect(Object.keys(write.mock.calls[0][1].frames)).toHaveLength(4);
  });

  it('honours a custom title', async () => {
    expect((await createBoard({ title: '  Q3 ideas ' })).title).toBe('Q3 ideas');
  });

  it('rejects unknown templates without creating anything', async () => {
    await expect(createBoard({ templateId: 'nope' })).rejects.toBeInstanceOf(BoardOpError);
    expect(listBoards()).toHaveLength(0);
    expect(write).not.toHaveBeenCalled();
  });

  it('rolls back the list row if content cannot be saved', async () => {
    write.mockRejectedValueOnce(new Error('quota'));
    await expect(createBoard({ templateId: 'signup' })).rejects.toMatchObject({ kind: 'create' });
    expect(listBoards()).toHaveLength(0);
  });
});

describe('duplicateBoard', () => {
  it('copies content into "Copy of …"', async () => {
    const src = await createBoard({ templateId: 'search' });
    const doc = write.mock.calls[0][1] as BoardDoc;
    read.mockResolvedValueOnce(doc);
    const copy = await duplicateBoard(src.id);
    expect(copy.id).not.toBe(src.id);
    expect(copy.title).toBe('Copy of Search');
    expect(write).toHaveBeenLastCalledWith(copy.id, doc);
    expect(listBoards()).toHaveLength(2);
  });

  it('fails cleanly when reading or writing fails', async () => {
    const src = await createBoard();
    read.mockRejectedValueOnce(new Error('idb'));
    await expect(duplicateBoard(src.id)).rejects.toMatchObject({ kind: 'duplicate' });
    read.mockResolvedValueOnce(write.mock.calls[0][1]);
    write.mockRejectedValueOnce(new Error('idb'));
    await expect(duplicateBoard(src.id)).rejects.toMatchObject({ kind: 'duplicate' });
    expect(listBoards().map((b) => b.id)).toEqual([src.id]);
  });

  it('reports missing boards', async () => {
    await expect(duplicateBoard('missing')).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('deleteBoard', () => {
  it('hides the board at once and deletes content after the undo window', async () => {
    vi.useFakeTimers();
    const b = await createBoard();
    deleteBoard(b.id);
    expect(getBoard(b.id)).toBeUndefined();
    expect(del).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    expect(del).toHaveBeenCalledWith(b.id);
  });

  it('undo restores the exact board and never touches content', async () => {
    vi.useFakeTimers();
    const b = await createBoard({ title: 'Keep me' });
    const pending = deleteBoard(b.id);
    expect(pending.undo()).toBe(true);
    expect(getBoard(b.id)).toEqual(b);
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
    expect(del).not.toHaveBeenCalled();
    expect(pending.undo()).toBe(false);
  });

  it('commit() deletes now; undo afterwards is refused', async () => {
    const b = await createBoard();
    const pending = deleteBoard(b.id, { undoWindowMs: null });
    await pending.commit();
    await pending.commit();
    expect(del).toHaveBeenCalledTimes(1);
    expect(pending.undo()).toBe(false);
    expect(getBoard(b.id)).toBeUndefined();
  });

  it('a failed commit can still be undone and is retried by flushPendingDeletes', async () => {
    const b = await createBoard();
    del.mockRejectedValueOnce(new Error('idb'));
    const pending = deleteBoard(b.id, { undoWindowMs: null });
    await expect(pending.commit()).rejects.toMatchObject({ kind: 'delete' });
    await flushPendingDeletes();
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenLastCalledWith(b.id);
    await flushPendingDeletes();
    expect(del).toHaveBeenCalledTimes(2);
  });

  it('flush cleans content orphaned by a closed tab, but skips restored boards', async () => {
    localStorage.setItem('fs:pendingDeletes:v1', JSON.stringify(['orphan']));
    const kept = await createBoard();
    localStorage.setItem('fs:pendingDeletes:v1', JSON.stringify(['orphan', kept.id]));
    await flushPendingDeletes();
    expect(del).toHaveBeenCalledWith('orphan');
    expect(del).not.toHaveBeenCalledWith(kept.id);
    expect(localStorage.getItem('fs:pendingDeletes:v1')).toBeNull();
  });

  it('throws for unknown boards', () => {
    expect(() => deleteBoard('missing')).toThrow(BoardOpError);
  });
});
