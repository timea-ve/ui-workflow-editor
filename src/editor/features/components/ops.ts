// Pure ops for the wireframe-on-canvas feature: insert placement, re-parenting on drop,
// resize, prop edits, device changes, start screen, align / distribute. Every op returns a new
// doc (or the same doc when nothing changes) and never mutates its input.
import { DEVICE_SIZES, type BoardDoc, type Device, type Element, type ElementType, type Frame, type ID } from '../../../model/types';
import { kitRegistry } from '../../../kit/registry';
import { deviceContentInset } from '../../../kit/wireframe/DeviceFrame';
import { addElement, compareZ, detectFlows, frameOf } from '../../../flow/ops';

export const GRID = 8;
export const STACK_GAP = 16;
export const FRAME_PAD = 24;
/** Components that span the whole screen width when inserted into a screen. */
const FULL_WIDTH: ReadonlySet<ElementType> = new Set(['header', 'nav']);

export interface Box { x: number; y: number; w: number; h: number }
export type Point = { x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid;

const sizeOf = (type: ElementType) => {
  const def = kitRegistry.get(type);
  return {
    w: def?.defaultSize.w ?? 120, h: def?.defaultSize.h ?? 40,
    minW: def?.minSize.w ?? 16, minH: def?.minSize.h ?? 16,
  };
};

export function minSizeOf(type: ElementType): { w: number; h: number } {
  const s = sizeOf(type);
  return { w: s.minW, h: s.minH };
}

/** Absolute (canvas) rect of a frame or element. */
export function absRect(doc: BoardDoc, id: ID): Box | undefined {
  const f = doc.frames[id];
  if (f) return { x: f.x, y: f.y, w: f.w, h: f.h };
  const e = doc.elements[id];
  if (!e) return undefined;
  const p = e.parentId ? doc.frames[e.parentId] : undefined;
  return { x: e.x + (p?.x ?? 0), y: e.y + (p?.y ?? 0), w: e.w, h: e.h };
}

/** The screen to insert into for the current selection: a selected screen, or the screen of a selected element. */
export function targetFrameFor(doc: BoardDoc, selectedIds: ID[]): ID | undefined {
  for (const id of selectedIds) {
    const f = frameOf(doc, id);
    if (f) return f;
  }
  return undefined;
}

/** Topmost screen containing a canvas point. */
export function frameAtPoint(doc: BoardDoc, p: Point): ID | undefined {
  let best: Frame | undefined;
  for (const f of Object.values(doc.frames)) {
    if (p.x < f.x || p.x > f.x + f.w || p.y < f.y || p.y > f.y + f.h) continue;
    if (!best || compareZ(f.z, best.z) > 0) best = f;
  }
  return best?.id;
}

/** Lowest bottom edge of a screen's children (relative to the screen), or undefined when empty. */
function lowestChildBottom(doc: BoardDoc, frameId: ID): number | undefined {
  let max: number | undefined;
  for (const e of Object.values(doc.elements)) {
    if (e.parentId === frameId) max = Math.max(max ?? -Infinity, e.y + e.h);
  }
  return max;
}

/**
 * Inserts a component inside a screen in a free spot: stacked 16px below the lowest element
 * (or at the top of the content area), left-aligned with 24px padding, clamped inside the screen.
 */
export function insertIntoFrame(
  doc: BoardDoc, type: ElementType, frameId: ID, props?: Record<string, unknown>,
): { doc: BoardDoc; id: ID } {
  const frame = doc.frames[frameId];
  if (!frame) throw new Error(`insertIntoFrame: unknown frame ${frameId}`);
  const s = sizeOf(type);
  const inset = deviceContentInset(frame.device);
  const full = FULL_WIDTH.has(type);
  const inner = frame.w - FRAME_PAD * 2;
  let w = s.w;
  let x = FRAME_PAD;
  if (full) { w = frame.w; x = 0; }
  else if (w > inner) { w = Math.max(s.minW, inner); x = Math.max(0, Math.round((frame.w - w) / 2)); }
  const h = Math.min(s.h, Math.max(s.minH, frame.h - inset.top - inset.bottom));
  const lowest = lowestChildBottom(doc, frameId);
  let y = lowest === undefined ? inset.top + (full ? 0 : STACK_GAP) : lowest + STACK_GAP;
  const maxY = frame.h - inset.bottom - h;
  if (y > maxY) y = Math.max(inset.top, maxY);
  return addElement(doc, { type, parentId: frameId, x: Math.round(x), y: Math.round(y), w, h, ...(props ? { props } : {}) });
}

/** Inserts a component centred on a canvas point; inside `frameId` (relative + clamped) when given. */
export function insertAtPoint(
  doc: BoardDoc, type: ElementType, at: Point, frameId?: ID, props?: Record<string, unknown>,
): { doc: BoardDoc; id: ID } {
  const s = sizeOf(type);
  const frame = frameId ? doc.frames[frameId] : undefined;
  let w = s.w;
  let h = s.h;
  let x = at.x - w / 2;
  let y = at.y - h / 2;
  if (frame) {
    w = Math.min(w, Math.max(s.minW, frame.w));
    h = Math.min(h, Math.max(s.minH, frame.h));
    x = clamp(at.x - w / 2 - frame.x, 0, Math.max(0, frame.w - w));
    y = clamp(at.y - h / 2 - frame.y, 0, Math.max(0, frame.h - h));
  }
  return addElement(doc, {
    type, x: Math.round(x), y: Math.round(y), w, h,
    ...(frame ? { parentId: frame.id } : {}), ...(props ? { props } : {}),
  });
}

function withElement(doc: BoardDoc, el: Element): BoardDoc {
  return { ...doc, elements: { ...doc.elements, [el.id]: el } };
}

/** Clamps a child box inside its parent (size first, then position). */
function clampInside(box: Box, bounds: { w: number; h: number }): Box {
  const w = Math.min(box.w, bounds.w);
  const h = Math.min(box.h, bounds.h);
  return { x: clamp(box.x, 0, bounds.w - w), y: clamp(box.y, 0, bounds.h - h), w, h };
}

/**
 * After a drag: elements whose centre now lies over a different screen move into it; elements
 * dragged out of every screen become canvas elements. Elements that stay are clamped inside
 * their screen. Elements whose screen moved with them are left alone.
 */
export function reparentAfterMove(doc: BoardDoc, ids: ID[]): BoardDoc {
  const moved = new Set(ids);
  let next = doc;
  for (const id of ids) {
    const el = next.elements[id];
    if (!el || (el.parentId && moved.has(el.parentId))) continue;
    const abs = absRect(next, id)!;
    const target = frameAtPoint(next, { x: abs.x + abs.w / 2, y: abs.y + abs.h / 2 });
    const parent = el.parentId ? next.frames[el.parentId] : undefined;
    if (target === parent?.id) {
      if (!parent) continue;
      const c = clampInside(el, parent);
      if (c.x !== el.x || c.y !== el.y || c.w !== el.w || c.h !== el.h) next = withElement(next, { ...el, ...c });
      continue;
    }
    const frame = target ? next.frames[target] : undefined;
    const rest: Element = { ...el };
    delete rest.parentId;
    delete rest.variantId;
    const box = frame ? clampInside({ ...abs, x: abs.x - frame.x, y: abs.y - frame.y }, frame) : abs;
    next = withElement(next, {
      ...rest, ...box,
      ...(frame ? { parentId: frame.id } : {}),
      ...(frame?.variantId ? { variantId: frame.variantId } : {}),
    });
  }
  return next;
}

// ---------- resize ----------

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
export type ResizeAxes = 'both' | 'horizontal' | 'vertical' | 'none';

export interface ResizeOptions {
  min: { w: number; h: number };
  axes: ResizeAxes;
  /** Parent size for child elements (box is relative to the parent); undefined on the canvas. */
  bounds?: { w: number; h: number };
  /** Snap moving edges to the 8px grid (off while Alt is held). */
  snap?: boolean;
}

/** New box after dragging a corner handle by (dx, dy) canvas pixels. */
export function resizeBox(start: Box, handle: ResizeHandle, dx: number, dy: number, o: ResizeOptions): Box {
  const sx = (v: number) => (o.snap ? snap(v) : Math.round(v));
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (o.axes === 'both' || o.axes === 'horizontal') {
    if (handle.includes('e')) {
      right = sx(right + dx);
      if (o.bounds) right = Math.min(right, o.bounds.w);
      right = Math.max(right, left + o.min.w);
    } else {
      left = sx(left + dx);
      if (o.bounds) left = Math.max(left, 0);
      left = Math.min(left, right - o.min.w);
    }
  }
  if (o.axes === 'both' || o.axes === 'vertical') {
    if (handle.includes('s')) {
      bottom = sx(bottom + dy);
      if (o.bounds) bottom = Math.min(bottom, o.bounds.h);
      bottom = Math.max(bottom, top + o.min.h);
    } else {
      top = sx(top + dy);
      if (o.bounds) top = Math.max(top, 0);
      top = Math.min(top, bottom - o.min.h);
    }
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** A screen can shrink back to its device height (or its current height if shorter), but never cut its content. */
export function frameMinHeight(doc: BoardDoc, f: Frame): number {
  return Math.max(Math.min(DEVICE_SIZES[f.device].h, f.h), lowestChildBottom(doc, f.id) ?? 0);
}

/** Resize rules for a node: axes, min size and parent bounds. Screens keep their device width and grow in height. */
export function resizeRules(doc: BoardDoc, id: ID): Omit<ResizeOptions, 'snap'> | undefined {
  const f = doc.frames[id];
  if (f) return { axes: 'vertical', min: { w: f.w, h: frameMinHeight(doc, f) } };
  const e = doc.elements[id];
  if (!e) return undefined;
  const parent = e.parentId ? doc.frames[e.parentId] : undefined;
  return {
    axes: kitRegistry.get(e.type)?.resize ?? 'both',
    min: minSizeOf(e.type),
    ...(parent ? { bounds: { w: parent.w, h: parent.h } } : {}),
  };
}

/** Sets x/y/w/h of a frame or element (coordinates as stored: relative for children). */
export function setNodeBox(doc: BoardDoc, id: ID, box: Box): BoardDoc {
  const f = doc.frames[id];
  if (f) {
    if (f.x === box.x && f.y === box.y && f.w === box.w && f.h === box.h) return doc;
    return { ...doc, frames: { ...doc.frames, [id]: { ...f, ...box } } };
  }
  const e = doc.elements[id];
  if (!e || (e.x === box.x && e.y === box.y && e.w === box.w && e.h === box.h)) return doc;
  return withElement(doc, { ...e, ...box });
}

/** Inspector W/H: respects resize axes, min size and the parent screen (keeps top-left, shifts back inside if needed). */
export function setNodeSize(doc: BoardDoc, id: ID, size: { w?: number; h?: number }): BoardDoc {
  const rules = resizeRules(doc, id);
  const cur = doc.frames[id] ?? doc.elements[id];
  if (!rules || !cur) return doc;
  const horiz = rules.axes === 'both' || rules.axes === 'horizontal';
  const vert = rules.axes === 'both' || rules.axes === 'vertical';
  let w = horiz && size.w !== undefined && Number.isFinite(size.w) ? Math.round(size.w) : cur.w;
  let h = vert && size.h !== undefined && Number.isFinite(size.h) ? Math.round(size.h) : cur.h;
  w = Math.max(rules.min.w, w);
  h = Math.max(rules.min.h, h);
  let { x, y } = cur;
  if (rules.bounds) {
    w = Math.min(w, Math.max(rules.min.w, rules.bounds.w));
    h = Math.min(h, Math.max(rules.min.h, rules.bounds.h));
    x = clamp(x, 0, Math.max(0, rules.bounds.w - w));
    y = clamp(y, 0, Math.max(0, rules.bounds.h - h));
  }
  return setNodeBox(doc, id, { x, y, w, h });
}

/** Keyboard resize (Alt+Shift+Arrows): grows/shrinks the box from its top-left. */
export function nudgeSize(doc: BoardDoc, id: ID, dw: number, dh: number): BoardDoc {
  const cur = doc.frames[id] ?? doc.elements[id];
  return cur ? setNodeSize(doc, id, { w: cur.w + dw, h: cur.h + dh }) : doc;
}

// ---------- props / text ----------

export function setElementProps(doc: BoardDoc, id: ID, patch: Record<string, unknown>): BoardDoc {
  const e = doc.elements[id];
  if (!e) return doc;
  if (Object.entries(patch).every(([k, v]) => Object.is(e.props[k], v))) return doc;
  return withElement(doc, { ...e, props: { ...e.props, ...patch } });
}

/** The prop edited inline for an element (kit `textProp`), if any. */
export function textPropOf(type: ElementType): { key: string; multiline: boolean } | undefined {
  const def = kitRegistry.get(type);
  if (!def?.textProp) return undefined;
  const field = def.editableProps.find((f) => f.key === def.textProp);
  return { key: def.textProp, multiline: field?.kind === 'multiline' };
}

export function setElementText(doc: BoardDoc, id: ID, text: string): BoardDoc {
  const e = doc.elements[id];
  const tp = e && textPropOf(e.type);
  return tp ? setElementProps(doc, id, { [tp.key]: text }) : doc;
}

// ---------- screens ----------

/**
 * Switches a screen's device, keeping its top-left. Width follows the device; height is the device
 * height, or taller when content would otherwise be cut. Children are squeezed horizontally to fit.
 */
export function setFrameDevice(doc: BoardDoc, frameId: ID, device: Device): BoardDoc {
  const f = doc.frames[frameId];
  if (!f || f.device === device) return doc;
  const size = DEVICE_SIZES[device];
  const elements = { ...doc.elements };
  let lowest = 0;
  for (const e of Object.values(doc.elements)) {
    if (e.parentId !== frameId) continue;
    const w = Math.max(Math.min(e.w, size.w), Math.min(minSizeOf(e.type).w, size.w));
    const x = clamp(e.x, 0, Math.max(0, size.w - w));
    if (w !== e.w || x !== e.x) elements[e.id] = { ...e, w, x };
    lowest = Math.max(lowest, e.y + e.h);
  }
  const h = Math.max(size.h, lowest ? lowest + STACK_GAP + deviceContentInset(device).bottom : 0);
  return { ...doc, elements, frames: { ...doc.frames, [frameId]: { ...f, device, w: size.w, h } } };
}

function withoutStart(f: Frame): Frame {
  const next = { ...f };
  delete next.isStart;
  return next;
}

/**
 * Marks (or unmarks) a screen as its flow's start. Only one start per flow; the flow's name and
 * options follow the new start id (flow id = start screen id).
 */
export function setStartScreen(doc: BoardDoc, frameId: ID, on: boolean): BoardDoc {
  const f = doc.frames[frameId];
  if (!f || !!f.isStart === on) return doc;
  const before = detectFlows(doc, { includeSingles: true }).find((fl) => fl.frameIds.includes(frameId));
  const frames = { ...doc.frames };
  if (on) {
    for (const id of before?.frameIds ?? []) if (id !== frameId && frames[id].isStart) frames[id] = withoutStart(frames[id]);
    frames[frameId] = { ...f, isStart: true };
  } else frames[frameId] = withoutStart(f);
  let next: BoardDoc = { ...doc, frames };
  const after = detectFlows(next, { includeSingles: true }).find((fl) => fl.frameIds.includes(frameId));
  const oldId = before?.id;
  const newId = after?.id;
  if (oldId && newId && oldId !== newId) {
    if (next.flowNames[oldId] !== undefined) {
      const names = { ...next.flowNames, [newId]: next.flowNames[oldId] };
      delete names[oldId];
      next = { ...next, flowNames: names };
    }
    const moved = Object.values(next.variants).filter((v) => v.flowId === oldId);
    if (moved.length) {
      const vs = { ...next.variants };
      for (const v of moved) vs[v.id] = { ...v, flowId: newId };
      next = { ...next, variants: vs };
    }
  }
  return next;
}

// ---------- align / distribute ----------

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Top-level ids of a selection (children whose screen is also selected move with it). */
function topLevel(doc: BoardDoc, ids: ID[]): ID[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    if (doc.frames[id]) return true;
    const e = doc.elements[id];
    return !!e && !(e.parentId && set.has(e.parentId));
  });
}

/** Moves a node so its absolute top-left is (x, y); children stay inside their screen. */
function moveAbs(doc: BoardDoc, id: ID, x: number, y: number): BoardDoc {
  const f = doc.frames[id];
  if (f) return setNodeBox(doc, id, { x: Math.round(x), y: Math.round(y), w: f.w, h: f.h });
  const e = doc.elements[id];
  if (!e) return doc;
  const p = e.parentId ? doc.frames[e.parentId] : undefined;
  let box: Box = { x: Math.round(x - (p?.x ?? 0)), y: Math.round(y - (p?.y ?? 0)), w: e.w, h: e.h };
  if (p) box = clampInside(box, p);
  return setNodeBox(doc, id, box);
}

export function alignNodes(doc: BoardDoc, ids: ID[], mode: AlignMode): BoardDoc {
  const top = topLevel(doc, ids);
  if (top.length < 2) return doc;
  const rects = top.map((id) => [id, absRect(doc, id)!] as const);
  const minX = Math.min(...rects.map(([, r]) => r.x));
  const maxX = Math.max(...rects.map(([, r]) => r.x + r.w));
  const minY = Math.min(...rects.map(([, r]) => r.y));
  const maxY = Math.max(...rects.map(([, r]) => r.y + r.h));
  let next = doc;
  for (const [id, r] of rects) {
    let { x, y } = r;
    if (mode === 'left') x = minX;
    else if (mode === 'right') x = maxX - r.w;
    else if (mode === 'center') x = (minX + maxX) / 2 - r.w / 2;
    else if (mode === 'top') y = minY;
    else if (mode === 'bottom') y = maxY - r.h;
    else y = (minY + maxY) / 2 - r.h / 2;
    next = moveAbs(next, id, x, y);
  }
  return next;
}

/** Equal gaps between neighbours along an axis (first and last stay put). Needs 3+ items. */
export function distributeNodes(doc: BoardDoc, ids: ID[], axis: 'horizontal' | 'vertical'): BoardDoc {
  const top = topLevel(doc, ids);
  if (top.length < 3) return doc;
  const hz = axis === 'horizontal';
  const rects = top.map((id) => ({ id, r: absRect(doc, id)! }))
    .sort((a, b) => (hz ? a.r.x - b.r.x : a.r.y - b.r.y) || compareZ(a.id, b.id));
  const start = hz ? rects[0].r.x : rects[0].r.y;
  const last = rects[rects.length - 1].r;
  const end = hz ? last.x + last.w : last.y + last.h;
  const total = rects.reduce((s, { r }) => s + (hz ? r.w : r.h), 0);
  const gap = (end - start - total) / (rects.length - 1);
  let cursor = start;
  let next = doc;
  for (const { id, r } of rects) {
    next = hz ? moveAbs(next, id, cursor, r.y) : moveAbs(next, id, r.x, cursor);
    cursor += (hz ? r.w : r.h) + gap;
  }
  return next;
}
