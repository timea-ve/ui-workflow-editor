// In-memory board store: a Y.Doc + an immutable BoardDoc snapshot that is updated incrementally
// (unchanged entities keep their object identity, so the canvas can skip re-rendering them),
// plus a Y.UndoManager scoped to the board maps. No IndexedDB here — see persistence.ts.
import * as Y from 'yjs';
import type { BoardDoc } from '../model/types';
import { applyDocDiff, boardMaps, readDoc, replaceDoc } from './docSync';

export type DocOp = (doc: BoardDoc) => BoardDoc;

export interface ApplyOptions {
  /** Human label for the undo step / announcements, e.g. "Add screen". */
  label?: string;
  /**
   * Consecutive applies with the same mergeKey (within ~1s) collapse into one undo step,
   * e.g. holding an arrow key to nudge.
   */
  mergeKey?: string;
  /** Not undoable (e.g. seeding). */
  skipUndo?: boolean;
}

/** Origin for user edits (tracked by the undo manager). */
export const LOCAL_ORIGIN = { name: 'fs-local' };
/** Origin for seeding / migrations (not undoable). */
export const SEED_ORIGIN = { name: 'fs-seed' };

const CAPTURE_MS = 1000;

export class BoardStore {
  readonly ydoc: Y.Doc;
  readonly undoManager: Y.UndoManager;
  private snapshot: BoardDoc;
  private listeners = new Set<() => void>();
  private lastMergeKey: string | undefined;
  private lastMergeAt = 0;
  private pendingLabel: string | undefined;

  constructor(ydoc: Y.Doc = new Y.Doc()) {
    this.ydoc = ydoc;
    this.snapshot = readDoc(ydoc);
    this.undoManager = new Y.UndoManager(boardMaps(ydoc), {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: CAPTURE_MS,
    });
    this.undoManager.on('stack-item-added', (e: { stackItem: { meta: Map<string, unknown> }; type: 'undo' | 'redo' }) => {
      if (this.pendingLabel && !e.stackItem.meta.has('label')) e.stackItem.meta.set('label', this.pendingLabel);
    });
    ydoc.on('afterTransaction', this.onAfterTransaction);
  }

  private onAfterTransaction = (tr: Y.Transaction) => {
    if (!tr.changed.size) return;
    const names = new Map<unknown, string>();
    for (const [name, type] of this.ydoc.share) names.set(type, name);
    const next = { ...this.snapshot } as unknown as Record<string, Record<string, unknown>>;
    let touched = false;
    for (const [type, keys] of tr.changed) {
      const name = names.get(type);
      if (!name) continue; // nested types are not used
      const map = this.ydoc.getMap(name);
      // A root type we've never seen (e.g. from a newer schema): track it for undo too.
      if (!(name in this.snapshot)) this.undoManager.addToScope(map);
      const col = { ...(next[name] ?? {}) };
      for (const id of keys) {
        if (id === null) continue;
        if (map.has(id)) col[id] = map.get(id); else delete col[id];
      }
      next[name] = col;
      touched = true;
    }
    if (!touched) return;
    this.snapshot = next as unknown as BoardDoc;
    this.listeners.forEach((l) => l());
  };

  getDoc = (): BoardDoc => this.snapshot;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  /** Applies a pure op by diffing old vs new and writing only changed entities in one transaction. */
  apply = (op: DocOp, opts: ApplyOptions = {}): boolean => {
    const prev = this.snapshot;
    const next = op(prev);
    if (next === prev) return false;
    const now = Date.now();
    const merge = !!opts.mergeKey && opts.mergeKey === this.lastMergeKey && now - this.lastMergeAt < CAPTURE_MS;
    if (!merge) this.undoManager.stopCapturing();
    this.lastMergeKey = opts.mergeKey;
    this.lastMergeAt = now;
    this.pendingLabel = opts.label;
    const stats = applyDocDiff(this.ydoc, prev, next, opts.skipUndo ? SEED_ORIGIN : LOCAL_ORIGIN);
    this.pendingLabel = undefined;
    if (!merge) this.undoManager.stopCapturing();
    // Keep capturing open only for mergeable sequences.
    if (opts.mergeKey) this.reopenCapture();
    return stats.set + stats.deleted > 0;
  };

  // Y.UndoManager has no public "resume capturing"; stopCapturing() sets lastChange = 0.
  // Restoring lastChange lets the next same-key apply merge into this step.
  private reopenCapture() {
    (this.undoManager as unknown as { lastChange: number }).lastChange = Date.now();
  }

  /** Replace everything (not undoable). */
  seed = (doc: BoardDoc) => {
    replaceDoc(this.ydoc, doc, SEED_ORIGIN);
  };

  /** Returns the label of the undone step (if any). */
  undo = (): string | undefined => this.step('undo');

  redo = (): string | undefined => this.step('redo');

  private step(kind: 'undo' | 'redo'): string | undefined {
    this.lastMergeKey = undefined;
    const stack = kind === 'undo' ? this.undoManager.undoStack : this.undoManager.redoStack;
    const top = stack[stack.length - 1];
    if (!top) return undefined;
    // The inverse stack item is a new object: carry the label over to it.
    const label = (top.meta.get('label') as string | undefined) ?? 'change';
    this.pendingLabel = label;
    try {
      return this.undoManager[kind]() ? label : undefined;
    } finally {
      this.pendingLabel = undefined;
    }
  }

  canUndo = () => this.undoManager.canUndo();
  canRedo = () => this.undoManager.canRedo();

  destroy() {
    this.ydoc.off('afterTransaction', this.onAfterTransaction);
    this.undoManager.destroy();
    this.listeners.clear();
  }
}

export function createMemoryStore(initial?: BoardDoc): BoardStore {
  const store = new BoardStore(new Y.Doc());
  if (initial) store.seed(initial);
  return store;
}
