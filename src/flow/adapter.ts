// BoardDoc → React Flow nodes/edges. Pure; React Flow is only used for types.

import type { Edge, Node } from '@xyflow/react';
import type { Anchor, BoardDoc, Connector, Element, Frame, ID, VariantGroup } from '../model/types';
import { boundsOf, framesInVariant, linkSourceIds, type Rect } from './ops';

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

export function docToNodes(doc: BoardDoc): FlowNode[] {
  const sources = linkSourceIds(doc);
  const lanes: LaneFlowNode[] = Object.values(doc.variants).flatMap((variant) => {
    const b = boundsOf(framesInVariant(doc, variant.id));
    if (!b) return [];
    const w = b.w + LANE_PAD.x * 2;
    const h = b.h + LANE_PAD.top + LANE_PAD.bottom;
    return [{
      id: laneNodeId(variant.id), type: 'lane', position: { x: b.x - LANE_PAD.x, y: b.y - LANE_PAD.top },
      data: { variant, w, h }, width: w, height: h, zIndex: -1,
      draggable: false, selectable: false, connectable: false, deletable: false, focusable: false,
    } satisfies LaneFlowNode];
  });
  const byZ = <T extends { z: string }>(a: T, b: T) => a.z.localeCompare(b.z);
  const frames: ScreenFlowNode[] = Object.values(doc.frames).sort(byZ).map((frame) => ({
    id: frame.id, type: 'screen', position: { x: frame.x, y: frame.y },
    data: { frame }, width: frame.w, height: frame.h,
    ariaLabel: `Screen '${frame.name}' (${frame.device})`,
  }));
  const elements = Object.values(doc.elements).sort(byZ);
  const toKit = (element: Element): KitFlowNode => ({
    id: element.id, type: 'kit', position: { x: element.x, y: element.y },
    data: { element, isLinkSource: sources.has(element.id) },
    width: element.w, height: element.h,
    ...(element.parentId && doc.frames[element.parentId] ? { parentId: element.parentId, extent: 'parent' as const } : {}),
  });
  // Parents must precede children; canvas shapes sit above screens.
  return [
    ...lanes,
    ...frames,
    ...elements.filter((e) => e.parentId && doc.frames[e.parentId]).map(toKit),
    ...elements.filter((e) => !e.parentId || !doc.frames[e.parentId]).map((e) => ({ ...toKit(e), zIndex: 1 })),
  ];
}

export function docToEdges(doc: BoardDoc): SketchFlowEdge[] {
  const linkConnectors = new Set(Object.values(doc.links).map((l) => l.connectorId).filter(Boolean));
  return Object.values(doc.connectors).flatMap((c) => {
    const from = absoluteRect(doc, c.from.nodeId);
    const to = absoluteRect(doc, c.to.nodeId);
    if (!from || !to) return [];
    const [sourceHandle, targetHandle] = resolveAnchors(from, to, c.from.anchor, c.to.anchor);
    return [{
      id: c.id, type: 'sketch', source: c.from.nodeId, target: c.to.nodeId, sourceHandle, targetHandle,
      zIndex: 1000,
      data: { label: c.label, routing: c.style, arrowheads: c.arrowheads, isLink: linkConnectors.has(c.id) },
      ariaLabel: c.label ? `Connector '${c.label}'` : 'Connector',
    } satisfies SketchFlowEdge];
  });
}

export function docToReactFlow(doc: BoardDoc): { nodes: FlowNode[]; edges: SketchFlowEdge[] } {
  return { nodes: docToNodes(doc), edges: docToEdges(doc) };
}
