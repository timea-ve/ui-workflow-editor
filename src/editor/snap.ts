// Snap & alignment guides: pure math. The dragged selection's bounding box snaps its left/centre/right
// (and top/middle/bottom) lines to the same lines of nearby boxes when within `threshold` (flow px).
// On an axis where no neighbour line is in reach it tries equal spacing (same gap as two neighbours
// already have, or centred between two neighbours), and failing that snaps to the grid.

export interface Box { x: number; y: number; w: number; h: number }

export interface Guide {
  /** 'x' = vertical line at `pos`; 'y' = horizontal line at `pos`. Spans from..to on the other axis. */
  axis: 'x' | 'y';
  pos: number;
  from: number;
  to: number;
  /** 'gap' = an equal-spacing marker (drawn as a short segment across a gap). Default: alignment line. */
  kind?: 'gap';
}

export interface SnapOptions {
  /** Grid size (flow px). When set, an axis without a neighbour snap rounds the box origin to it. */
  grid?: number;
  /** Equal-spacing snapping between neighbours (default on). */
  spacing?: boolean;
}

export interface SnapResult { dx: number; dy: number; guides: Guide[] }

const xLines = (b: Box) => [b.x, b.x + b.w / 2, b.x + b.w];
const yLines = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h];

function bestOffset(moving: number[], targets: Box[], lines: (b: Box) => number[], threshold: number): number | undefined {
  let best: number | undefined;
  for (const t of targets) {
    for (const tl of lines(t)) {
      for (const ml of moving) {
        const d = tl - ml;
        if (Math.abs(d) <= threshold && (best === undefined || Math.abs(d) < Math.abs(best))) best = d;
      }
    }
  }
  return best;
}

/** Axis helpers so the spacing math is written once (x: horizontal row, y: vertical column). */
const AX = {
  x: { s: (b: Box) => b.x, e: (b: Box) => b.x + b.w, len: (b: Box) => b.w, os: (b: Box) => b.y, oe: (b: Box) => b.y + b.h },
  y: { s: (b: Box) => b.y, e: (b: Box) => b.y + b.h, len: (b: Box) => b.h, os: (b: Box) => b.x, oe: (b: Box) => b.x + b.w },
};

interface SpacingHit { d: number; guides: Guide[] }

/** Equal-spacing offset along `axis`: match an existing gap between neighbours, or centre between two. */
function spacingOffset(box: Box, targets: Box[], axis: 'x' | 'y', threshold: number): SpacingHit | undefined {
  const a = AX[axis];
  // Only boxes in the same row (x) / column (y) count: they must overlap the moving box on the other axis.
  const row = targets
    .filter((t) => a.os(t) < a.oe(box) && a.oe(t) > a.os(box) && a.len(t) > 0)
    .sort((p, q) => a.s(p) - a.s(q));
  if (!row.length) return undefined;
  const mid = (p: Box, q: Box) => (Math.max(a.os(p), a.os(q)) + Math.min(a.oe(p), a.oe(q))) / 2;
  const seg = (from: number, to: number, p: Box, q: Box): Guide =>
    ({ axis: axis === 'x' ? 'y' : 'x', pos: mid(p, q), from, to, kind: 'gap' });
  const gaps: { g: number; p: Box; q: Box }[] = [];
  for (let i = 0; i + 1 < row.length; i++) {
    const g = a.s(row[i + 1]) - a.e(row[i]);
    if (g > 0) gaps.push({ g, p: row[i], q: row[i + 1] });
  }
  const before = row.filter((t) => a.e(t) <= a.s(box) + threshold).sort((p, q) => a.e(q) - a.e(p))[0];
  const after = row.filter((t) => a.s(t) >= a.e(box) - threshold).sort((p, q) => a.s(p) - a.s(q))[0];
  let best: SpacingHit | undefined;
  const consider = (d: number, guides: () => Guide[]) => {
    if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, guides: guides() };
  };
  const gapGuides = (moved: Box, g: number, p?: Box, q?: Box) => {
    const out = gaps.filter((x) => Math.abs(x.g - g) < 0.5).map((x) => seg(a.e(x.p), a.s(x.q), x.p, x.q));
    if (p) out.push(seg(a.e(p), a.s(moved), p, moved));
    if (q) out.push(seg(a.e(moved), a.s(q), moved, q));
    return out;
  };
  const shifted = (d: number): Box => (axis === 'x' ? { ...box, x: box.x + d } : { ...box, y: box.y + d });
  if (before && after && before !== after) {
    const free = a.s(after) - a.e(before) - a.len(box);
    if (free > 0) {
      const d = a.e(before) + free / 2 - a.s(box);
      consider(d, () => [seg(a.e(before), a.s(shifted(d)), before, box), seg(a.e(shifted(d)), a.s(after), box, after)]);
    }
  }
  for (const { g } of gaps) {
    if (before) { const d = a.e(before) + g - a.s(box); consider(d, () => gapGuides(shifted(d), g, before)); }
    if (after) { const d = a.s(after) - g - a.e(box); consider(d, () => gapGuides(shifted(d), g, undefined, after)); }
  }
  return best;
}

function guidesFor(box: Box, targets: Box[], axis: 'x' | 'y'): Guide[] {
  const lines = axis === 'x' ? xLines : yLines;
  const out: Guide[] = [];
  for (const pos of lines(box)) {
    const hits = targets.filter((t) => lines(t).some((l) => Math.abs(l - pos) < 0.5));
    if (!hits.length) continue;
    const all = [box, ...hits];
    out.push(axis === 'x'
      ? { axis, pos, from: Math.min(...all.map((b) => b.y)), to: Math.max(...all.map((b) => b.y + b.h)) }
      : { axis, pos, from: Math.min(...all.map((b) => b.x)), to: Math.max(...all.map((b) => b.x + b.w)) });
  }
  return out;
}

/** Snap offset for `box` against `targets`, plus the guide lines to draw (flow coordinates). */
export function snapBox(box: Box, targets: Box[], threshold: number, opts: SnapOptions = {}): SnapResult {
  const { grid, spacing = true } = opts;
  const lineX = bestOffset(xLines(box), targets, xLines, threshold);
  const lineY = bestOffset(yLines(box), targets, yLines, threshold);
  const gapX = lineX === undefined && spacing ? spacingOffset(box, targets, 'x', threshold) : undefined;
  const gapY = lineY === undefined && spacing ? spacingOffset(box, targets, 'y', threshold) : undefined;
  const toGrid = (v: number) => (grid ? Math.round(v / grid) * grid - v : 0);
  const dx = lineX ?? gapX?.d ?? toGrid(box.x);
  const dy = lineY ?? gapY?.d ?? toGrid(box.y);
  const snapped = { ...box, x: box.x + dx, y: box.y + dy };
  const guides = [
    ...(lineX !== undefined ? guidesFor(snapped, targets, 'x') : []),
    ...(lineY !== undefined ? guidesFor(snapped, targets, 'y') : []),
    ...(gapX?.guides ?? []),
    ...(gapY?.guides ?? []),
  ];
  return { dx: dx || 0, dy: dy || 0, guides };
}

export function unionBox(boxes: Box[]): Box | undefined {
  if (!boxes.length) return undefined;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const btm = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: btm - y };
}
