// Snap & alignment guides: pure math. The dragged selection's bounding box snaps its left/centre/right
// (and top/middle/bottom) lines to the same lines of nearby boxes when within `threshold` (flow px).

export interface Box { x: number; y: number; w: number; h: number }

export interface Guide {
  /** 'x' = vertical line at `pos`; 'y' = horizontal line at `pos`. Spans from..to on the other axis. */
  axis: 'x' | 'y';
  pos: number;
  from: number;
  to: number;
}

export interface SnapResult { dx: number; dy: number; guides: Guide[] }

const xLines = (b: Box) => [b.x, b.x + b.w / 2, b.x + b.w];
const yLines = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h];

function bestOffset(moving: number[], targets: Box[], lines: (b: Box) => number[], threshold: number): number {
  let best: number | undefined;
  for (const t of targets) {
    for (const tl of lines(t)) {
      for (const ml of moving) {
        const d = tl - ml;
        if (Math.abs(d) <= threshold && (best === undefined || Math.abs(d) < Math.abs(best))) best = d;
      }
    }
  }
  return best ?? 0;
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
export function snapBox(box: Box, targets: Box[], threshold: number): SnapResult {
  const dx = bestOffset(xLines(box), targets, xLines, threshold);
  const dy = bestOffset(yLines(box), targets, yLines, threshold);
  const snapped = { ...box, x: box.x + dx, y: box.y + dy };
  return { dx, dy, guides: [...guidesFor(snapped, targets, 'x'), ...guidesFor(snapped, targets, 'y')] };
}

export function unionBox(boxes: Box[]): Box | undefined {
  if (!boxes.length) return undefined;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const btm = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: btm - y };
}
