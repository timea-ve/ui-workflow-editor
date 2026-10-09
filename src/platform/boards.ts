// Board-level operations that touch both the board list (localStorage, boardIndex.ts) and the
// board content (IndexedDB, src/store/persistence.ts). Owner: Platform agent.
//
// Atomicity: content is written right after the list row is created; if that write fails the row
// is removed again, so the dashboard never shows a board that can't be opened.
//
// Delete + undo: `deleteBoard` removes the list row at once (the board disappears from the
// dashboard) but keeps the content untouched until `commit()` runs — after the undo window, or when
// the caller says so (e.g. the undo toast closes). `undo()` simply puts the row back. Ids awaiting
// deletion are also recorded in localStorage, so content orphaned by closing the tab mid-window is
// cleaned up by `flushPendingDeletes()` on the next dashboard visit.
import type { Board, BoardDoc, ID } from '../model/types';
import { emptyDoc } from '../flow/ops';
import { createBoardMeta, deleteBoardMeta, getBoard, restoreBoardMeta } from './boardIndex';
import { getTemplate } from './templates';

// Loaded on first use so the dashboard's initial bundle doesn't carry Yjs + IndexedDB (see docs/phase-4/performance.md).
const persistence = () => import('../store/persistence');

export const UNDO_WINDOW_MS = 8000;
const PENDING_KEY = 'fs:pendingDeletes:v1';

export type BoardOpKind = 'create' | 'duplicate' | 'delete' | 'not-found';

export class BoardOpError extends Error {
  readonly kind: BoardOpKind;
  constructor(kind: BoardOpKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.kind = kind;
    this.name = 'BoardOpError';
  }
}

async function seed(meta: Board, doc: BoardDoc, kind: BoardOpKind): Promise<Board> {
  try {
    await (await persistence()).writeInitialDoc(meta.id, doc);
    return meta;
  } catch (cause) {
    deleteBoardMeta(meta.id);
    persistence().then((p) => p.deleteBoardData(meta.id)).catch(() => {});
    throw new BoardOpError(kind, `Couldn't save the new board's content`, { cause });
  }
}

/** New blank board, or a board seeded from a template (titled after it unless `title` is given). */
export async function createBoard(input: { title?: string; templateId?: string } = {}): Promise<Board> {
  const template = getTemplate(input.templateId);
  if (input.templateId && !template) throw new BoardOpError('create', `Unknown template "${input.templateId}"`);
  let doc: BoardDoc;
  try {
    doc = template ? template.build() : emptyDoc();
  } catch (cause) {
    throw new BoardOpError('create', `Couldn't build template "${input.templateId}"`, { cause });
  }
  const meta = createBoardMeta({ title: input.title ?? template?.name, templateId: template?.id });
  return seed(meta, doc, 'create');
}

/** New board seeded with a ready-made doc (e.g. a flow built from a Copilot flow link). */
export async function importBoard(input: { title: string; doc: BoardDoc }): Promise<Board> {
  return seed(createBoardMeta({ title: input.title }), input.doc, 'create');
}

/** Copies a board's current content into a new board titled "Copy of …". */
export async function duplicateBoard(id: ID): Promise<Board> {
  const source = getBoard(id);
  if (!source) throw new BoardOpError('not-found', `Board ${id} not found`);
  let doc: BoardDoc;
  try {
    doc = await (await persistence()).readBoardDoc(id);
  } catch (cause) {
    throw new BoardOpError('duplicate', `Couldn't read board ${id}`, { cause });
  }
  const meta = createBoardMeta({ title: `Copy of ${source.title}`, templateId: source.templateId });
  return seed(meta, doc, 'duplicate');
}

// ---------- delete with undo ----------

export interface PendingDelete {
  board: Board;
  /** Restores the board if its content hasn't been deleted yet. Returns false if too late. */
  undo(): boolean;
  /** Deletes the content now (idempotent). Rejects if storage fails; the id stays queued for retry. */
  commit(): Promise<void>;
}

const inFlight = new Map<ID, PendingDelete>();

function readPending(): ID[] {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is ID => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function writePending(ids: ID[]) {
  try {
    if (ids.length) localStorage.setItem(PENDING_KEY, JSON.stringify([...new Set(ids)]));
    else localStorage.removeItem(PENDING_KEY);
  } catch { /* storage full/blocked: worst case some content stays on disk */ }
}
const addPending = (id: ID) => writePending([...readPending(), id]);
const removePending = (id: ID) => writePending(readPending().filter((x) => x !== id));

/**
 * Removes the board from the list now; deletes its content after `undoWindowMs` (default 8 s).
 * Pass `undoWindowMs: null` to skip the timer and call `commit()` yourself.
 */
export function deleteBoard(id: ID, opts: { undoWindowMs?: number | null } = {}): PendingDelete {
  const board = getBoard(id);
  if (!board) throw new BoardOpError('not-found', `Board ${id} not found`);
  let state: 'pending' | 'undone' | 'committed' = 'pending';
  let committing: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  addPending(id);
  deleteBoardMeta(id);

  const handle: PendingDelete = {
    board,
    undo() {
      if (state !== 'pending' || committing) return false;
      state = 'undone';
      clearTimeout(timer);
      inFlight.delete(id);
      removePending(id);
      restoreBoardMeta(board);
      return true;
    },
    commit() {
      if (state === 'undone') return Promise.resolve();
      clearTimeout(timer);
      committing ??= persistence().then((p) => p.deleteBoardData(id)).then(
        () => { state = 'committed'; inFlight.delete(id); removePending(id); },
        (cause) => {
          committing = undefined;
          inFlight.delete(id);
          throw new BoardOpError('delete', `Couldn't delete the content of board ${id}`, { cause });
        },
      );
      return committing;
    },
  };
  inFlight.set(id, handle);
  const ms = opts.undoWindowMs === undefined ? UNDO_WINDOW_MS : opts.undoWindowMs;
  if (ms !== null) timer = setTimeout(() => { handle.commit().catch(() => {}); }, ms);
  return handle;
}

/** Commits every delete still waiting in this tab (e.g. when leaving the dashboard). */
export function commitPendingDeletes(): Promise<void> {
  return Promise.allSettled([...inFlight.values()].map((p) => p.commit())).then(() => {});
}

/**
 * Deletes content left behind by deletes that never committed (tab closed during the undo window).
 * Skips ids still waiting in this tab and ids whose board row exists again (restored elsewhere).
 */
export async function flushPendingDeletes(): Promise<void> {
  for (const id of readPending()) {
    if (inFlight.has(id)) continue;
    if (getBoard(id)) { removePending(id); continue; }
    try {
      await (await persistence()).deleteBoardData(id);
      removePending(id);
    } catch { /* keep queued; retry next visit */ }
  }
}
