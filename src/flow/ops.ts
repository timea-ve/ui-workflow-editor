// Pure, immutable operations on BoardDoc. Every op returns a new doc (plus ids it created)
// and never mutates its input. See docs/phase-2/diagram-flow.md.

import { nanoid } from 'nanoid';
import {
  DEVICE_SIZES,
  type Anchor, type BoardDoc, type Connector, type Device, type Element, type ElementType,
  type Frame, type ID, type ScreenLink, type VariantGroup,
} from '../model/types';
import { kitRegistry } from '../kit/registry';

export const SCREEN_GAP = 120;
export const LANE_GAP = 200;

export function emptyDoc(): BoardDoc {
  return { frames: {}, elements: {}, connectors: {}, links: {}, variants: {}, flowNames: {} };
}

// ---------- z-order (simple sortable strings for now; fractional indexing later) ----------

const zNum = (z: string) => Number.parseInt(z.replace(/^z/, ''), 10) || 0;
const zStr = (n: number) => `z${String(n).padStart(8, '0')}`;

function nextZ(doc: BoardDoc): string {
  let max = 0;
  for (const f of Object.values(doc.frames)) max = Math.max(max, zNum(f.z));
  for (const e of Object.values(doc.elements)) max = Math.max(max, zNum(e.z));
  return zStr(max + 1);
}

const nodeExists = (doc: BoardDoc, id: ID) => !!doc.frames[id] || !!doc.elements[id];

// ---------- create ----------

export interface CreateScreenInput {
  device: Device;
  name?: string;
  x: number;
  y: number;
  isStart?: boolean;
  variantId?: ID;
}

export function createScreen(doc: BoardDoc, input: CreateScreenInput): { doc: BoardDoc; id: ID } {
  const id = nanoid();
  const size = DEVICE_SIZES[input.device];
  const frame: Frame = {
    id, kind: 'frame',
    name: input.name ?? `Screen ${Object.keys(doc.frames).length + 1}`,
    device: input.device,
    x: input.x, y: input.y, w: size.w, h: size.h,
    z: nextZ(doc),
    ...(input.isStart ? { isStart: true } : {}),
    ...(input.variantId ? { variantId: input.variantId } : {}),
  };
  return { doc: { ...doc, frames: { ...doc.frames, [id]: frame } }, id };
}

export interface AddElementInput {
  type: ElementType;
  /** Frame id. Coordinates are then relative to the frame. */
  parentId?: ID;
  x: number;
  y: number;
  w?: number;
  h?: number;
  props?: Record<string, unknown>;
}

export function addElement(doc: BoardDoc, input: AddElementInput): { doc: BoardDoc; id: ID } {
  if (input.parentId && !doc.frames[input.parentId]) throw new Error(`addElement: unknown frame ${input.parentId}`);
  const id = nanoid();
  const def = kitRegistry.get(input.type);
  const parent = input.parentId ? doc.frames[input.parentId] : undefined;
  const el: Element = {
    id, type: input.type,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    x: input.x, y: input.y,
    w: input.w ?? def?.defaultSize.w ?? 120,
    h: input.h ?? def?.defaultSize.h ?? 40,
    z: nextZ(doc),
    props: { ...(def?.defaultProps ?? {}), ...(input.props ?? {}) },
    ...(parent?.variantId ? { variantId: parent.variantId } : {}),
  };
  return { doc: { ...doc, elements: { ...doc.elements, [id]: el } }, id };
}

export interface ConnectorInput {
  label?: string;
  style?: Connector['style'];
  arrowheads?: Connector['arrowheads'];
  fromAnchor?: Anchor;
  toAnchor?: Anchor;
}

/** A plain visual connector between any two nodes (frames or elements). */
export function addConnector(doc: BoardDoc, fromId: ID, toId: ID, opts: ConnectorInput = {}): { doc: BoardDoc; id: ID } {
  if (!nodeExists(doc, fromId) || !nodeExists(doc, toId)) throw new Error('addConnector: unknown endpoint');
  const id = nanoid();
  const c: Connector = {
    id,
    from: { nodeId: fromId, anchor: opts.fromAnchor ?? 'auto' },
    to: { nodeId: toId, anchor: opts.toAnchor ?? 'auto' },
    style: opts.style ?? 'step',
    arrowheads: opts.arrowheads ?? 'end',
    ...(opts.label ? { label: opts.label } : {}),
  };
  return { doc: { ...doc, connectors: { ...doc.connectors, [id]: c } }, id };
}

export function updateConnectorLabel(doc: BoardDoc, connectorId: ID, label: string): BoardDoc {
  const c = doc.connectors[connectorId];
  if (!c) return doc;
  const next = { ...c };
  if (label.trim()) next.label = label; else delete next.label;
  return { ...doc, connectors: { ...doc.connectors, [connectorId]: next } };
}

// ---------- links ----------

/**
 * Makes an element clickable in Play: creates a ScreenLink + a Connector (element → frame).
 * An element has at most one click target, so an existing link from the element is replaced.
 */
export function linkElementToScreen(
  doc: BoardDoc, elementId: ID, targetFrameId: ID, opts: ConnectorInput = {},
): { doc: BoardDoc; linkId: ID; connectorId: ID } {
  if (!doc.elements[elementId]) throw new Error(`linkElementToScreen: unknown element ${elementId}`);
  if (!doc.frames[targetFrameId]) throw new Error(`linkElementToScreen: unknown frame ${targetFrameId}`);
  let next = doc;
  for (const l of Object.values(doc.links)) if (l.sourceElementId === elementId) next = deleteLink(next, l.id);
  const { doc: withConnector, id: connectorId } = addConnector(next, elementId, targetFrameId, opts);
  const linkId = nanoid();
  const link: ScreenLink = { id: linkId, sourceElementId: elementId, targetFrameId, trigger: 'click', connectorId };
  return { doc: { ...withConnector, links: { ...withConnector.links, [linkId]: link } }, linkId, connectorId };
}

/** Creates a new screen to the right of the source element's screen (120px gap, skipping occupied slots) and links to it. */
export function linkToNewScreen(
  doc: BoardDoc, elementId: ID, opts: { name?: string; device?: Device } = {},
): { doc: BoardDoc; frameId: ID; linkId: ID; connectorId: ID } {
  const el = doc.elements[elementId];
  if (!el) throw new Error(`linkToNewScreen: unknown element ${elementId}`);
  const src = el.parentId ? doc.frames[el.parentId] : undefined;
  const device = opts.device ?? src?.device ?? 'mobile';
  const size = DEVICE_SIZES[device];
  let x = src ? src.x + src.w + SCREEN_GAP : el.x + el.w + SCREEN_GAP;
  const y = src ? src.y : el.y;
  while (Object.values(doc.frames).some((f) => overlaps(f, { x, y, w: size.w, h: size.h }))) {
    x += size.w + SCREEN_GAP;
  }
  const created = createScreen(doc, { device, name: opts.name, x, y, variantId: src?.variantId });
  const linked = linkElementToScreen(created.doc, elementId, created.id);
  return { doc: linked.doc, frameId: created.id, linkId: linked.linkId, connectorId: linked.connectorId };
}

/**
 * One gesture, one visual language: a connection drawn from a linkable element inside a screen
 * to another screen becomes a link (clickable in Play); everything else is a plain connector.
 */
export function connectNodes(
  doc: BoardDoc, fromId: ID, toId: ID, opts: ConnectorInput = {},
): { doc: BoardDoc; connectorId: ID; linkId?: ID } {
  if (fromId === toId) throw new Error('connectNodes: cannot connect a node to itself');
  const el = doc.elements[fromId];
  const linkable = !!el?.parentId && el.parentId !== toId && kitRegistry.get(el.type)?.linkable !== false;
  if (linkable && doc.frames[toId]) {
    const r = linkElementToScreen(doc, fromId, toId, opts);
    return { doc: r.doc, connectorId: r.connectorId, linkId: r.linkId };
  }
  const r = addConnector(doc, fromId, toId, opts);
  return { doc: r.doc, connectorId: r.id };
}

// ---------- move / rename ----------

/** Positions are relative to the parent frame for child elements (same as React Flow). */
export function moveNode(doc: BoardDoc, id: ID, x: number, y: number): BoardDoc {
  const f = doc.frames[id];
  if (f) return f.x === x && f.y === y ? doc : { ...doc, frames: { ...doc.frames, [id]: { ...f, x, y } } };
  const e = doc.elements[id];
  if (e) return e.x === x && e.y === y ? doc : { ...doc, elements: { ...doc.elements, [id]: { ...e, x, y } } };
  return doc;
}

export function renameFrame(doc: BoardDoc, frameId: ID, name: string): BoardDoc {
  const f = doc.frames[frameId];
  return f ? { ...doc, frames: { ...doc.frames, [frameId]: { ...f, name } } } : doc;
}

// ---------- delete (cascading) ----------

export function deleteLink(doc: BoardDoc, linkId: ID): BoardDoc {
  const link = doc.links[linkId];
  if (!link) return doc;
  const links = { ...doc.links };
  delete links[linkId];
  const connectors = { ...doc.connectors };
  if (link.connectorId) delete connectors[link.connectorId];
  return { ...doc, links, connectors };
}

/** Removes a connector; a link backed by it is removed too (the arrow *is* the link). */
export function deleteConnector(doc: BoardDoc, connectorId: ID): BoardDoc {
  if (!doc.connectors[connectorId]) return doc;
  const connectors = { ...doc.connectors };
  delete connectors[connectorId];
  const links = Object.fromEntries(Object.entries(doc.links).filter(([, l]) => l.connectorId !== connectorId));
  return { ...doc, connectors, links };
}

function removeNodes(doc: BoardDoc, frameIds: Set<ID>, elementIds: Set<ID>): BoardDoc {
  const gone = new Set([...frameIds, ...elementIds]);
  const links = Object.fromEntries(
    Object.entries(doc.links).filter(([, l]) => !elementIds.has(l.sourceElementId) && !frameIds.has(l.targetFrameId)),
  );
  const droppedConnectorIds = new Set(
    Object.values(doc.links).filter((l) => !links[l.id] && l.connectorId).map((l) => l.connectorId as ID),
  );
  const connectors = Object.fromEntries(
    Object.entries(doc.connectors).filter(
      ([id, c]) => !gone.has(c.from.nodeId) && !gone.has(c.to.nodeId) && !droppedConnectorIds.has(id),
    ),
  );
  const frames = Object.fromEntries(Object.entries(doc.frames).filter(([id]) => !frameIds.has(id)));
  const elements = Object.fromEntries(Object.entries(doc.elements).filter(([id]) => !elementIds.has(id)));
  // Option groups with no screens left disappear.
  const usedVariants = new Set(Object.values(frames).map((f) => f.variantId).filter(Boolean));
  const variants = Object.fromEntries(Object.entries(doc.variants).filter(([id]) => usedVariants.has(id)));
  const flowNames = Object.fromEntries(Object.entries(doc.flowNames ?? {}).filter(([id]) => !frameIds.has(id)));
  return { frames, elements, connectors, links, variants, flowNames };
}

/** Deletes a screen and everything that depends on it: child elements, links in/out, connectors touching any of them. */
export function deleteFrame(doc: BoardDoc, frameId: ID): BoardDoc {
  if (!doc.frames[frameId]) return doc;
  const children = Object.values(doc.elements).filter((e) => e.parentId === frameId).map((e) => e.id);
  return removeNodes(doc, new Set([frameId]), new Set(children));
}

/** Deletes an element plus its links and any connector touching it. */
export function deleteElement(doc: BoardDoc, elementId: ID): BoardDoc {
  if (!doc.elements[elementId]) return doc;
  return removeNodes(doc, new Set(), new Set([elementId]));
}

/** Batch delete of frames and/or elements (frames take their children with them). */
export function deleteNodes(doc: BoardDoc, ids: ID[]): BoardDoc {
  const frameIds = new Set(ids.filter((id) => doc.frames[id]));
  const elementIds = new Set(ids.filter((id) => doc.elements[id]));
  for (const e of Object.values(doc.elements)) if (e.parentId && frameIds.has(e.parentId)) elementIds.add(e.id);
  if (!frameIds.size && !elementIds.size) return doc;
  return removeNodes(doc, frameIds, elementIds);
}

// ---------- flows ----------

export interface Flow {
  /** Derived id (the start screen's id) — stable as long as the start screen doesn't change. */
  id: ID;
  name: string;
  frameIds: ID[];
  startFrameId: ID;
  variantId?: ID;
}

/** The frame a node lives in (frames resolve to themselves; canvas elements to undefined). */
export function frameOf(doc: BoardDoc, nodeId: ID): ID | undefined {
  if (doc.frames[nodeId]) return nodeId;
  const parent = doc.elements[nodeId]?.parentId;
  return parent && doc.frames[parent] ? parent : undefined;
}

/** Screen-to-screen edges implied by links and by connectors whose both ends resolve to screens. */
function frameEdges(doc: BoardDoc): [ID, ID][] {
  const edges: [ID, ID][] = [];
  for (const l of Object.values(doc.links)) {
    const a = frameOf(doc, l.sourceElementId);
    if (a && doc.frames[l.targetFrameId] && a !== l.targetFrameId) edges.push([a, l.targetFrameId]);
  }
  for (const c of Object.values(doc.connectors)) {
    const a = frameOf(doc, c.from.nodeId);
    const b = frameOf(doc, c.to.nodeId);
    if (a && b && a !== b) edges.push([a, b]);
  }
  return edges;
}

const byPosition = (doc: BoardDoc) => (a: ID, b: ID) =>
  doc.frames[a].x - doc.frames[b].x || doc.frames[a].y - doc.frames[b].y || a.localeCompare(b);

/** Start screen: explicit isStart override, else a screen with no incoming links/arrows (left-most wins), else the left-most. */
export function getStartFrame(doc: BoardDoc, flowFrameIds: ID[]): ID | undefined {
  const ids = flowFrameIds.filter((id) => doc.frames[id]).sort(byPosition(doc));
  if (!ids.length) return undefined;
  const explicit = ids.find((id) => doc.frames[id].isStart);
  if (explicit) return explicit;
  const inFlow = new Set(ids);
  const hasIncoming = new Set(frameEdges(doc).filter(([a, b]) => inFlow.has(a) && inFlow.has(b)).map(([, b]) => b));
  return ids.find((id) => !hasIncoming.has(id)) ?? ids[0];
}

/**
 * Auto-detected flows: connected components of screens joined by links/connectors.
 * Lone screens are only included with `includeSingles`.
 */
export function detectFlows(doc: BoardDoc, opts: { includeSingles?: boolean } = {}): Flow[] {
  const parent = new Map<ID, ID>(Object.keys(doc.frames).map((id) => [id, id]));
  const find = (x: ID): ID => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const [a, b] of frameEdges(doc)) parent.set(find(a), find(b));
  const groups = new Map<ID, ID[]>();
  for (const id of Object.keys(doc.frames)) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }
  const flows: Flow[] = [];
  for (const ids of groups.values()) {
    if (ids.length < 2 && !opts.includeSingles) continue;
    const frameIds = [...ids].sort(byPosition(doc));
    const startFrameId = getStartFrame(doc, frameIds)!;
    const start = doc.frames[startFrameId];
    flows.push({ id: startFrameId, name: `${start.name} flow`, frameIds, startFrameId, ...(start.variantId ? { variantId: start.variantId } : {}) });
  }
  const pos = byPosition(doc);
  return flows.sort((a, b) => doc.frames[a.startFrameId].y - doc.frames[b.startFrameId].y || pos(a.startFrameId, b.startFrameId));
}

/** The flow containing a node (frame or element inside a frame). Lone screens form a one-screen flow. */
export function flowForNode(doc: BoardDoc, nodeId: ID): Flow | undefined {
  const frameId = frameOf(doc, nodeId);
  if (!frameId) return undefined;
  return detectFlows(doc, { includeSingles: true }).find((f) => f.frameIds.includes(frameId));
}

/** Links whose source element sits inside the given frame. */
export function getLinksFromFrame(doc: BoardDoc, frameId: ID): ScreenLink[] {
  return Object.values(doc.links).filter((l) => doc.elements[l.sourceElementId]?.parentId === frameId);
}

export function linkSourceIds(doc: BoardDoc): Set<ID> {
  return new Set(Object.values(doc.links).map((l) => l.sourceElementId));
}

// ---------- options (variants) ----------

export interface Rect { x: number; y: number; w: number; h: number }

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function boundsOf(rects: Rect[]): Rect | undefined {
  if (!rects.length) return undefined;
  const x = Math.min(...rects.map((f) => f.x));
  const y = Math.min(...rects.map((f) => f.y));
  const r = Math.max(...rects.map((f) => f.x + f.w));
  const b = Math.max(...rects.map((f) => f.y + f.h));
  return { x, y, w: r - x, h: b - y };
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function variantsInFlow(doc: BoardDoc, flowId: ID): VariantGroup[] {
  return Object.values(doc.variants).filter((v) => v.flowId === flowId).sort((a, b) => a.order.localeCompare(b.order));
}

export function framesInVariant(doc: BoardDoc, variantId: ID): Frame[] {
  return Object.values(doc.frames).filter((f) => f.variantId === variantId);
}

export function renameVariant(doc: BoardDoc, variantId: ID, label: string): BoardDoc {
  const v = doc.variants[variantId];
  return v ? { ...doc, variants: { ...doc.variants, [variantId]: { ...v, label } } } : doc;
}

/**
 * "Duplicate as option": deep-copies the screens, their child elements, and the connectors/links
 * internal to the selection, remapping ids so the copy's links point at the copy's screens.
 * The copy becomes a new lane below every existing option of the same flow.
 * The original becomes "Option A" if it isn't in an option group yet; the copy gets the next free letter.
 */
export function duplicateAsOption(
  doc: BoardDoc, frameIds: ID[],
): { doc: BoardDoc; variantId: ID; originalVariantId: ID; flowId: ID; frameIds: ID[]; idMap: Record<ID, ID> } {
  const sources = [...new Set(frameIds)].filter((id) => doc.frames[id]).map((id) => doc.frames[id]);
  if (!sources.length) throw new Error('duplicateAsOption: no screens selected');

  const next: BoardDoc = {
    frames: { ...doc.frames }, elements: { ...doc.elements }, connectors: { ...doc.connectors },
    links: { ...doc.links }, variants: { ...doc.variants }, flowNames: { ...doc.flowNames },
  };

  const sourceIds = new Set(sources.map((f) => f.id));
  const childIds = Object.values(doc.elements).filter((e) => e.parentId && sourceIds.has(e.parentId)).map((e) => e.id);
  const nodeIds = new Set([...sourceIds, ...childIds]);
  const internalConnectors = Object.values(doc.connectors).filter((c) => nodeIds.has(c.from.nodeId) && nodeIds.has(c.to.nodeId));
  const internalLinks = Object.values(doc.links).filter((l) => nodeIds.has(l.sourceElementId) && sourceIds.has(l.targetFrameId));

  // 1. Make sure the original belongs to an option group.
  const existing = sources.map((f) => f.variantId).find((v): v is ID => !!v && !!doc.variants[v]);
  let originalVariantId: ID;
  let flowId: ID;
  if (existing) {
    originalVariantId = existing;
    flowId = doc.variants[existing].flowId;
  } else {
    originalVariantId = nanoid();
    flowId = nanoid();
    next.variants[originalVariantId] = { id: originalVariantId, flowId, label: 'Option A', order: zStr(0) };
    for (const f of sources) next.frames[f.id] = { ...f, variantId: originalVariantId };
    for (const id of childIds) next.elements[id] = { ...next.elements[id], variantId: originalVariantId };
    for (const c of internalConnectors) next.connectors[c.id] = { ...c, variantId: originalVariantId };
  }

  // 2. New option group with the next free letter.
  const siblings = variantsInFlow(next, flowId);
  const used = new Set(siblings.map((v) => v.label));
  const letter = [...LETTERS].find((l) => !used.has(`Option ${l}`)) ?? String(siblings.length + 1);
  const variantId = nanoid();
  const order = zStr(Math.max(-1, ...siblings.map((v) => zNum(v.order))) + 1);
  next.variants[variantId] = { id: variantId, flowId, label: `Option ${letter}`, duplicatedFromId: originalVariantId, order };

  // 3. Place below every existing lane of this flow.
  const flowVariantIds = new Set(siblings.map((v) => v.id));
  const laneFrames = Object.values(next.frames).filter((f) => sourceIds.has(f.id) || (f.variantId && flowVariantIds.has(f.variantId)));
  const all = boundsOf(laneFrames)!;
  const src = boundsOf(sources)!;
  const dy = all.y + all.h + LANE_GAP - src.y;

  // 4. Copy with remapped ids.
  const idMap: Record<ID, ID> = {};
  for (const id of nodeIds) idMap[id] = nanoid();
  for (const c of internalConnectors) idMap[c.id] = nanoid();
  for (const l of internalLinks) idMap[l.id] = nanoid();
  let z = zNum(nextZ(next));
  const newFrameIds: ID[] = [];
  for (const f of sources) {
    const id = idMap[f.id];
    newFrameIds.push(id);
    next.frames[id] = { ...f, id, y: f.y + dy, z: zStr(z++), variantId };
  }
  for (const oldId of childIds) {
    const e = doc.elements[oldId];
    const id = idMap[oldId];
    next.elements[id] = { ...e, id, parentId: idMap[e.parentId!], z: zStr(z++), props: structuredClone(e.props), variantId };
  }
  for (const c of internalConnectors) {
    const id = idMap[c.id];
    next.connectors[id] = { ...c, id, from: { ...c.from, nodeId: idMap[c.from.nodeId] }, to: { ...c.to, nodeId: idMap[c.to.nodeId] }, variantId };
  }
  for (const l of internalLinks) {
    const id = idMap[l.id];
    const copy: ScreenLink = { ...l, id, sourceElementId: idMap[l.sourceElementId], targetFrameId: idMap[l.targetFrameId] };
    if (l.connectorId) {
      if (idMap[l.connectorId]) copy.connectorId = idMap[l.connectorId];
      else delete copy.connectorId;
    }
    next.links[id] = copy;
  }
  return { doc: next, variantId, originalVariantId, flowId, frameIds: newFrameIds, idMap };
}
