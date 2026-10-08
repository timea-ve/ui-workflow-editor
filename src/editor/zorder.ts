// Z-order with fractional indexes. Frames are ordered among frames; elements among their siblings
// (same parent frame, or the canvas). Only moved entities get new keys.
import { generateNKeysBetween } from 'fractional-indexing';
import type { BoardDoc, Element, Frame, ID } from '../model/types';
import { compareZ } from '../flow/ops';

export type ZMove = 'front' | 'back' | 'forward' | 'backward';

type Entity = Frame | Element;
const levelOf = (doc: BoardDoc, e: Entity): string =>
  'kind' in e && e.kind === 'frame' ? 'frames' : (e as Element).parentId && doc.frames[(e as Element).parentId!] ? `in:${(e as Element).parentId}` : 'canvas';

function siblings(doc: BoardDoc, level: string): Entity[] {
  const all: Entity[] = level === 'frames' ? Object.values(doc.frames) : Object.values(doc.elements).filter((e) => levelOf(doc, e) === level);
  return all.sort((a, b) => compareZ(a.z, b.z) || compareZ(a.id, b.id));
}

function desiredOrder(list: Entity[], sel: Set<ID>, move: ZMove): Entity[] {
  const picked = list.filter((e) => sel.has(e.id));
  const rest = list.filter((e) => !sel.has(e.id));
  if (move === 'front') return [...rest, ...picked];
  if (move === 'back') return [...picked, ...rest];
  const out = [...list];
  if (move === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) {
      if (sel.has(out[i].id) && !sel.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
  } else {
    for (let i = 1; i < out.length; i++) {
      if (sel.has(out[i].id) && !sel.has(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]];
    }
  }
  return out;
}

/** New z keys for `order` that touch as few entities as possible. */
function assignKeys(before: Entity[], order: Entity[]): Map<ID, string> {
  const out = new Map<ID, string>();
  // Entities whose relative order is unchanged keep their key: a longest-increasing-subsequence would be
  // optimal; "not moved" = selected ones for front/back, which is what callers need in practice.
  const rank = new Map(before.map((e, i) => [e.id, i]));
  const keep = new Set<ID>();
  let last = -1;
  for (const e of order) {
    const r = rank.get(e.id)!;
    if (r > last) { keep.add(e.id); last = r; }
  }
  try {
    let i = 0;
    while (i < order.length) {
      if (keep.has(order[i].id)) { i++; continue; }
      let j = i;
      while (j < order.length && !keep.has(order[j].id)) j++;
      const lower = i > 0 ? (out.get(order[i - 1].id) ?? order[i - 1].z) : null;
      const upper = j < order.length ? order[j].z : null;
      const keys = generateNKeysBetween(lower, upper, j - i);
      for (let k = i; k < j; k++) out.set(order[k].id, keys[k - i]);
      i = j;
    }
  } catch {
    // Legacy / colliding keys: renumber the whole level.
    out.clear();
    const keys = generateNKeysBetween(null, null, order.length);
    order.forEach((e, k) => out.set(e.id, keys[k]));
  }
  return out;
}

/** Reorders the given frames/elements within their level. Returns `doc` unchanged if nothing moves. */
export function reorder(doc: BoardDoc, ids: ID[], move: ZMove): BoardDoc {
  const sel = new Set(ids.filter((id) => doc.frames[id] || doc.elements[id]));
  if (!sel.size) return doc;
  const levels = new Set([...sel].map((id) => levelOf(doc, doc.frames[id] ?? doc.elements[id])));
  let frames = doc.frames;
  let elements = doc.elements;
  for (const level of levels) {
    const list = siblings(doc, level);
    const order = desiredOrder(list, sel, move);
    if (order.every((e, i) => e === list[i])) continue;
    for (const [id, z] of assignKeys(list, order)) {
      if (doc.frames[id]) { if (frames === doc.frames) frames = { ...frames }; frames[id] = { ...frames[id], z }; }
      else { if (elements === doc.elements) elements = { ...elements }; elements[id] = { ...elements[id], z }; }
    }
  }
  return frames === doc.frames && elements === doc.elements ? doc : { ...doc, frames, elements };
}
