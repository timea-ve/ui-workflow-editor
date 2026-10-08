import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AA, contrastRatio, hexToRgb, parseTokenBlocks, resolveToken } from './contrast';

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
const blocks = parseTokenBlocks(css);
const root = blocks[':root'];
const STYLES = {
  sketchy: [root, blocks["[data-kit-style='sketchy']"]],
  clean: [root, blocks["[data-kit-style='clean']"]],
};

// [foreground, background, kind]
const PAIRS: [string, string, keyof typeof AA][] = [
  ['--fs-ink', '--fs-surface', 'text'],
  ['--fs-ink', '--fs-canvas', 'text'],
  ['--fs-ink', '--fs-hover', 'text'],
  ['--fs-ink', '--fs-faint', 'text'],
  ['--fs-ink', '--fs-accent-weak', 'text'],
  ['--fs-muted', '--fs-surface', 'text'],
  ['--fs-muted', '--fs-canvas', 'text'],
  ['--fs-muted', '--fs-hover', 'text'],
  ['--fs-subtle', '--fs-surface', 'text'],
  ['--fs-subtle', '--fs-canvas', 'text'],
  ['--fs-accent', '--fs-surface', 'text'],
  ['--fs-accent', '--fs-canvas', 'text'],
  ['--fs-accent', '--fs-accent-weak', 'text'],
  ['--fs-on-accent', '--fs-accent', 'text'],
  ['--fs-line', '--fs-surface', 'ui'],
  ['--fs-line', '--fs-canvas', 'ui'],
  ['--fs-focus-ring', '--fs-surface', 'ui'],
  ['--fs-focus-ring', '--fs-canvas', 'ui'],
  ['--fs-focus-ring', '--fs-hover', 'ui'],
  ['--fs-selection', '--fs-surface', 'ui'],
  ['--fs-selection', '--fs-canvas', 'ui'],
  ['--fs-link-marker', '--fs-surface', 'ui'],
  ['--fs-link-marker', '--fs-faint', 'ui'],
];

describe('contrast helpers', () => {
  it('computes known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
  it('parses short hex and rejects junk', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(() => hexToRgb('blue')).toThrow();
  });
  it('resolves var() chains with the innermost scope winning', () => {
    expect(resolveToken('--fs-canvas', STYLES.sketchy)).toBe('#f7f6f2');
    expect(resolveToken('--fs-canvas', STYLES.clean)).toBe('#f5f5f4');
    expect(resolveToken('--fs-ink', STYLES.clean)).toBe('#1f1f1f');
  });
});

describe.each(Object.entries(STYLES))('token pairs meet WCAG AA (%s)', (_name, scopes) => {
  it.each(PAIRS)('%s on %s (%s)', (fg, bg, kind) => {
    const ratio = contrastRatio(resolveToken(fg, scopes), resolveToken(bg, scopes));
    expect(ratio).toBeGreaterThanOrEqual(AA[kind]);
  });
});

describe('palette discipline', () => {
  it('has exactly one chromatic colour (the accent)', () => {
    const hexes = Object.values(root).filter((v) => /^#[0-9a-f]{6}$/i.test(v));
    const chromatic = hexes.filter((h) => {
      const [r, g, b] = hexToRgb(h);
      return Math.max(r, g, b) - Math.min(r, g, b) > 12;
    });
    expect(new Set(chromatic.map((h) => h.toLowerCase()))).toEqual(new Set(['#5b3fd1', '#eeeafb']));
  });
});
