// Shape validation for shared snapshots (share links and the legacy share server).
// Deliberately structural (not a full schema): it guarantees the share view can render what it gets and rejects junk early.
import type { BoardDoc } from '../model/types.ts';

export const MAX_TITLE = 200;
/** Total records across all collections — far above any real board, well below abuse. */
export const MAX_RECORDS = 50_000;

const COLLECTIONS = ['frames', 'elements', 'connectors', 'links', 'variants', 'flowNames'] as const;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown) => typeof v === 'string';
const hasRect = (r: Record<string, unknown>) => isNum(r.x) && isNum(r.y) && isNum(r.w) && isNum(r.h);
const hasEnd = (v: unknown) => isObj(v) && isStr(v.nodeId);

const CHECKS: Record<Exclude<(typeof COLLECTIONS)[number], 'flowNames'>, (r: Record<string, unknown>) => boolean> = {
  frames: (r) => isStr(r.name) && isStr(r.device) && hasRect(r),
  elements: (r) => isStr(r.type) && hasRect(r) && (r.props === undefined || isObj(r.props)),
  connectors: (r) => hasEnd(r.from) && hasEnd(r.to),
  links: (r) => isStr(r.sourceElementId) && isStr(r.targetFrameId),
  variants: (r) => isStr(r.label),
};

export function validateBoardDoc(input: unknown): Result<BoardDoc> {
  if (!isObj(input)) return { ok: false, error: 'doc must be an object' };
  let count = 0;
  const out: Record<string, unknown> = { ...input };
  for (const key of COLLECTIONS) {
    const coll = input[key] ?? {};
    if (!isObj(coll)) return { ok: false, error: `doc.${key} must be an object` };
    for (const [id, rec] of Object.entries(coll)) {
      count++;
      if (key === 'flowNames') {
        if (!isStr(rec)) return { ok: false, error: `doc.flowNames.${id} must be a string` };
        continue;
      }
      if (!isObj(rec) || (rec.id !== undefined && rec.id !== id) || !CHECKS[key](rec)) {
        return { ok: false, error: `doc.${key}.${id} has an invalid shape` };
      }
    }
    out[key] = coll;
  }
  if (count > MAX_RECORDS) return { ok: false, error: 'doc has too many items' };
  return { ok: true, value: out as unknown as BoardDoc };
}

export function validateTitle(input: unknown): Result<string> {
  if (input === undefined) return { ok: true, value: 'Untitled board' };
  if (!isStr(input)) return { ok: false, error: 'title must be a string' };
  const t = input.trim().slice(0, MAX_TITLE);
  return { ok: true, value: t || 'Untitled board' };
}
