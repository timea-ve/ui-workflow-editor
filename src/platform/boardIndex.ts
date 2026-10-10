// Board list (metadata only) — kept in localStorage so the dashboard renders instantly.
// Board *content* lives in IndexedDB via src/store (Canvas Core). Owner: Platform agent.
import { nanoid } from 'nanoid';
import type { Board, ID } from '../model/types';

const KEY = 'fs:boards:v1';
const SCHEMA_VERSION = 1;
const listeners = new Set<() => void>();

function read(): Record<ID, Board> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<ID, Board>; } catch { return {}; }
}
function write(all: Record<ID, Board>) {
  localStorage.setItem(KEY, JSON.stringify(all));
  listeners.forEach((l) => l());
}

/** Newest first. Includes boards in Trash (sync needs them); the dashboard filters with `isLive`. */
export function listBoards(): Board[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}
/** Not in Trash. */
export const isLive = (b: Board) => b.trashedAt === undefined;
/** Applies several metadata patches with one write (one change notification). */
export function updateBoardsMeta(patches: Record<ID, Partial<Omit<Board, 'id'>>>) {
  const all = read();
  const now = Date.now();
  let changed = false;
  for (const [id, patch] of Object.entries(patches)) {
    if (!all[id]) continue;
    all[id] = { ...all[id], ...patch, updatedAt: patch.updatedAt ?? now };
    changed = true;
  }
  if (changed) write(all);
}
export function getBoard(id: ID): Board | undefined {
  return read()[id];
}
/** Creates the metadata row only. Seed content with `writeInitialDoc` from src/store/persistence. */
export function createBoardMeta(input: { title?: string; templateId?: string; folderId?: ID; folderName?: string } = {}): Board {
  const now = Date.now();
  const board: Board = {
    id: nanoid(12), title: input.title?.trim() || 'Untitled board', schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now,
    ...(input.templateId ? { templateId: input.templateId } : {}),
    ...(input.folderId ? { folderId: input.folderId, folderName: input.folderName ?? '' } : {}),
  };
  write({ ...read(), [board.id]: board });
  return board;
}
export function updateBoardMeta(id: ID, patch: Partial<Omit<Board, 'id'>>): Board | undefined {
  const all = read();
  if (!all[id]) return undefined;
  all[id] = { ...all[id], ...patch, updatedAt: patch.updatedAt ?? Date.now() };
  write(all);
  return all[id];
}
export function renameBoard(id: ID, title: string) {
  return updateBoardMeta(id, { title: title.trim() || 'Untitled board' });
}
/** Mark as edited now (called by the editor on save). */
export function touchBoard(id: ID) {
  return updateBoardMeta(id, {});
}
export function deleteBoardMeta(id: ID) {
  const all = read();
  delete all[id];
  write(all);
}
/** Put a previously removed board row back unchanged (used by "Undo" after delete). */
export function restoreBoardMeta(board: Board) {
  write({ ...read(), [board.id]: board });
}
export function subscribeBoards(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
