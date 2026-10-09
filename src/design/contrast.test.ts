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
  ['--fs-on-accent', '--fs-accent-fill', 'text'],
  ['--fs-accent', '--fs-accent-fill', 'ui'],
  ['--fs-line', '--fs-surface', 'ui'],
  ['--fs-line', '--fs-canvas', 'ui'],
  ['--fs-focus-ring', '--fs-surface', 'ui'],
  ['--fs-focus-ring', '--fs-canvas', 'ui'],
  ['--fs-focus-ring', '--fs-hover', 'ui'],
  ['--fs-selection', '--fs-surface', 'ui'],
  ['--fs-selection', '--fs-canvas', 'ui'],
  ['--fs-link-marker-ring', '--fs-surface', 'ui'],
  ['--fs-link-marker-ring', '--fs-faint', 'ui'],
  ['--fs-on-accent', '--fs-link-marker', 'ui'],
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

// Muted kit palette: resolved inside the kit scope (canvas items, device frames, exports).
const kitBlock = Object.entries(blocks).find(([sel]) => sel.includes('.fs-kit-scope'))?.[1] ?? {};
const KIT_PAIRS: [string, string, keyof typeof AA][] = [
  ['--fs-kit-text', '--fs-surface', 'text'],
  ['--fs-kit-text', '--fs-canvas', 'text'],
  ['--fs-kit-text', '--fs-kit-fill', 'text'],
  ['--fs-kit-text-muted', '--fs-surface', 'text'],
  ['--fs-kit-text-muted', '--fs-canvas', 'text'],
  ['--fs-kit-text-muted', '--fs-kit-fill', 'text'],
  ['--fs-surface', '--fs-kit-fill-strong', 'text'],
  ['--fs-kit-stroke', '--fs-surface', 'ui'],
  ['--fs-kit-stroke', '--fs-canvas', 'ui'],
  // Raw tokens and currentColor inside the kit scope resolve to the kit text colours.
  ['--fs-ink', '--fs-kit-fill', 'text'],
  ['--fs-muted', '--fs-surface', 'text'],
];

describe.each(Object.entries(STYLES))('muted kit palette meets WCAG AA (%s)', (_name, scopes) => {
  const kitScopes = [...scopes, kitBlock];
  it('is defined in a kit scope, not on :root (app chrome keeps its ink)', () => {
    expect(kitBlock['--fs-kit-text']).toBeDefined();
    expect(root['--fs-kit-text']).toBeUndefined();
  });
  it.each(KIT_PAIRS)('%s on %s (%s)', (fg, bg, kind) => {
    const ratio = contrastRatio(resolveToken(fg, kitScopes), resolveToken(bg, kitScopes));
    expect(ratio).toBeGreaterThanOrEqual(AA[kind]);
  });
  it('is quieter than the chrome ink', () => {
    const ink = contrastRatio(resolveToken('--fs-ink', scopes), resolveToken('--fs-surface', scopes));
    const kit = contrastRatio(resolveToken('--fs-kit-text', kitScopes), resolveToken('--fs-surface', kitScopes));
    const stroke = contrastRatio(resolveToken('--fs-kit-stroke', kitScopes), resolveToken('--fs-surface', kitScopes));
    expect(kit).toBeLessThan(ink);
    expect(stroke).toBeLessThan(kit);
  });
  it('stays grayscale', () => {
    for (const v of Object.values(kitBlock).filter((x) => /^#[0-9a-f]{6}$/i.test(x))) {
      const [r, g, b] = hexToRgb(v);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(12);
    }
  });
});

describe('palette discipline', () => {
  it('has exactly one chromatic colour (the accent: lime fill, olive shade, light tint)', () => {
    const hexes = Object.values(root).filter((v) => /^#[0-9a-f]{6}$/i.test(v));
    const chromatic = hexes.filter((h) => {
      const [r, g, b] = hexToRgb(h);
      return Math.max(r, g, b) - Math.min(r, g, b) > 12;
    });
    expect(new Set(chromatic.map((h) => h.toLowerCase()))).toEqual(new Set(['#b6f23a', '#3f6b00', '#f3fcdf']));
  });
});
