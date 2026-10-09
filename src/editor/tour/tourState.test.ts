import { describe, expect, it } from 'vitest';
import { TOUR_E2E_KEY, TOUR_SEEN_KEY, TOUR_STEPS, hasSeenTour, markTourSeen, shouldAutoShowTour, tourText } from './tourState';

function mem(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('first-run tour state', () => {
  it('shows once for a new person, then never again', () => {
    const s = mem();
    expect(shouldAutoShowTour(s, false)).toBe(true);
    markTourSeen(s);
    expect(hasSeenTour(s)).toBe(true);
    expect(s.getItem(TOUR_SEEN_KEY)).toBe('seen');
    expect(shouldAutoShowTour(s, false)).toBe(false);
  });

  it('stays out of automated browsers unless a test opts in', () => {
    expect(shouldAutoShowTour(mem(), true)).toBe(false);
    expect(shouldAutoShowTour(mem({ [TOUR_E2E_KEY]: 'on' }), true)).toBe(true);
  });

  it('does not show when storage is unavailable or throws', () => {
    expect(shouldAutoShowTour(null, false)).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldAutoShowTour(broken, false)).toBe(false);
    expect(() => markTourSeen(broken)).not.toThrow();
  });

  it('has four short tips in the order of the first flow', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['screen', 'insert', 'link', 'play']);
    for (const s of TOUR_STEPS) {
      expect(tourText(s.body).length).toBeLessThanOrEqual(90);
      expect(s.title).toMatch(/^[A-Z][a-z]/);
    }
    expect(tourText(TOUR_STEPS[0].body)).toBe('Press F, then click the board to place a screen.');
  });
});
