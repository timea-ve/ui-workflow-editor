// WCAG 2.x contrast helpers + a tiny resolver for the colour tokens in tokens.css.
// Pure functions — used by contrast.test.ts to prove every token pair meets AA.

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** AA thresholds: normal text 4.5, large text and non-text UI (strokes, focus) 3. */
export const AA = { text: 4.5, ui: 3 } as const;

/**
 * Parse `--fs-*: value;` declarations from a CSS string, grouped by selector.
 * Only flat rule blocks are considered (enough for tokens.css).
 */
export function parseTokenBlocks(css: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of noComments.matchAll(block)) {
    const selector = m[1].trim();
    const decls = [...m[2].matchAll(/(--fs-[\w-]+)\s*:\s*([^;]+);/g)];
    if (!decls.length) continue;
    out[selector] = { ...(out[selector] ?? {}) };
    for (const d of decls) out[selector][d[1]] = d[2].trim();
  }
  return out;
}

/** Resolve a token to a literal value, following var(--x) references. */
export function resolveToken(name: string, scopes: Record<string, string>[], depth = 0): string {
  if (depth > 10) throw new Error(`Token cycle at ${name}`);
  for (let i = scopes.length - 1; i >= 0; i--) {
    const v = scopes[i][name];
    if (v === undefined) continue;
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    return ref ? resolveToken(ref[1], scopes, depth + 1) : v;
  }
  throw new Error(`Unknown token ${name}`);
}
