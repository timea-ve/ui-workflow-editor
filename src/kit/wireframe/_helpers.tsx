// Shared helpers for the Wireframe Kit. Draws only with the design primitives,
// so both visual styles (sketchy / clean) come for free.

import { useMemo, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import rough from 'roughjs';
import { Box, KitText, SketchEllipse, SketchLines, SketchPolygon, SketchRect, type Tone } from '../../design/primitives';
import type { VisualStyle } from '../types';

export type TextSize = 'sm' | 'md' | 'lg' | 'xl';

/** Approximate px per kit text size — only used to estimate how many lines fit. */
export const TEXT_PX: Record<TextSize, number> = { sm: 12, md: 14, lg: 18, xl: 24 };
export const LINE_HEIGHT = 1.25;

/** Split a comma-separated prop into trimmed, non-empty labels. */
export function splitList(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Coerce an unknown prop to an integer within [min, max]. */
export function toInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const toBool = (v: unknown): boolean => v === true || v === 'true';

/** How many lines of a given size fit into a height. Always ≥ 1. */
export function linesThatFit(h: number, size: TextSize): number {
  return Math.max(1, Math.floor(h / (TEXT_PX[size] * LINE_HEIGHT)));
}

/** Multiline text clamped to the lines that fit, with an ellipsis on the last line. */
export function MultilineText({
  children, h, size = 'md', tone = 'ink', weight, align = 'left',
}: { children: ReactNode; h: number; size?: TextSize; tone?: Tone; weight?: number; align?: CSSProperties['textAlign'] }) {
  const lines = linesThatFit(h, size);
  return (
    <KitText
      size={size}
      tone={tone}
      weight={weight}
      align={align}
      style={{
        whiteSpace: 'pre-line',
        overflowWrap: 'anywhere',
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        maxHeight: '100%',
      }}
    >
      {children}
    </KitText>
  );
}

/** A single-line text box vertically centred inside an absolutely positioned area. */
export function TextRow({
  x = 0, y = 0, w, h, children, size = 'md', tone = 'ink', weight, align = 'left',
}: { x?: number; y?: number; w: number; h: number; children: ReactNode; size?: TextSize; tone?: Tone; weight?: number; align?: CSSProperties['textAlign'] }) {
  if (w <= 0 || h <= 0) return null;
  return (
    <Box x={x} y={y} w={w} h={h} style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <KitText size={size} tone={tone} weight={weight} align={align} style={{ flex: 1, minWidth: 0 }}>{children}</KitText>
    </Box>
  );
}

/** Wrap a primitive so it draws inside a sub-rectangle of the item. */
export function At({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children: ReactNode }) {
  if (w <= 0 || h <= 0) return null;
  return <Box x={x} y={y} w={w} h={h}>{children}</Box>;
}

/**
 * Several open polylines. Renders one SketchLines per polyline because the shared
 * primitive reuses React keys across polylines in sketchy mode (see docs/phase-2/wireframe-kit.md).
 */
export function Lines({ lines, seed, ...rest }: ComponentProps<typeof SketchLines>) {
  return <>{lines.map((l, i) => <SketchLines key={i} {...rest} lines={[l]} seed={seed + i} />)}</>;
}

const roughGen = rough.generator();
const toneVar = (t: Tone) => (t === 'none' ? 'none' : `var(--fs-${t})`);

/**
 * Rounded rectangle that keeps its corner radius in sketchy mode too
 * (the shared SketchRect drops the radius when sketchy). Local stop-gap — see
 * "Requests to Design System" in docs/phase-2/wireframe-kit.md.
 */
export function RoundedRect({
  w, h, radius, style, seed, stroke = 'ink', fill = 'none', strokeWidth = 1.5,
}: { w: number; h: number; radius: number; style: VisualStyle; seed: number; stroke?: Tone; fill?: Tone; strokeWidth?: number }) {
  const i = strokeWidth / 2;
  const r = Math.max(0, Math.min(radius, (w - strokeWidth) / 2, (h - strokeWidth) / 2));
  const paths = useMemo(() => {
    if (style !== 'sketchy' || r <= 0 || w <= strokeWidth || h <= strokeWidth) return null;
    const x0 = i, y0 = i, x1 = w - i, y1 = h - i;
    const d = `M${x0 + r},${y0} L${x1 - r},${y0} A${r},${r} 0 0 1 ${x1},${y0 + r} L${x1},${y1 - r} A${r},${r} 0 0 1 ${x1 - r},${y1} L${x0 + r},${y1} A${r},${r} 0 0 1 ${x0},${y1 - r} L${x0},${y0 + r} A${r},${r} 0 0 1 ${x0 + r},${y0} Z`;
    const drawable = roughGen.path(d, {
      seed: Math.max(1, Math.floor(seed) % 2 ** 31), roughness: Math.min(1, Math.max(0.35, Math.min(w, h) / 80)), bowing: 0.6, strokeWidth,
      fill: fill === 'none' ? undefined : 'x', fillStyle: 'solid',
    });
    return roughGen.toPaths(drawable).map((p, k) => {
      const isFill = p.fill && p.fill !== 'none' && p.stroke === 'none';
      return <path key={k} d={p.d} fill={isFill ? toneVar(fill) : 'none'} stroke={isFill ? 'none' : toneVar(stroke)} strokeWidth={isFill ? 0 : strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
    });
  }, [style, w, h, r, i, seed, stroke, fill, strokeWidth]);
  if (!paths) return <SketchRect w={w} h={h} radius={r} style={style} seed={seed} stroke={stroke} fill={fill} strokeWidth={strokeWidth} />;
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>{paths}</svg>
  );
}

/** Lo-fi "skeleton" copy line(s) — used where real text would be noise (table cells, secondary lines). */
export function SkeletonLine({ x, y, w, style, seed, tone = 'faint' }: { x: number; y: number; w: number; style: VisualStyle; seed: number; tone?: Tone }) {
  if (w <= 2) return null;
  return (
    <At x={x} y={y - 2} w={w} h={4}>
      <SketchLines w={w} h={4} lines={[[[1, 2], [w - 1, 2]]]} style={style} seed={seed} stroke={tone} strokeWidth={3} />
    </At>
  );
}

/** Image placeholder: box with an X cross. */
export function ImagePlaceholder({ x = 0, y = 0, w, h, style, seed, radius = 4 }: { x?: number; y?: number; w: number; h: number; style: VisualStyle; seed: number; radius?: number }) {
  if (w <= 2 || h <= 2) return null;
  return (
    <At x={x} y={y} w={w} h={h}>
      <SketchRect w={w} h={h} radius={radius} style={style} seed={seed} stroke="muted" />
      <Lines w={w} h={h} lines={[[[2, 2], [w - 2, h - 2]], [[w - 2, 2], [2, h - 2]]]} style={style} seed={seed + 1} stroke="faint" strokeWidth={1.25} />
    </At>
  );
}

export const ICON_GLYPHS = [
  'circle', 'square', 'star', 'menu', 'search', 'user', 'close', 'plus', 'chevron-left', 'chevron-right', 'check', 'home', 'more',
] as const;
export type IconGlyphName = (typeof ICON_GLYPHS)[number];

export function isGlyph(v: unknown): v is IconGlyphName {
  return typeof v === 'string' && (ICON_GLYPHS as readonly string[]).includes(v);
}

/** Generic placeholder glyphs drawn from simple lines (no proprietary icon sets). */
export function IconGlyph({
  glyph, x = 0, y = 0, size, style, seed, tone = 'ink',
}: { glyph: IconGlyphName; x?: number; y?: number; size: number; style: VisualStyle; seed: number; tone?: Tone }) {
  const s = Math.max(4, size);
  const sw = Math.max(1.25, Math.min(2.5, s / 14));
  const p = (fx: number, fy: number): [number, number] => [fx * s, fy * s];
  const lines = (ls: [number, number][][]) => <Lines w={s} h={s} lines={ls} style={style} seed={seed} stroke={tone} strokeWidth={sw} />;
  let body: ReactNode;
  switch (glyph) {
    case 'circle':
      body = <At x={s * 0.1} y={s * 0.1} w={s * 0.8} h={s * 0.8}><SketchEllipse w={s * 0.8} h={s * 0.8} style={style} seed={seed} stroke={tone} strokeWidth={sw} /></At>;
      break;
    case 'square':
      body = <At x={s * 0.12} y={s * 0.12} w={s * 0.76} h={s * 0.76}><SketchRect w={s * 0.76} h={s * 0.76} radius={s * 0.08} style={style} seed={seed} stroke={tone} strokeWidth={sw} /></At>;
      break;
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.42 : 0.18;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(p(0.5 + r * Math.cos(a), 0.54 + r * Math.sin(a)));
      }
      body = <SketchPolygon w={s} h={s} points={pts} style={style} seed={seed} stroke={tone} strokeWidth={sw} />;
      break;
    }
    case 'menu':
      body = lines([[p(0.15, 0.28), p(0.85, 0.28)], [p(0.15, 0.5), p(0.85, 0.5)], [p(0.15, 0.72), p(0.85, 0.72)]]);
      break;
    case 'search':
      body = (
        <>
          <At x={s * 0.12} y={s * 0.12} w={s * 0.56} h={s * 0.56}><SketchEllipse w={s * 0.56} h={s * 0.56} style={style} seed={seed} stroke={tone} strokeWidth={sw} /></At>
          {lines([[p(0.6, 0.6), p(0.88, 0.88)]])}
        </>
      );
      break;
    case 'user': {
      const arc: [number, number][] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i * Math.PI) / 8;
        arc.push(p(0.5 + 0.36 * Math.cos(a), 0.92 + 0.36 * Math.sin(a)));
      }
      body = (
        <>
          <At x={s * 0.32} y={s * 0.1} w={s * 0.36} h={s * 0.36}><SketchEllipse w={s * 0.36} h={s * 0.36} style={style} seed={seed} stroke={tone} strokeWidth={sw} /></At>
          {lines([arc])}
        </>
      );
      break;
    }
    case 'close':
      body = lines([[p(0.22, 0.22), p(0.78, 0.78)], [p(0.78, 0.22), p(0.22, 0.78)]]);
      break;
    case 'plus':
      body = lines([[p(0.5, 0.15), p(0.5, 0.85)], [p(0.15, 0.5), p(0.85, 0.5)]]);
      break;
    case 'chevron-left':
      body = lines([[p(0.62, 0.2), p(0.32, 0.5), p(0.62, 0.8)]]);
      break;
    case 'chevron-right':
      body = lines([[p(0.38, 0.2), p(0.68, 0.5), p(0.38, 0.8)]]);
      break;
    case 'check':
      body = lines([[p(0.18, 0.52), p(0.42, 0.75), p(0.84, 0.25)]]);
      break;
    case 'home':
      body = <SketchPolygon w={s} h={s} points={[p(0.5, 0.14), p(0.86, 0.46), p(0.76, 0.46), p(0.76, 0.86), p(0.24, 0.86), p(0.24, 0.46), p(0.14, 0.46)]} style={style} seed={seed} stroke={tone} strokeWidth={sw} />;
      break;
    case 'more': {
      const d = Math.max(2, s * 0.14);
      body = [0.2, 0.5, 0.8].map((fx, i) => (
        <At key={i} x={fx * s - d / 2} y={s / 2 - d / 2} w={d} h={d}>
          <SketchEllipse w={d} h={d} style={style} seed={seed + i} stroke={tone} fill={tone} strokeWidth={1} />
        </At>
      ));
      break;
    }
  }
  return <Box x={x} y={y} w={s} h={s}>{body}</Box>;
}
