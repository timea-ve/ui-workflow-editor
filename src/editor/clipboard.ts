// Copy / paste / duplicate. A selection is serialized to a self-contained payload (JSON text with a
// FlowSketch marker, so it survives the system clipboard and works across boards). Pasting remaps
// every id, gives fresh z keys above everything, and drops anything that would dangle.
import { nanoid } from 'nanoid';
import type { BoardDoc, Connector, Element, Frame, ID, ScreenLink } from '../model/types';
import { absoluteRect } from '../flow/adapter';
import { compareZ, maxZ, zKeysAfter } from '../flow/ops';
import { unionBox, type Box } from './snap';

export const CLIPBOARD_MARKER = 'flowsketch/v1';
export const PASTE_OFFSET = 24;

export interface ClipboardPayload {
  marker: typeof CLIPBOARD_MARKER;
  sourceBoardId?: ID;
  frames: Frame[];
  elements: Element[];
  connectors: Connector[];
  links: ScreenLink[];
  /** Absolute canvas position of each copied element (for re-parenting on paste). */
  abs: Record<ID, { x: number; y: number }>;
  /** Absolute bounds of the top-level copied items. */
  bounds: Box;
}

/** Serializes the selection. Frames bring their children; connectors/links come along when both ends do. */
export function copySelection(doc: BoardDoc, nodeIds: ID[], connectorIds: ID[] = [], sourceBoardId?: ID): ClipboardPayload | undefined {
  const frameIds = new Set(nodeIds.filter((id) => doc.frames[id]));
  const elementIds = new Set(nodeIds.filter((id) => doc.elements[id] && !frameIds.has(doc.elements[id].parentId ?? '')));
  const frames = [...frameIds].map((id) => doc.frames[id]);
  const elements = Object.values(doc.elements).filter((e) => elementIds.has(e.id) || (e.parentId && frameIds.has(e.parentId)));
  if (!frames.length && !elements.length) return undefined;
  const inSet = new Set<ID>([...frames.map((f) => f.id), ...elements.map((e) => e.id)]);
  const links = Object.values(doc.links).filter((l) => inSet.has(l.sourceElementId) && inSet.has(l.targetFrameId));
  const linkConnectors = new Set(links.map((l) => l.connectorId).filter(Boolean));
  const allLinkConnectors = new Set(Object.values(doc.links).map((l) => l.connectorId).filter(Boolean));
  const explicit = new Set(connectorIds);
  const connectors = Object.values(doc.connectors).filter((c) =>
    inSet.has(c.from.nodeId) && inSet.has(c.to.nodeId)
    && (linkConnectors.has(c.id) || !allLinkConnectors.has(c.id) || explicit.has(c.id)));
  const abs: ClipboardPayload['abs'] = {};
  for (const e of elements) {
    const r = absoluteRect(doc, e.id)!;
    abs[e.id] = { x: r.x, y: r.y };
  }
  const top: Box[] = [
    ...frames.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h })),
    ...elements.filter((e) => elementIds.has(e.id)).map((e) => ({ ...abs[e.id], w: e.w, h: e.h })),
  ];
  return { marker: CLIPBOARD_MARKER, sourceBoardId, frames, elements, connectors, links, abs, bounds: unionBox(top)! };
}

export const serializeClipboard = (p: ClipboardPayload) => JSON.stringify(p);

export function parseClipboard(text: string | null | undefined): ClipboardPayload | undefined {
  if (!text || !text.includes(CLIPBOARD_MARKER)) return undefined;
  try {
    const p = JSON.parse(text) as ClipboardPayload;
    if (p?.marker !== CLIPBOARD_MARKER || !Array.isArray(p.frames) || !Array.isArray(p.elements)) return undefined;
    return { ...p, connectors: p.connectors ?? [], links: p.links ?? [], abs: p.abs ?? {} };
  } catch {
    return undefined;
  }
}

export interface PasteOptions {
  /** Translate everything by this much (cascading paste: +24 each time). */
  offset?: { x: number; y: number };
  /** Centre the pasted group on this canvas point instead. */
  at?: { x: number; y: number };
  /** Lone elements go into this frame (e.g. the selected screen). */
  targetFrameId?: ID;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Inserts a payload with fresh ids. Returns the new doc and the new top-level node ids (to select). */
export function pastePayload(doc: BoardDoc, p: ClipboardPayload, opts: PasteOptions = {}): { doc: BoardDoc; ids: ID[] } {
  const idMap = new Map<ID, ID>();
  const newId = (old: ID) => { let n = idMap.get(old); if (!n) { n = nanoid(); idMap.set(old, n); } return n; };
  const copiedFrames = new Set(p.frames.map((f) => f.id));

  const t = opts.at
    ? { x: Math.round(opts.at.x - (p.bounds.x + p.bounds.w / 2)), y: Math.round(opts.at.y - (p.bounds.y + p.bounds.h / 2)) }
    : opts.offset ?? { x: PASTE_OFFSET, y: PASTE_OFFSET };

  // Fresh z keys above everything, preserving relative order.
  const ordered = [...p.frames, ...p.elements].sort((a, b) => compareZ(a.z, b.z));
  const keys = zKeysAfter(maxZ(doc), ordered.length);
  const zOf = new Map(ordered.map((e, i) => [e.id, keys[i]]));

  const frames = { ...doc.frames };
  const elements = { ...doc.elements };
  const ids: ID[] = [];
  for (const f of p.frames) {
    const { isStart: _s, variantId: _v, ...rest } = f;
    const id = newId(f.id);
    frames[id] = { ...rest, id, x: f.x + t.x, y: f.y + t.y, z: zOf.get(f.id)! };
    ids.push(id);
  }
  for (const e of p.elements) {
    const { variantId: _v, parentId, ...rest } = e;
    const id = newId(e.id);
    if (parentId && copiedFrames.has(parentId)) {
      elements[id] = { ...rest, id, parentId: newId(parentId), z: zOf.get(e.id)! };
      continue;
    }
    const target = (opts.targetFrameId && frames[opts.targetFrameId] ? opts.targetFrameId : undefined)
      ?? (parentId && doc.frames[parentId] ? parentId : undefined);
    const abs = p.abs[e.id] ?? { x: e.x, y: e.y };
    if (target) {
      const f = frames[target];
      let rel: { x: number; y: number };
      if (opts.at || target === parentId) rel = { x: abs.x + t.x - f.x, y: abs.y + t.y - f.y };
      // Into another screen: keep its spot relative to the screen it came from…
      else if (parentId) rel = { x: e.x + t.x, y: e.y + t.y };
      // …or, from the open canvas, near the screen's top-left keeping the group's layout.
      else rel = { x: abs.x - p.bounds.x + PASTE_OFFSET, y: abs.y - p.bounds.y + PASTE_OFFSET };
      const x = clamp(rel.x, 0, Math.max(0, f.w - e.w));
      const y = clamp(rel.y, 0, Math.max(0, f.h - e.h));
      elements[id] = { ...rest, id, parentId: target, x, y, z: zOf.get(e.id)! };
    } else {
      elements[id] = { ...rest, id, x: abs.x + t.x, y: abs.y + t.y, z: zOf.get(e.id)! };
    }
    ids.push(id);
  }

  const connectors = { ...doc.connectors };
  for (const c of p.connectors) {
    if (!idMap.has(c.from.nodeId) || !idMap.has(c.to.nodeId)) continue;
    const { variantId: _v, ...rest } = c;
    const id = newId(c.id);
    connectors[id] = { ...rest, id, from: { ...c.from, nodeId: newId(c.from.nodeId) }, to: { ...c.to, nodeId: newId(c.to.nodeId) } };
  }
  const links = { ...doc.links };
  for (const l of p.links) {
    if (!idMap.has(l.sourceElementId) || !idMap.has(l.targetFrameId)) continue;
    const id = newId(l.id);
    links[id] = {
      ...l, id, sourceElementId: newId(l.sourceElementId), targetFrameId: newId(l.targetFrameId),
      ...(l.connectorId && connectors[idMap.get(l.connectorId) ?? ''] ? { connectorId: idMap.get(l.connectorId) } : { connectorId: undefined }),
    };
    if (!links[id].connectorId) delete links[id].connectorId;
  }
  return { doc: { ...doc, frames, elements, connectors, links }, ids };
}

/** Copy + paste in one go (Cmd+D). */
export function duplicateSelection(doc: BoardDoc, nodeIds: ID[], connectorIds: ID[] = []): { doc: BoardDoc; ids: ID[] } {
  const p = copySelection(doc, nodeIds, connectorIds);
  return p ? pastePayload(doc, p) : { doc, ids: [] };
}
