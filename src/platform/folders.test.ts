import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as persistence from '../store/persistence';
import { createBoardMeta, getBoard, updateBoardMeta } from './boardIndex';
import { createBoard, duplicateBoard } from './boards';
import { boardsInFolder, createFolder, ensureFolder, getFolder, listFolders, moveBoardToFolder, renameFolder } from './folders';
import {
  TRASH_DAYS, daysLeft, deleteFolderForever, emptyTrash, listTrash, purgeExpiredTrash, restoreBoard, restoreFolder, trashBoard, trashFolder,
} from './trash';

vi.mock('../store/persistence', () => ({
  writeInitialDoc: vi.fn(async () => {}),
  readBoardDoc: vi.fn(async () => ({ frames: {}, elements: {}, connectors: {}, variants: {} })),
  deleteBoardData: vi.fn(async () => {}),
}));
const del = vi.mocked(persistence.deleteBoardData);
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  del.mockResolvedValue(undefined);
});

describe('folders', () => {
  it('creates, lists A→Z, and files boards (one level)', () => {
    const b = createFolder('beta');
    const a = createFolder('  Alpha ');
    expect(listFolders().map((f) => f.name)).toEqual(['Alpha', 'beta']);
    expect(createFolder('').name).toBe('Untitled folder');
    const board = createBoardMeta({ title: 'x' });
    moveBoardToFolder(board.id, a.id);
    expect(getBoard(board.id)).toMatchObject({ folderId: a.id, folderName: 'Alpha' });
    expect(boardsInFolder(a.id).map((x) => x.id)).toEqual([board.id]);
    moveBoardToFolder(board.id, null);
    expect(getBoard(board.id)?.folderId).toBeUndefined();
    expect(boardsInFolder(b.id)).toEqual([]);
  });

  it('renaming a folder updates the name carried by its boards (so it syncs)', () => {
    const f = createFolder('Old');
    const board = createBoardMeta({ title: 'x' });
    moveBoardToFolder(board.id, f.id);
    updateBoardMeta(board.id, { updatedAt: 1 });
    renameFolder(f.id, 'New');
    expect(getFolder(f.id)?.name).toBe('New');
    expect(getBoard(board.id)).toMatchObject({ folderName: 'New' });
    expect(getBoard(board.id)!.updatedAt).toBeGreaterThan(1);
  });

  it('new and duplicated boards can start inside a folder', async () => {
    const f = createFolder('F');
    const b = await createBoard({ folderId: f.id });
    expect(getBoard(b.id)?.folderId).toBe(f.id);
    const d = await duplicateBoard(b.id);
    expect(getBoard(d.id)?.folderId).toBe(f.id);
  });

  it('ensureFolder rebuilds a folder that arrived with a board from another device', () => {
    ensureFolder({ folderId: 'f9', folderName: 'Remote', updatedAt: 10 });
    expect(getFolder('f9')).toMatchObject({ name: 'Remote' });
    ensureFolder({ folderId: 'f9', folderName: 'Renamed', updatedAt: 20 });
    expect(getFolder('f9')?.name).toBe('Renamed');
    ensureFolder({ folderId: 'f9', folderName: 'Stale', updatedAt: 5 });
    expect(getFolder('f9')?.name).toBe('Renamed');
    ensureFolder({ folderId: 'f8', folderName: 'Binned', updatedAt: 10, trashedAt: 9 });
    expect(getFolder('f8')?.trashedAt).toBe(9);
    ensureFolder({ folderId: 'f8', folderName: 'Binned', updatedAt: 11 });
    expect(getFolder('f8')?.trashedAt).toBeUndefined();
  });
});

describe('trash', () => {
  it('trashing a board keeps it and its content; restore puts it back in its folder', () => {
    const f = createFolder('F');
    const b = createBoardMeta({ title: 'x' });
    moveBoardToFolder(b.id, f.id);
    trashBoard(b.id);
    expect(listTrash().boards.map((x) => x.id)).toEqual([b.id]);
    restoreBoard(b.id);
    expect(getBoard(b.id)).toMatchObject({ folderId: f.id });
    expect(getBoard(b.id)?.trashedAt).toBeUndefined();
    expect(del).not.toHaveBeenCalled();
  });

  it('a folder goes to Trash with its boards and comes back with them', () => {
    const f = createFolder('F');
    const a = createBoardMeta({ title: 'a' });
    const b = createBoardMeta({ title: 'b' });
    moveBoardToFolder(a.id, f.id);
    moveBoardToFolder(b.id, f.id);
    expect(trashFolder(f.id)).toBe(2);
    const t = listTrash();
    expect(t.boards).toEqual([]);
    expect(t.folders).toHaveLength(1);
    expect(t.folders[0].boards).toHaveLength(2);
    restoreFolder(f.id);
    expect(getFolder(f.id)?.trashedAt).toBeUndefined();
    expect(boardsInFolder(f.id)).toHaveLength(2);
  });

  it('restoring one board from a deleted folder puts it on the dashboard', () => {
    const f = createFolder('F');
    const a = createBoardMeta({ title: 'a' });
    moveBoardToFolder(a.id, f.id);
    trashFolder(f.id);
    restoreBoard(a.id);
    expect(getBoard(a.id)?.folderId).toBeUndefined();
    expect(getBoard(a.id)?.trashedAt).toBeUndefined();
  });

  it('counts days left and purges what is older than 30 days', async () => {
    const now = Date.now();
    expect(daysLeft(now, now)).toBe(TRASH_DAYS);
    expect(daysLeft(now - 29.5 * DAY, now)).toBe(1);
    expect(daysLeft(now - 31 * DAY, now)).toBe(0);
    const old = createBoardMeta({ title: 'old' });
    const fresh = createBoardMeta({ title: 'fresh' });
    updateBoardMeta(old.id, { trashedAt: now - 31 * DAY });
    updateBoardMeta(fresh.id, { trashedAt: now + 2 * DAY });
    const f = createFolder('F');
    const inF = createBoardMeta({ title: 'inF' });
    moveBoardToFolder(inF.id, f.id);
    trashFolder(f.id);
    await purgeExpiredTrash(now + 31 * DAY - 2 * DAY + 1);
    expect(getBoard(old.id)).toBeUndefined();
    expect(getBoard(fresh.id)).toBeDefined();
    expect(getFolder(f.id)).toBeDefined();
    await purgeExpiredTrash(now + 31 * DAY);
    expect(getFolder(f.id)).toBeUndefined();
    expect(getBoard(inF.id)).toBeUndefined();
    expect(del).toHaveBeenCalledWith(inF.id);
  });

  it('delete forever and empty Trash remove content too', async () => {
    const f = createFolder('F');
    const a = createBoardMeta({ title: 'a' });
    moveBoardToFolder(a.id, f.id);
    trashFolder(f.id);
    await deleteFolderForever(f.id);
    expect(getFolder(f.id)).toBeUndefined();
    expect(del).toHaveBeenCalledWith(a.id);
    const b = createBoardMeta({ title: 'b' });
    trashBoard(b.id);
    await emptyTrash();
    expect(getBoard(b.id)).toBeUndefined();
    expect(listTrash()).toEqual({ folders: [], boards: [] });
  });
});
