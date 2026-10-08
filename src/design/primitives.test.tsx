import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { arrowHead, calmRoughness, KitText, roundedRectPath, SketchLines, SketchRect } from './primitives';

describe('primitives helpers', () => {
  it('keeps sketchiness calm and size-aware', () => {
    expect(calmRoughness(10)).toBe(0.35);
    expect(calmRoughness(80)).toBeCloseTo(0.5);
    expect(calmRoughness(1000)).toBe(0.9);
  });
  it('builds rounded-rect paths with a clamped radius', () => {
    expect(roundedRectPath(0, 0, 10, 10, 0)).toBe('M0 0H10V10H0Z');
    expect(roundedRectPath(0, 0, 20, 10, 50)).toContain('A5 5');
  });
  it('points the arrow head back along the last segment', () => {
    const [a, tip, b] = arrowHead([[0, 0], [100, 0]], 10);
    expect(tip).toEqual([100, 0]);
    expect(a[0]).toBeLessThan(100);
    expect(b[0]).toBeLessThan(100);
    expect(arrowHead([[0, 0]])).toEqual([]);
  });
});

describe('primitives rendering (sketchy)', () => {
  it('renders multi-line SketchLines without duplicate-key warnings', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SketchLines w={100} h={40} style="sketchy" seed={3} lines={[[[0, 0], [100, 0]], [[0, 20], [100, 20]]]} />);
    expect(err.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
    err.mockRestore();
  });
  it('honours radius in sketchy SketchRect (path, not rectangle)', () => {
    const { container } = render(<SketchRect w={80} h={40} radius={20} style="sketchy" seed={5} fill="faint" />);
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });
  it('KitText clamps to N lines when asked', () => {
    const { getByText } = render(<KitText lines={3}>Long text</KitText>);
    const el = getByText('Long text');
    expect(el.style.whiteSpace).toBe('normal');
    expect(el.style.getPropertyValue('-webkit-line-clamp')).toBe('3');
  });
});
