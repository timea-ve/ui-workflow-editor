// What this device last synced with GitHub, per board (localStorage `fs:github-sync:v1`).
// Kept tiny and dependency-free: src/platform/boards.ts calls `recordLocalDelete` when a delete
// commits, without pulling in the rest of the GitHub code.
import type { ID } from '../../model/types';

export const SYNC_KEY = 'fs:github-sync:v1';

export interface SyncEntry {
  /** Blob sha of boards/<id>.json as of our last sync. */
  sha: string;
  /** The local board's `updatedAt` at our last sync; a different value = unsynced local changes. */
  updatedAt: number;
  /** Content fingerprint at our last sync (see contentHash in sync.ts). */
  hash: string;
  /** Deleted on this device; the GitHub file still has to be removed. */
  deleted?: true;
}

export interface SyncState {
  /** "owner/name" the entries belong to. */
  repo?: string;
  boards: Record<ID, SyncEntry>;
}

export interface SyncStore {
  read(): SyncState;
  write(state: SyncState): void;
}

const deleteListeners = new Set<(id: ID) => void>();

export const localSyncStore: SyncStore = {
  read() {
    try {
      const v = JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null') as SyncState | null;
      return v && typeof v.boards === 'object' && v.boards ? v : { boards: {} };
    } catch {
      return { boards: {} };
    }
  },
  write(state) {
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(state)); } catch { /* storage full: we'll re-check next sync */ }
  },
};

/** Called once a board's local delete is final (after its undo window). */
export function recordLocalDelete(id: ID, store: SyncStore = localSyncStore) {
  const state = store.read();
  const entry = state.boards[id];
  if (entry && !entry.deleted) {
    state.boards[id] = { ...entry, deleted: true };
    store.write(state);
  }
  deleteListeners.forEach((l) => l(id));
}

export function onLocalDelete(cb: (id: ID) => void): () => void {
  deleteListeners.add(cb);
  return () => { deleteListeners.delete(cb); };
}
