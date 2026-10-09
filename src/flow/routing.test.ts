import { describe, expect, it } from 'vitest';
import { addConnector, createScreen, emptyDoc } from './ops';
import { lineJumps, midpoint, routeBoard, smooth, type Pt } from './routing';
import { TEMPLATES } from '../platform/templates';
import { buildOnboarding } from '../platform/templates/onboarding';
import { buildCheckout } from '../platform/templates/checkout';
import type { BoardDoc } from '../model/types';

type R = { x: number; y: number; w: number; h: number };

/** True when the segment's box overlaps the rect's interior (1px inset). */
function crosses(a: Pt, b: Pt, r: R): boolean {
  const [x1, x2] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y1, y2] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  return x2 > r.x + 1 && x1 < r.x + r.w - 1 && y2 > r.y + 1 && y1 < r.y + r.h - 1;
}

const frameOf = (doc: BoardDoc, nodeId: string) => doc.frames[nodeId] ?? doc.frames[doc.elements[nodeId]?.parentId ?? ''];

describe('routeBoard', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s: no line runs through a screen', (_id, t) => {
    const doc = t.build();
    const routes = routeBoard(doc);
    expect(routes.size).toBe(Object.values(doc.connectors).filter((c) => c.style === 'step').length);
    for (const c of Object.values(doc.connectors)) {
      const pts = routes.get(c.id)!.points;
      const own = [frameOf(doc, c.from.nodeId), frameOf(doc, c.to.nodeId)];
      for (let i = 0; i + 1 < pts.length; i++) {
        for (const f of Object.values(doc.frames)) {
          // An element may cross its own screen on the way to the screen edge.
          if (!own.includes(f)) expect(crosses(pts[i], pts[i + 1], f), `${c.id} segment ${i} crosses ${f.name}`).toBe(false);
        }
      }
    }
  });

  it('Onboarding: "Skip" goes over the screens in between and arrives on its own side of "Ready"', () => {
    const doc = buildOnboarding();
    const skip = Object.values(doc.elements).find((e) => e.props.text === 'Skip')!;
    const ready = Object.values(doc.frames).find((f) => f.name === 'Ready')!;
    const routes = routeBoard(doc);
    const skipC = Object.values(doc.connectors).find((c) => c.from.nodeId === skip.id)!;
    const r = routes.get(skipC.id)!;
    expect(r.targetSide).toBe('top');
    expect(Math.min(...r.points.map((p) => p[1]))).toBeLessThan(ready.y);
    // No other line ends at the same point on Ready.
    const end = r.points[r.points.length - 1];
    for (const c of Object.values(doc.connectors)) {
      if (c.id === skipC.id || c.to.nodeId !== ready.id) continue;
      const o = routes.get(c.id)!.points;
      expect(o[o.length - 1]).not.toEqual(end);
    }
  });

  it('spreads lines that share a side, ordered by where they come from', () => {
    let doc = emptyDoc();
    const s = (x: number, y: number) => {
      const r = createScreen(doc, { device: 'mobile', name: `S${x},${y}`, x, y });
      doc = r.doc;
      return r.id;
    };
    const target = s(800, 0);
    const upper = s(0, -600);
    const lower = s(0, 600);
    doc = addConnector(doc, lower, target, { toAnchor: 'left' }).doc;
    doc = addConnector(doc, upper, target, { toAnchor: 'left' }).doc;
    const routes = [...routeBoard(doc).values()];
    const ends = routes.filter((r) => r.targetSide === 'left').map((r) => r.points[r.points.length - 1]);
    expect(ends).toHaveLength(2);
    expect(ends[0][1]).not.toBe(ends[1][1]);
    const fromUpper = routes.find((r) => r.from.y === -600)!;
    const fromLower = routes.find((r) => r.from.y === 600)!;
    expect(fromUpper.points[fromUpper.points.length - 1][1]).toBeLessThan(fromLower.points[fromLower.points.length - 1][1]);
  });

  it('draws a lone line straight across when the other end is level with it (Checkout)', () => {
    const doc = buildCheckout();
    for (const r of routeBoard(doc).values()) {
      const ys = new Set(r.points.map((p) => Math.round(p[1])));
      expect(ys.size).toBe(1);
    }
  });

  it('is memoised on geometry', () => {
    const doc = buildCheckout();
    expect(routeBoard(doc)).toBe(routeBoard({ ...doc }));
  });
});

describe('line helpers', () => {
  it('lineJumps: the horizontal line hops over the vertical one', () => {
    const h: Pt[] = [[0, 50], [200, 50]];
    const v: Pt[] = [[100, 0], [100, 200]];
    const j = lineJumps([['h', h], ['v', v]]);
    expect(j.get('h')?.get(0)).toEqual([100]);
    expect(j.has('v')).toBe(false);
  });

  it('smooth: rounds corners and adds hop arcs above the line', () => {
    const pts = smooth([[0, 0], [100, 0], [100, 100]], new Map([[0, [50]]]));
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([100, 100]);
    expect(Math.min(...pts.map((p) => p[1]))).toBeLessThan(-3); // hop
    expect(pts.some(([x, y]) => x > 90 && x < 100 && y > 0 && y < 10)).toBe(true); // rounded corner
  });

  it('midpoint is halfway along the path', () => {
    expect(midpoint([[0, 0], [100, 0], [100, 100]])).toEqual([100, 0]);
  });
});
