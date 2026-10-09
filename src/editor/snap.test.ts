import { describe, expect, it } from 'vitest';
import { snapBox, unionBox } from './snap';

describe('snapBox', () => {
  const target = { x: 100, y: 100, w: 200, h: 100 };

  it('snaps left edges within the threshold and shows a vertical guide', () => {
    const r = snapBox({ x: 104, y: 400, w: 50, h: 50 }, [target], 6);
    expect(r.dx).toBe(-4);
    expect(r.dy).toBe(0);
    expect(r.guides).toContainEqual({ axis: 'x', pos: 100, from: 100, to: 450 });
  });

  it('snaps centres', () => {
    const r = snapBox({ x: 500, y: 127, w: 50, h: 50 }, [target], 6);
    expect(r.dy).toBe(-2); // centre 152 → 150
    expect(r.guides.some((g) => g.axis === 'y' && g.pos === 150)).toBe(true);
  });

  it('snaps right edge to left edge (abutting)', () => {
    const r = snapBox({ x: 47, y: 300, w: 50, h: 50 }, [target], 6);
    expect(r.dx).toBe(3);
  });

  it('picks the closest line and ignores far ones', () => {
    expect(snapBox({ x: 120, y: 500, w: 10, h: 10 }, [target], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
    const r = snapBox({ x: 98, y: 500, w: 10, h: 10 }, [target, { x: 97, y: 0, w: 10, h: 10 }], 6);
    expect(r.dx).toBe(-1);
  });

  it('unionBox bounds a selection', () => {
    expect(unionBox([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 20 }])).toEqual({ x: 0, y: 0, w: 30, h: 25 });
    expect(unionBox([])).toBeUndefined();
  });
});

describe('snapBox: grid', () => {
  const opts = { grid: 8 };

  it('rounds the box origin to the grid when no neighbour is in reach', () => {
    const r = snapBox({ x: 103, y: 205, w: 50, h: 50 }, [], 6, opts);
    expect(r.dx).toBe(-7 + 8); // 103 → 104
    expect(r.dy).toBe(-5 + 8); // 205 → 208
    expect(r.guides).toEqual([]);
  });

  it('lands exactly on multiples of the grid', () => {
    for (const x of [0, 3.4, 12, 17.9, -9, 1001]) {
      const r = snapBox({ x, y: x, w: 10, h: 10 }, [], 6, opts);
      expect((x + r.dx) % 8).toBeCloseTo(0);
      expect((x + r.dy) % 8).toBeCloseTo(0);
    }
  });

  it('a neighbour line wins over the grid on that axis only', () => {
    const r = snapBox({ x: 103, y: 403, w: 50, h: 50 }, [{ x: 101, y: 0, w: 40, h: 40 }], 6, opts);
    expect(r.dx).toBe(-2); // aligned to the neighbour's left edge (101), not the grid
    expect(r.dy).toBe(-3); // grid: 403 → 400
  });

  it('does nothing without a grid when nothing is near', () => {
    expect(snapBox({ x: 103, y: 205, w: 50, h: 50 }, [], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe('snapBox: equal spacing', () => {
  // A row of two boxes 40px apart (100..140, gap, 180..220), all on y 0..40.
  const a = { x: 100, y: 0, w: 40, h: 40 };
  const b = { x: 180, y: 0, w: 40, h: 40 };

  it('repeats an existing gap to the right of a row and marks both gaps', () => {
    const r = snapBox({ x: 263, y: 100, w: 40, h: 40 }, [a, b], 6, { spacing: true });
    // Not in the row (no vertical overlap): no spacing on x.
    expect(r.dx).toBe(0);
    const s = snapBox({ x: 263, y: 0, w: 30, h: 40 }, [a, b], 6);
    expect(s.dx).toBe(-3); // 220 + 40 = 260
    const gaps = s.guides.filter((g) => g.kind === 'gap');
    expect(gaps).toHaveLength(2);
    expect(gaps).toContainEqual(expect.objectContaining({ axis: 'y', from: 140, to: 180 }));
    expect(gaps).toContainEqual(expect.objectContaining({ axis: 'y', from: 220, to: 260 }));
  });

  it('centres a box between two neighbours', () => {
    const left = { x: 0, y: 0, w: 40, h: 40 };
    const right = { x: 200, y: 0, w: 40, h: 40 };
    const r = snapBox({ x: 104, y: 10, w: 30, h: 30 }, [left, right], 6);
    // free space 160 - 30 = 130 → x = 40 + 65 = 105
    expect(r.dx).toBe(1);
    expect(r.guides.filter((g) => g.kind === 'gap').map((g) => [g.from, g.to])).toEqual([[40, 105], [135, 200]]);
  });

  it('alignment lines win over spacing', () => {
    const r = snapBox({ x: 262, y: 0, w: 40, h: 40 }, [a, b, { x: 264, y: 300, w: 10, h: 10 }], 6);
    expect(r.dx).toBe(2); // left edge to 264, not the 260 spacing
    expect(r.guides.every((g) => g.kind !== 'gap')).toBe(true);
  });

  it('can be switched off', () => {
    const r = snapBox({ x: 263, y: 0, w: 30, h: 40 }, [a, b], 6, { spacing: false, grid: 8 });
    expect(r.dx).toBe(-7 + 8); // grid: 263 → 264
  });
});
