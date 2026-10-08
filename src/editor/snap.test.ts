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
