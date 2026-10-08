// BoardDoc <-> Y.Doc mapping. Pure Yjs logic (no IndexedDB) so it is unit-testable.
//
// Layout: one Y.Map per top-level BoardDoc key (frames, elements, …). Each map holds plain,
// immutable entity objects keyed by id. Generic over keys: whatever keys `emptyDoc()` has —
// plus any extra keys found in a doc or Y.Doc — are mirrored, so new collections "just work".
import * as Y from 'yjs';
import type { BoardDoc } from '../model/types';
import { emptyDoc } from '../flow/ops';

export type BoardKey = keyof BoardDoc;
type Collection = Record<string, unknown>;

/** Every collection key of BoardDoc (derived from emptyDoc so it can't drift). */
export const BOARD_KEYS = Object.keys(emptyDoc()) as BoardKey[];

/** Keys to mirror: the schema keys plus any extra top-level maps already present. */
export function docKeys(ydoc: Y.Doc, ...docs: (BoardDoc | undefined)[]): string[] {
  const keys = new Set<string>(BOARD_KEYS);
  for (const k of ydoc.share.keys()) keys.add(k);
  for (const d of docs) if (d) for (const k of Object.keys(d)) keys.add(k);
  return [...keys];
}

export function boardMaps(ydoc: Y.Doc): Y.Map<unknown>[] {
  return docKeys(ydoc).map((k) => ydoc.getMap(k));
}

/** Snapshot of the whole Y.Doc as a BoardDoc. Entity objects are the stored references. */
export function readDoc(ydoc: Y.Doc): BoardDoc {
  const out: Record<string, Collection> = {};
  for (const key of docKeys(ydoc)) {
    const col: Collection = {};
    ydoc.getMap(key).forEach((v, id) => { col[id] = v; });
    out[key] = col;
  }
  return out as unknown as BoardDoc;
}

/** Structural equality for JSON-like entity values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).filter((k) => (a as Collection)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Collection)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Collection)[k], (b as Collection)[k]));
}

/** Drops `undefined` fields so stored entities stay plain JSON. */
function clean<T>(v: T): T {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return v;
  if (!Object.values(v as Collection).some((x) => x === undefined)) return v;
  return Object.fromEntries(Object.entries(v as Collection).filter(([, x]) => x !== undefined)) as T;
}

export interface DiffStats { set: number; deleted: number }

/**
 * Writes only what changed between `prev` and `next` into the Y.Doc, inside one transaction
 * (so one op = one undo step). Unchanged entities (same reference or structurally equal) are skipped.
 */
export function applyDocDiff(ydoc: Y.Doc, prev: BoardDoc, next: BoardDoc, origin: unknown): DiffStats {
  const stats: DiffStats = { set: 0, deleted: 0 };
  const keys = docKeys(ydoc, prev, next);
  ydoc.transact(() => {
    for (const key of keys) {
      // Ops written before a collection existed rebuild the doc without it: leave that collection alone.
      if (!(key in (next as object))) continue;
      const a = ((prev as unknown as Record<string, Collection>)[key] ?? {});
      const b = (next as unknown as Record<string, Collection>)[key] ?? {};
      if (a === b) continue;
      const map = ydoc.getMap(key);
      for (const id of Object.keys(a)) {
        if (!(id in b) && map.has(id)) { map.delete(id); stats.deleted++; }
      }
      for (const [id, val] of Object.entries(b)) {
        if (val === undefined) continue;
        const old = a[id];
        if (old === val || deepEqual(old, val)) continue;
        map.set(id, clean(val));
        stats.set++;
      }
    }
  }, origin);
  return stats;
}

/** Replaces the Y.Doc content with `doc` (used for seeding). */
export function replaceDoc(ydoc: Y.Doc, doc: BoardDoc, origin: unknown) {
  return applyDocDiff(ydoc, readDoc(ydoc), doc, origin);
}
