// Pure helpers for export: which part of the doc to render, its bounds, pixel caps, file names.
import { Position, getBezierPath, getSmoothStepPath, getStraightPath } from '@xyflow/react';
import type { BoardDoc, Connector, Element, ID } from '../model/types';
import { DEVICE_TITLE_H } from '../kit/wireframe/DeviceFrame';
import { LANE_PAD, absoluteRect, resolveAnchors } from '../flow/adapter';
import { boundsOf, framesInVariant, type Rect } from '../flow/ops';
import { pathToPoints } from '../flow/SketchEdge';
import { routeBoard } from '../flow/routing';

export type ExportScope = 'board' | 'selection' | 'option';
export type ExportFormat = 'png' | 'pdf';
export type ExportBackground = 'white' | 'transparent';

/** Space around the content in the exported image (CSS px). */
export const EXPORT_MARGIN = 48;
export const MAX_SIDE_PX = 16_000;
export const MAX_TOTAL_PX = 64_000_000;
/** PDF user-unit limit per page side (pt). */
export const MAX_PDF_SIDE_PT = 14_400;

const LANE_PREFIX = 'lane:';

/**
 * The sub-document an export renders.
 * - board: everything.
 * - selection: selected screens + their children, selected loose elements, and connectors whose
 *   both ends are included. Selecting an option lane selects its screens. A selected element
 *   whose screen isn't selected is exported on its own at its canvas position.
 * - option: screens (+children) and loose elements of the variant, with its lane outline.
 */
export function scopeDoc(doc: BoardDoc, opts: { scope: ExportScope; selectionIds?: ID[]; variantId?: ID }): BoardDoc {
  if (opts.scope === 'board') return doc;

  const frameIds = new Set<ID>();
  const elementIds = new Set<ID>();
  if (opts.scope === 'selection') {
    for (const id of opts.selectionIds ?? []) {
      if (id.startsWith(LANE_PREFIX)) framesInVariant(doc, id.slice(LANE_PREFIX.length)).forEach((f) => frameIds.add(f.id));
      else if (doc.frames[id]) frameIds.add(id);
      else if (doc.elements[id]) elementIds.add(id);
    }
  } else {
    const vid = opts.variantId;
    if (vid) {
      framesInVariant(doc, vid).forEach((f) => frameIds.add(f.id));
      for (const e of Object.values(doc.elements)) if (e.variantId === vid && !e.parentId) elementIds.add(e.id);
    }
  }
  for (const e of Object.values(doc.elements)) if (e.parentId && frameIds.has(e.parentId)) elementIds.add(e.id);

  const frames: BoardDoc['frames'] = {};
  for (const id of frameIds) frames[id] = doc.frames[id];
  const elements: BoardDoc['elements'] = {};
  for (const id of elementIds) {
    const e = doc.elements[id];
    if (e.parentId && !frameIds.has(e.parentId)) {
      // Orphaned by the scope: keep its absolute canvas position, render it loose.
      const r = absoluteRect(doc, id)!;
      const { parentId: _drop, ...rest } = e;
      void _drop;
      elements[id] = { ...rest, x: r.x, y: r.y } as Element;
    } else elements[id] = e;
  }
  const nodeIds = new Set<ID>([...frameIds, ...elementIds]);
  const connectors: BoardDoc['connectors'] = {};
  for (const c of Object.values(doc.connectors)) if (nodeIds.has(c.from.nodeId) && nodeIds.has(c.to.nodeId)) connectors[c.id] = c;
  const links: BoardDoc['links'] = {};
  for (const l of Object.values(doc.links)) if (elementIds.has(l.sourceElementId) && frameIds.has(l.targetFrameId)) links[l.id] = l;
  const variants: BoardDoc['variants'] = {};
  if (opts.scope === 'option' && opts.variantId && doc.variants[opts.variantId]) variants[opts.variantId] = doc.variants[opts.variantId];

  return { ...doc, frames, elements, connectors, links, variants, flowNames: { ...doc.flowNames } };
}

/** Lane rect (canvas coords) for an option group, matching the editor's lane outline. */
export function laneRect(doc: BoardDoc, variantId: ID): Rect | undefined {
  const b = boundsOf(framesInVariant(doc, variantId));
  if (!b) return undefined;
  return { x: b.x - LANE_PAD.x, y: b.y - LANE_PAD.top, w: b.w + LANE_PAD.x * 2, h: b.h + LANE_PAD.top + LANE_PAD.bottom };
}

const isLoose = (doc: BoardDoc, e: Element) => !e.parentId || !doc.frames[e.parentId];

/** Bounds of everything drawn: screens incl. the name label above them, loose elements, lanes. */
export function contentBounds(doc: BoardDoc): Rect | undefined {
  const rects: Rect[] = [
    ...Object.values(doc.frames).map((f) => ({ x: f.x, y: f.y - DEVICE_TITLE_H, w: f.w, h: f.h + DEVICE_TITLE_H })),
    ...Object.values(doc.elements).filter((e) => isLoose(doc, e)).map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h })),
    ...Object.keys(doc.variants).map((id) => laneRect(doc, id)).filter((r): r is Rect => !!r),
  ];
  return boundsOf(rects);
}

/** Device-pixel ratio for the capture: 2× where possible, scaled down to stay inside browser canvas limits. */
export function capPixelRatio(w: number, h: number, desired = 2, maxSide = MAX_SIDE_PX, maxTotal = MAX_TOTAL_PX): number {
  if (w <= 0 || h <= 0) return desired;
  return Math.min(desired, maxSide / w, maxSide / h, Math.sqrt(maxTotal / (w * h)));
}

/** PDF page size in points for content of w×h CSS px (1px = 0.75pt), shrunk to the PDF page limit. */
export function pdfPageSize(w: number, h: number): { w: number; h: number; orientation: 'landscape' | 'portrait' } {
  let pw = w * 0.75;
  let ph = h * 0.75;
  const k = Math.min(1, MAX_PDF_SIDE_PT / pw, MAX_PDF_SIDE_PT / ph);
  pw *= k;
  ph *= k;
  return { w: pw, h: ph, orientation: pw >= ph ? 'landscape' : 'portrait' };
}

export function scopeLabel(doc: BoardDoc, scope: ExportScope, variantId?: ID): string {
  if (scope === 'selection') return 'Selection';
  if (scope === 'option') return (variantId && doc.variants[variantId]?.label) || 'Option';
  return 'Whole board';
}

/** "<board title> – <scope>.png", safe on every OS. */
export function exportFileName(title: string, label: string, format: ExportFormat): string {
  const clean = (s: string) =>
    s
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ') // eslint-disable-line no-control-regex
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '');
  const base = clean(title).slice(0, 100) || 'FlowSketch board';
  const part = clean(label).slice(0, 40);
  return `${part ? `${base} – ${part}` : base}.${format}`;
}

// ---------- connector geometry (same routing as the canvas's SketchEdge) ----------

type Side = 'top' | 'right' | 'bottom' | 'left';
const POS: Record<Side, Position> = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };

function sidePoint(r: Rect, side: Side): [number, number] {
  if (side === 'top') return [r.x + r.w / 2, r.y];
  if (side === 'bottom') return [r.x + r.w / 2, r.y + r.h];
  if (side === 'left') return [r.x, r.y + r.h / 2];
  return [r.x + r.w, r.y + r.h / 2];
}

function sampleBezier(d: string, steps = 16): [number, number][] {
  const n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  if (n.length < 8) return pathToPoints(d);
  const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ] as [number, number];
  });
}

export interface EdgeGeometry { points: [number, number][]; labelX: number; labelY: number }

/** Polyline (canvas coords) + label position for a connector, or undefined if an end is missing. */
export function connectorGeometry(doc: BoardDoc, c: Connector): EdgeGeometry | undefined {
  const from = absoluteRect(doc, c.from.nodeId);
  const to = absoluteRect(doc, c.to.nodeId);
  if (!from || !to) return undefined;
  const route = routeBoard(doc).get(c.id);
  if (route) return { points: route.points, labelX: route.labelX, labelY: route.labelY };
  const [sa, ta] = resolveAnchors(from, to, c.from.anchor, c.to.anchor) as [Side, Side];
  const [sourceX, sourceY] = sidePoint(from, sa);
  const [targetX, targetY] = sidePoint(to, ta);
  const args = { sourceX, sourceY, targetX, targetY, sourcePosition: POS[sa], targetPosition: POS[ta] };
  const [path, labelX, labelY] =
    c.style === 'straight' ? getStraightPath(args)
      : c.style === 'curved' ? getBezierPath(args)
        : getSmoothStepPath({ ...args, borderRadius: 0, offset: 24 });
  const points = c.style === 'curved' ? sampleBezier(path) : pathToPoints(path);
  return { points, labelX, labelY };
}
