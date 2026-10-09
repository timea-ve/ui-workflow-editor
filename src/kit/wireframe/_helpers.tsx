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

// ── Kit set B helpers (navigation, content, feedback) ─────────────────────────

import { KitIcon } from '../icons';

/** Token-coloured kit icon (lucide) placed in an absolute box. */
export function IconAt({ name, x = 0, y = 0, size, tone = 'ink', strokeWidth }: { name: string; x?: number; y?: number; size: number; tone?: Tone; strokeWidth?: number }) {
  if (size < 6) return null;
  return (
    <Box x={x} y={y} w={size} h={size} style={{ color: tone === 'none' ? 'transparent' : `var(--fs-${tone})`, display: 'grid', placeItems: 'center' }}>
      <KitIcon name={name} size={size} strokeWidth={strokeWidth ?? (size <= 16 ? 2 : 1.75)} />
    </Box>
  );
}

const ICON_BY_WORD: [RegExp, string][] = [
  [/home|dashboard|overview/i, 'home'], [/search|explore|discover/i, 'search'], [/setting|preference/i, 'settings'],
  [/profile|account|me\b/i, 'user'], [/team|people|member|contact|user/i, 'users'], [/message|chat|inbox/i, 'message'],
  [/mail|email/i, 'mail'], [/notification|alert|activity/i, 'bell'], [/calendar|schedule|event/i, 'calendar'],
  [/file|doc|report/i, 'file'], [/project|folder|librar/i, 'folder'], [/task|todo|list/i, 'list'],
  [/cart|basket|checkout/i, 'cart'], [/shop|store|order/i, 'shopping-bag'], [/save|bookmark|starred|favou?rite/i, 'bookmark'],
  [/like|heart/i, 'heart'], [/help|support|faq/i, 'help'], [/log ?out|sign ?out/i, 'log-out'], [/edit|rename/i, 'edit'],
  [/delete|remove|trash/i, 'trash'], [/share/i, 'share'], [/copy|duplicate/i, 'copy'], [/download|export/i, 'download'],
  [/upload|import/i, 'upload'], [/map|location|place/i, 'map-pin'], [/photo|image|gallery/i, 'image'], [/video/i, 'video'],
  [/music|audio/i, 'music'], [/billing|payment|card|plan/i, 'credit-card'], [/lock|security|privacy/i, 'lock'],
  [/analytic|stat|insight/i, 'sliders'], [/add|new|create/i, 'plus'], [/star/i, 'star'],
];
const ICON_FALLBACKS = ['circle', 'square', 'star', 'grid', 'folder', 'file'];

/** Picks a plausible icon for a nav/menu label (falls back to generic shapes). */
export function iconForLabel(label: string, i: number): string {
  for (const [re, name] of ICON_BY_WORD) if (re.test(label)) return name;
  return ICON_FALLBACKS[i % ICON_FALLBACKS.length];
}

/** Pseudo-random but deterministic value in [0, 1) for chart jitter. */
export function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const CHART_SHAPES = ['rising', 'falling', 'wave', 'flat'] as const;
export type ChartShape = (typeof CHART_SHAPES)[number];

/** Deterministic series in [0, 1] for lo-fi charts. */
export function chartSeries(shape: unknown, n: number, salt = 0): number[] {
  const count = Math.max(2, n);
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const jitter = (hash01(i + 1 + salt * 31) - 0.5) * 0.16;
    let v: number;
    switch (shape) {
      case 'falling': v = 0.85 - t * 0.6; break;
      case 'wave': v = 0.5 + 0.3 * Math.sin(t * Math.PI * 2.2 + salt); break;
      case 'flat': v = 0.5; break;
      default: v = 0.2 + t * 0.6;
    }
    return Math.min(1, Math.max(0, v + jitter));
  });
}

// ─── Kit set A helpers (text, actions, inputs) ───────────────────────────────
// Owner: Kit A agent. Kept in one block so Kit B can append independently.
// (Uses the KitIcon import declared in the Kit B block above.)

export const BUTTON_STATES = ['default', 'hover', 'pressed', 'disabled'] as const;
export type ButtonState = (typeof BUTTON_STATES)[number];
export const toButtonState = (v: unknown): ButtonState =>
  (BUTTON_STATES as readonly unknown[]).includes(v) ? (v as ButtonState) : 'default';
/** Screen-reader suffix for a non-default state, e.g. ", disabled". */
export const stateSuffix = (v: unknown): string => {
  const s = toButtonState(v);
  return s === 'default' ? '' : `, ${s}`;
};

type FaceShape = 'rect' | 'circle';

function FaceShapeOf({ shape, w, h, radius, style, seed, stroke, fill, strokeWidth }: {
  shape: FaceShape; w: number; h: number; radius: number; style: VisualStyle; seed: number; stroke: Tone; fill: Tone; strokeWidth?: number;
}) {
  if (shape === 'circle') return <SketchEllipse w={w} h={h} style={style} seed={seed} stroke={stroke} fill={fill} strokeWidth={strokeWidth} />;
  return <RoundedRect w={w} h={h} radius={radius} style={style} seed={seed} stroke={stroke} fill={fill} strokeWidth={strokeWidth} />;
}

/**
 * Button background in one of four interaction states, drawn with tokens only:
 * hover = a light ink wash, pressed = a stronger wash plus an inner top shadow,
 * disabled = faint stroke and a washed-out fill.
 */
export function ButtonFace({
  w, h, radius = 6, shape = 'rect', filled, state, style, seed,
}: { w: number; h: number; radius?: number; shape?: FaceShape; filled: boolean; state: ButtonState; style: VisualStyle; seed: number }) {
  if (w <= 2 || h <= 2) return null;
  if (state === 'disabled') {
    return (
      <div style={{ position: 'absolute', inset: 0, opacity: filled ? 0.55 : 1 }}>
        <FaceShapeOf shape={shape} w={w} h={h} radius={radius} style={style} seed={seed} stroke="faint" fill={filled ? 'faint' : 'none'} />
      </div>
    );
  }
  const wash = state === 'hover' ? 0.08 : state === 'pressed' ? 0.18 : 0;
  const r = shape === 'circle' ? Math.min(w, h) / 2 : radius;
  return (
    <>
      <FaceShapeOf shape={shape} w={w} h={h} radius={radius} style={style} seed={seed} stroke="ink" fill={filled ? 'faint' : 'surface'} />
      {wash > 0 && (
        <div style={{ position: 'absolute', inset: 0, opacity: wash }}>
          <FaceShapeOf shape={shape} w={w} h={h} radius={radius} style={style} seed={seed} stroke="none" fill="ink" />
        </div>
      )}
      {state === 'pressed' && w > 2 * r + 4 && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.45 }}>
          <SketchLines w={w} h={h} lines={[[[Math.max(r, 4), 3.5], [w - Math.max(r, 4), 3.5]]]} style={style} seed={seed + 9} stroke="muted" strokeWidth={2} />
        </div>
      )}
    </>
  );
}

/** A curated kit icon (src/kit/icons.tsx) drawn in a token colour, stroke scaled to read at any size. */
export function KitIconAt({ name, x = 0, y = 0, size, tone = 'ink' }: { name: string; x?: number; y?: number; size: number; tone?: Tone }) {
  if (size < 4) return null;
  const px = Math.min(3, Math.max(1.5, size / 14));
  return (
    <Box x={x} y={y} w={size} h={size} style={{ color: toneVar(tone), display: 'grid', placeItems: 'center' }}>
      <KitIcon name={name} size={size} strokeWidth={(px * 24) / size} />
    </Box>
  );
}

const BAR_PATTERN = [1, 0.93, 0.97, 0.86, 0.95, 0.9, 0.98, 0.84];

/**
 * Grey "greeked" copy: one rounded faint bar per line that fits in `h`,
 * varying in length, with a shorter last line — like real paragraph text.
 */
export function PlaceholderBars({
  w, h, size = 'md', align = 'left', style, seed, tone = 'faint', maxLines,
}: { w: number; h: number; size?: TextSize; align?: CSSProperties['textAlign']; style: VisualStyle; seed: number; tone?: Tone; maxLines?: number }) {
  const lineH = TEXT_PX[size] * LINE_HEIGHT;
  const n = Math.min(maxLines ?? Infinity, linesThatFit(h, size));
  const barH = Math.max(4, Math.round(TEXT_PX[size] * 0.6));
  const off = Math.abs(Math.floor(seed)) % BAR_PATTERN.length;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const frac = n > 1 && i === n - 1 ? 0.58 : BAR_PATTERN[(i + off) % BAR_PATTERN.length];
        const bw = Math.max(4, Math.round(w * frac));
        const x = align === 'center' ? (w - bw) / 2 : align === 'right' ? w - bw : 0;
        return (
          <At key={i} x={x} y={i * lineH + (lineH - barH) / 2} w={bw} h={barH}>
            <RoundedRect w={bw} h={barH} radius={barH / 2} style={style} seed={seed + i} stroke="none" fill={tone} strokeWidth={1} />
          </At>
        );
      })}
    </>
  );
}
