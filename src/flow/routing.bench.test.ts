// Performance guard for the connector router on the 60-screen stress board (docs/phase-4/performance.md).
// Thresholds are ~4× the numbers measured on a dev laptop so shared CI machines don't flake; the
// memo assertions are exact.
import { describe, expect, it } from 'vitest';
import { buildStressDoc } from '../editor/fixtures/stress';
import { addConnector, moveNode } from './ops';
import { clearRouteCache, routeBoard } from './routing';
import type { BoardDoc } from '../model/types';
// Shared CI runners are slower and noisier than a laptop; keep the local bar strict.
const LIMIT_MS = process.env.CI ? 400 : 120;

function time(fn: () => void): number {
  const t = performance.now();
  fn();
  return performance.now() - t;
}

function best(n: number, fn: () => number): number {
  let min = Infinity;
  for (let i = 0; i < n; i++) min = Math.min(min, fn());
  return min;
}

const doc = buildStressDoc();
const frames = Object.values(doc.frames);
const steps = Object.values(doc.connectors).filter((c) => c.style === 'step').length;

describe('routeBoard performance (stress board)', () => {
  it('has the expected size', () => {
    expect(frames.length).toBe(60);
    expect(steps).toBeGreaterThanOrEqual(80);
  });

  it('routes the whole board from scratch in well under the budget', () => {
    const ms = best(3, () => {
      clearRouteCache();
      return time(() => routeBoard({ ...doc }));
    });
    expect(routeBoard(doc).size).toBe(steps);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it('does not reroute when only text or props change', () => {
    const before = routeBoard(doc);
    const el = Object.values(doc.elements).find((e) => e.parentId && e.type === 'heading')!;
    const edited: BoardDoc = { ...doc, elements: { ...doc.elements, [el.id]: { ...el, props: { ...el.props, text: 'Renamed', tone: 'accent' } } } };
    const renamed: BoardDoc = { ...doc, frames: { ...doc.frames, [frames[3].id]: { ...frames[3], name: 'Renamed' } } };
    expect(routeBoard(edited)).toBe(before);
    expect(routeBoard(renamed)).toBe(before);
  });

  it('does not reroute when an unlinked element inside a screen moves', () => {
    const before = routeBoard(doc);
    const el = Object.values(doc.elements).find((e) => e.parentId && e.type === 'checkbox')!;
    expect(routeBoard(moveNode(doc, el.id, el.x + 10, el.y + 10))).toBe(before);
  });

  it('reroutes geometry edits incrementally', () => {
    routeBoard(doc);
    const f = frames[24];
    const moved = moveNode(doc, f.id, f.x + 37, f.y + 23);
    const moveMs = time(() => routeBoard(moved));
    routeBoard(doc);
    const linked = addConnector(doc, frames[5].id, frames[47].id, { style: 'step' }).doc;
    const addMs = time(() => routeBoard(linked));
    expect(routeBoard(linked).size).toBe(steps + 1);
    expect(moveMs).toBeLessThan(LIMIT_MS);
    expect(addMs).toBeLessThan(LIMIT_MS);
  });
});
