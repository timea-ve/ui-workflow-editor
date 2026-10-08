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

/** Newest first. */
export function listBoards(): Board[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getBoard(id: ID): Board | undefined {
  return read()[id];
}
/** Creates the metadata row only. Seed content with `writeInitialDoc` from src/store/persistence. */
export function createBoardMeta(input: { title?: string; templateId?: string } = {}): Board {
  const now = Date.now();
  const board: Board = { id: nanoid(12), title: input.title?.trim() || 'Untitled board', schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now, ...(input.templateId ? { templateId: input.templateId } : {}) };
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
export function subscribeBoards(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
