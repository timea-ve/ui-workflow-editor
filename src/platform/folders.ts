// Dashboard folders (one level: folders hold boards, not folders). Owner: Platform agent.
//
// The folder list lives in localStorage next to the board list. Each board also carries its
// folder's id and name (`Board.folderId` / `folderName`), so a board saved to GitHub brings its
// folder along and another device can rebuild it (`ensureFolder`). Empty folders stay on this device.
import { nanoid } from 'nanoid';
import type { Board, Folder, ID } from '../model/types';
import { getBoard, listBoards, updateBoardMeta, updateBoardsMeta } from './boardIndex';

const KEY = 'fs:folders:v1';
export const UNTITLED_FOLDER = 'Untitled folder';
const listeners = new Set<() => void>();

function read(): Record<ID, Folder> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<ID, Folder>) : {};
  } catch {
    return {};
  }
}
function write(all: Record<ID, Folder>) {
  localStorage.setItem(KEY, JSON.stringify(all));
  listeners.forEach((l) => l());
}

/** Every folder, including those in Trash, A→Z. */
export function listFolders(): Folder[] {
  return Object.values(read()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
export function getFolder(id: ID): Folder | undefined {
  return read()[id];
}
/** Boards filed in this folder (live ones only unless `includeTrashed`). */
export function boardsInFolder(id: ID, includeTrashed = false): Board[] {
  return listBoards().filter((b) => b.folderId === id && (includeTrashed || b.trashedAt === undefined));
}

export function createFolder(name?: string): Folder {
  const now = Date.now();
  const folder: Folder = { id: nanoid(12), name: name?.trim() || UNTITLED_FOLDER, createdAt: now, updatedAt: now };
  write({ ...read(), [folder.id]: folder });
  return folder;
}

/** Renames the folder and the copy of its name on every board in it (so the change syncs). */
export function renameFolder(id: ID, name: string): Folder | undefined {
  const all = read();
  if (!all[id]) return undefined;
  const clean = name.trim() || UNTITLED_FOLDER;
  all[id] = { ...all[id], name: clean, updatedAt: Date.now() };
  write(all);
  updateBoardsMeta(Object.fromEntries(boardsInFolder(id, true).map((b) => [b.id, { folderName: clean }])));
  return all[id];
}

export function setFolderTrashed(id: ID, trashedAt: number | undefined) {
  const all = read();
  if (!all[id]) return;
  all[id] = { ...all[id], trashedAt };
  write(all);
}

export function removeFolder(id: ID) {
  const all = read();
  delete all[id];
  write(all);
}

/** Files a board in a folder, or back on the dashboard with `null`. */
export function moveBoardToFolder(boardId: ID, folderId: ID | null): Board | undefined {
  const board = getBoard(boardId);
  if (!board || (board.folderId ?? null) === folderId) return board;
  if (folderId === null) return updateBoardMeta(boardId, { folderId: undefined, folderName: undefined });
  const folder = getFolder(folderId);
  if (!folder || folder.trashedAt !== undefined) return board;
  return updateBoardMeta(boardId, { folderId: folder.id, folderName: folder.name });
}

/**
 * Makes sure the folder a board arrived with (from GitHub) exists here. Creates it if missing,
 * takes a newer name, and brings it out of Trash if a live board is in it.
 */
export function ensureFolder(board: Pick<Board, 'folderId' | 'folderName' | 'trashedAt' | 'updatedAt'>) {
  if (!board.folderId) return;
  const all = read();
  const name = board.folderName?.trim() || UNTITLED_FOLDER;
  const f = all[board.folderId];
  if (!f) {
    all[board.folderId] = {
      id: board.folderId, name, createdAt: board.updatedAt, updatedAt: board.updatedAt,
      ...(board.trashedAt !== undefined ? { trashedAt: board.trashedAt } : {}),
    };
  } else {
    let next = f;
    if (f.name !== name && board.updatedAt > f.updatedAt) next = { ...next, name, updatedAt: board.updatedAt };
    if (f.trashedAt !== undefined && board.trashedAt === undefined) next = { ...next, trashedAt: undefined };
    if (next === f) return;
    all[board.folderId] = next;
  }
  write(all);
}

export function subscribeFolders(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
