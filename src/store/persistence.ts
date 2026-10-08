// Board content persistence: a Yjs doc per board, stored with y-indexeddb (room `fs-board-<id>`).
// Contract functions (fixed signatures, see docs/phase-3/CONTRACTS.md): writeInitialDoc,
// readBoardDoc, deleteBoardData. The editor opens a live session via openBoardSession.
import * as Y from 'yjs';
import { IndexeddbPersistence, clearDocument } from 'y-indexeddb';
import type { BoardDoc, ID } from '../model/types';
import { BoardStore, SEED_ORIGIN } from './boardStore';
import { readDoc, replaceDoc } from './docSync';

export const roomName = (boardId: ID) => `fs-board-${boardId}`;

/** Live editor sessions in this tab, so readBoardDoc / writeInitialDoc see the freshest content. */
const liveSessions = new Map<ID, BoardSession>();

/**
 * Resolves once every IndexedDB write queued so far has committed: a readonly transaction on the
 * same store is scheduled after earlier readwrite transactions on it (IndexedDB ordering rule).
 */
export async function flushPersistence(p: IndexeddbPersistence): Promise<void> {
  const db = await p._db;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['updates'], 'readonly');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function withRoom<T>(boardId: ID, fn: (ydoc: Y.Doc, p: IndexeddbPersistence) => Promise<T> | T): Promise<T> {
  const ydoc = new Y.Doc();
  const p = new IndexeddbPersistence(roomName(boardId), ydoc);
  try {
    await p.whenSynced;
    return await fn(ydoc, p);
  } finally {
    await p.destroy();
    ydoc.destroy();
  }
}

/** Seed a brand-new board's content (used by templates / duplicate). Resolves once durably saved. */
export async function writeInitialDoc(boardId: ID, doc: BoardDoc): Promise<void> {
  const live = liveSessions.get(boardId);
  if (live) {
    live.store.seed(doc);
    await live.flush();
    return;
  }
  await withRoom(boardId, async (ydoc, p) => {
    replaceDoc(ydoc, doc, SEED_ORIGIN);
    await flushPersistence(p);
  });
}

/** Read a board's current content without opening an editor (export, share, duplicate, thumbnails). */
export async function readBoardDoc(boardId: ID): Promise<BoardDoc> {
  const live = liveSessions.get(boardId);
  if (live) return live.store.getDoc();
  return withRoom(boardId, (ydoc) => readDoc(ydoc));
}

/** Permanently remove a board's content from this device. */
export async function deleteBoardData(boardId: ID): Promise<void> {
  const live = liveSessions.get(boardId);
  if (live) await live.close();
  await clearDocument(roomName(boardId));
}

// ---------- live sessions (editor) ----------

export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

export interface BoardSession {
  boardId: ID;
  store: BoardStore;
  /** Resolves when the board content has loaded from IndexedDB (or loading gave up). */
  ready: Promise<void>;
  getSaveState(): SaveState;
  subscribeSaveState(fn: () => void): () => void;
  /** Fires after local changes have been written to IndexedDB. */
  onSaved(fn: () => void): () => void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Opens (and loads) a board for editing. Every change is written to IndexedDB as it happens. */
export function openBoardSession(boardId: ID): BoardSession {
  const ydoc = new Y.Doc();
  const store = new BoardStore(ydoc);
  let state: SaveState = isOffline() ? 'offline' : 'saved';
  const stateListeners = new Set<() => void>();
  const savedListeners = new Set<() => void>();
  const setState = (s: SaveState) => {
    if (s === state) return;
    state = s;
    stateListeners.forEach((l) => l());
  };
  const settled = (): SaveState => (isOffline() ? 'offline' : 'saved');

  let persistence: IndexeddbPersistence | undefined;
  let synced = false;
  try {
    persistence = new IndexeddbPersistence(roomName(boardId), ydoc);
  } catch {
    persistence = undefined;
  }
  const ready = persistence
    ? Promise.race([
      persistence.whenSynced.then(() => { synced = true; }),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]).then(() => {
      if (synced) return;
      setState('error');
      persistence?.whenSynced.then(() => { synced = true; setState(settled()); });
    })
    : Promise.resolve().then(() => setState('error'));

  let pending = false;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const onUpdate = (_u: Uint8Array, origin: unknown) => {
    if (origin === persistence) return; // loaded from disk, not a local edit
    pending = true;
    setState(persistence ? 'saving' : 'error');
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      if (!persistence) { setState('error'); return; }
      flushPersistence(persistence).then(() => {
        pending = false;
        setState(synced ? settled() : 'error');
        savedListeners.forEach((l) => l());
      }, () => setState('error'));
    }, 200);
  };
  ydoc.on('update', onUpdate);

  const onNetwork = () => { if (state === 'saved' || state === 'offline') setState(settled()); };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onNetwork);
    window.addEventListener('offline', onNetwork);
  }

  let closed = false;
  const session: BoardSession = {
    boardId,
    store,
    ready,
    getSaveState: () => state,
    subscribeSaveState: (fn) => { stateListeners.add(fn); return () => { stateListeners.delete(fn); }; },
    onSaved: (fn) => { savedListeners.add(fn); return () => { savedListeners.delete(fn); }; },
    flush: async () => { if (persistence && pending) await flushPersistence(persistence); },
    close: async () => {
      if (closed) return;
      closed = true;
      if (liveSessions.get(boardId) === session) liveSessions.delete(boardId);
      clearTimeout(flushTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onNetwork);
        window.removeEventListener('offline', onNetwork);
      }
      ydoc.off('update', onUpdate);
      try {
        if (persistence) { await flushPersistence(persistence); await persistence.destroy(); }
      } catch { /* database already closed or deleted */ }
      store.destroy();
      ydoc.destroy();
    },
  };
  liveSessions.set(boardId, session);
  return session;
}
