// BoardDoc → React Flow nodes/edges. Pure; React Flow is only used for types.

import type { Edge, Node } from '@xyflow/react';
import type { Anchor, BoardDoc, Connector, Element, Frame, ID, VariantGroup } from '../model/types';
import { boundsOf, compareZ, framesInVariant, linkSourceIds, type Rect } from './ops';

export type ScreenNodeData = { frame: Frame };
export type KitNodeData = { element: Element; isLinkSource: boolean };
export type LaneNodeData = { variant: VariantGroup; w: number; h: number };
export type SketchEdgeData = {
  label?: string;
  routing: Connector['style'];
  arrowheads: Connector['arrowheads'];
  isLink: boolean;
};

export type ScreenFlowNode = Node<ScreenNodeData, 'screen'>;
export type KitFlowNode = Node<KitNodeData, 'kit'>;
export type LaneFlowNode = Node<LaneNodeData, 'lane'>;
export type FlowNode = ScreenFlowNode | KitFlowNode | LaneFlowNode;
export type SketchFlowEdge = Edge<SketchEdgeData, 'sketch'>;

export const LANE_PAD = { x: 48, top: 72, bottom: 48 };
export const laneNodeId = (variantId: ID) => `lane:${variantId}`;

/** Absolute canvas rect of a frame or element. */
export function absoluteRect(doc: BoardDoc, nodeId: ID): Rect | undefined {
  const f = doc.frames[nodeId];
  if (f) return { x: f.x, y: f.y, w: f.w, h: f.h };
  const e = doc.elements[nodeId];
  if (!e) return undefined;
  const p = e.parentId ? doc.frames[e.parentId] : undefined;
  return { x: e.x + (p?.x ?? 0), y: e.y + (p?.y ?? 0), w: e.w, h: e.h };
}

/** Resolves 'auto' anchors by comparing the two boxes: mostly horizontal → left/right, else top/bottom. */
export function resolveAnchors(from: Rect, to: Rect, fromAnchor: Anchor = 'auto', toAnchor: Anchor = 'auto'): [Exclude<Anchor, 'auto'>, Exclude<Anchor, 'auto'>] {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  // Gaps between the boxes decide better than centre deltas for big screens vs. small buttons.
  const gapX = Math.max(to.x - (from.x + from.w), from.x - (to.x + to.w));
  const gapY = Math.max(to.y - (from.y + from.h), from.y - (to.y + to.h));
  const horizontal = gapX > 0 || gapY > 0 ? gapX >= gapY : Math.abs(dx) >= Math.abs(dy);
  const autoFrom = horizontal ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  const autoTo = horizontal ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
  return [fromAnchor === 'auto' ? autoFrom : fromAnchor, toAnchor === 'auto' ? autoTo : toAnchor];
}

/** React Flow zIndex layout: frames get even ranks (children render at rank+1), then edges, then canvas shapes. */
export const FRAME_Z_STEP = 2;
export const EDGE_Z = 100_000;
export const CANVAS_Z_BASE = 200_000;

const byZ = <T extends { z: string; id: string }>(a: T, b: T) => compareZ(a.z, b.z) || compareZ(a.id, b.id);

/**
 * BoardDoc → nodes, reusing node objects from `prev` whenever the underlying entity (by reference)
 * and derived fields are unchanged. Reused nodes keep their UI state (selection, measured size,
 * transient drag position), so React Flow and the memoised node components skip them entirely.
 */
export function reconcileNodes(doc: BoardDoc, prev: readonly FlowNode[] = []): FlowNode[] {
  const prevById = new Map<string, FlowNode>();
  for (const n of prev) prevById.set(n.id, n);
  const ui = (p: FlowNode | undefined) => (p ? { selected: p.selected, measured: p.measured } : {});
  const sources = linkSourceIds(doc);

  const lanes: LaneFlowNode[] = Object.values(doc.variants).flatMap((variant) => {
    const b = boundsOf(framesInVariant(doc, variant.id));
    if (!b) return [];
    const id = laneNodeId(variant.id);
    const w = b.w + LANE_PAD.x * 2;
    const h = b.h + LANE_PAD.top + LANE_PAD.bottom;
    const x = b.x - LANE_PAD.x;
    const y = b.y - LANE_PAD.top;
    const p = prevById.get(id) as LaneFlowNode | undefined;
    if (p && p.data.variant === variant && p.data.w === w && p.data.h === h && p.position.x === x && p.position.y === y) return [p];
    return [{
      id, type: 'lane', position: { x, y },
      data: { variant, w, h }, width: w, height: h, zIndex: -1,
      draggable: false, selectable: false, connectable: false, deletable: false, focusable: false,
      ...(p ? { measured: p.measured } : {}),
    } satisfies LaneFlowNode];
  });

  const frames: ScreenFlowNode[] = Object.values(doc.frames).sort(byZ).map((frame, i) => {
    const zIndex = i * FRAME_Z_STEP;
    const p = prevById.get(frame.id) as ScreenFlowNode | undefined;
    if (p && p.type === 'screen' && p.data.frame === frame && p.zIndex === zIndex) return p;
    return {
      id: frame.id, type: 'screen', position: { x: frame.x, y: frame.y },
      data: p?.type === 'screen' && p.data.frame === frame ? p.data : { frame },
      width: frame.w, height: frame.h, zIndex,
      ariaLabel: `Screen '${frame.name}' (${frame.device})`,
      ...ui(p),
    };
  });

  const elements = Object.values(doc.elements).sort(byZ);
  const toKit = (element: Element, zIndex: number | undefined): KitFlowNode => {
    const isLinkSource = sources.has(element.id);
    const inFrame = !!element.parentId && !!doc.frames[element.parentId];
    const p = prevById.get(element.id) as KitFlowNode | undefined;
    if (p && p.type === 'kit' && p.data.element === element && p.data.isLinkSource === isLinkSource
      && p.zIndex === zIndex && (p.parentId !== undefined) === inFrame) return p;
    return {
      id: element.id, type: 'kit', position: { x: element.x, y: element.y },
      data: p?.type === 'kit' && p.data.element === element && p.data.isLinkSource === isLinkSource ? p.data : { element, isLinkSource },
      width: element.w, height: element.h,
      ariaLabel: elementAriaLabel(element, isLinkSource),
      ...(zIndex !== undefined ? { zIndex } : {}),
      ...(inFrame ? { parentId: element.parentId, extent: 'parent' as const } : {}),
      ...ui(p),
    };
  };
  const children = elements.filter((e) => e.parentId && doc.frames[e.parentId]).map((e) => toKit(e, undefined));
  const canvas = elements.filter((e) => !e.parentId || !doc.frames[e.parentId]).map((e, i) => toKit(e, CANVAS_Z_BASE + i));
  // Parents must precede children; siblings render in z order; canvas shapes sit above screens.
  return [...lanes, ...frames, ...children, ...canvas];
}

function elementAriaLabel(e: Element, isLinkSource: boolean): string {
  const text = e.props.label ?? e.props.text ?? e.props.title;
  const base = typeof text === 'string' && text ? `${e.type} '${text}'` : e.type;
  return isLinkSource ? `${base}, links to another screen` : base;
}

export function docToNodes(doc: BoardDoc): FlowNode[] {
  return reconcileNodes(doc);
}

/** BoardDoc → edges, reusing edge objects whose connector, anchors and selection are unchanged. */
export function reconcileEdges(doc: BoardDoc, prev: readonly SketchFlowEdge[] = [], selected?: ReadonlySet<ID>): SketchFlowEdge[] {
  const prevById = new Map<string, SketchFlowEdge>();
  for (const e of prev) prevById.set(e.id, e);
  const linkConnectors = new Set(Object.values(doc.links).map((l) => l.connectorId).filter(Boolean));
  return Object.values(doc.connectors).flatMap((c) => {
    const from = absoluteRect(doc, c.from.nodeId);
    const to = absoluteRect(doc, c.to.nodeId);
    if (!from || !to) return [];
    const [sourceHandle, targetHandle] = resolveAnchors(from, to, c.from.anchor, c.to.anchor);
    const isLink = linkConnectors.has(c.id);
    const isSelected = selected?.has(c.id) ?? false;
    const p = prevById.get(c.id);
    if (p && p.source === c.from.nodeId && p.target === c.to.nodeId && p.sourceHandle === sourceHandle && p.targetHandle === targetHandle
      && p.data?.label === c.label && p.data?.routing === c.style && p.data?.arrowheads === c.arrowheads && p.data?.isLink === isLink
      && !!p.selected === isSelected) return [p];
    return [{
      id: c.id, type: 'sketch', source: c.from.nodeId, target: c.to.nodeId, sourceHandle, targetHandle,
      zIndex: EDGE_Z,
      data: { label: c.label, routing: c.style, arrowheads: c.arrowheads, isLink },
      ariaLabel: c.label ? `Connector '${c.label}'` : 'Connector',
      ...(isSelected ? { selected: true } : {}),
    } satisfies SketchFlowEdge];
  });
}

export function docToEdges(doc: BoardDoc): SketchFlowEdge[] {
  return reconcileEdges(doc);
}

export function docToReactFlow(doc: BoardDoc): { nodes: FlowNode[]; edges: SketchFlowEdge[] } {
  return { nodes: docToNodes(doc), edges: docToEdges(doc) };
}
