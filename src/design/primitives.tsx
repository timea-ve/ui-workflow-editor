// Shared drawing primitives. Every kit item draws with these so the
// sketchy/clean switch is handled in exactly one place.
// Owner: Design System agent (may tune roughness, stroke widths, etc.).

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import type { VisualStyle } from '../kit/types';

const generator = rough.generator();

export type Tone = 'ink' | 'muted' | 'faint' | 'accent' | 'surface' | 'none';

type ToneRole = 'stroke' | 'fill' | 'text';

/**
 * Kit drawings use the muted kit palette (tokens.css `.fs-kit-scope`) where it is defined, and the
 * plain semantic tokens elsewhere (e.g. connectors, lanes). Accent and surface never change.
 */
const KIT_TONE: Record<ToneRole, Partial<Record<Tone, string>>> = {
  stroke: { ink: '--fs-kit-stroke', muted: '--fs-kit-stroke-soft', faint: '--fs-kit-stroke-soft' },
  fill: { ink: '--fs-kit-fill-strong', muted: '--fs-kit-stroke', faint: '--fs-kit-fill' },
  text: { ink: '--fs-kit-text', muted: '--fs-kit-text-muted' },
};

export function toneVar(t: Tone, role: ToneRole = 'stroke'): string {
  if (t === 'none') return 'none';
  const kit = KIT_TONE[role][t];
  return kit ? `var(${kit}, var(--fs-${t}))` : `var(--fs-${t})`;
}
const fillVar = (t: Tone) => toneVar(t, 'fill');

interface ShapeBase {
  style: VisualStyle;
  seed: number;
  stroke?: Tone;
  fill?: Tone;
  strokeWidth?: number;
  dashed?: boolean;
}

function roughPaths(drawable: ReturnType<typeof generator.rectangle>, stroke: Tone, fill: Tone, sw: number, dashed?: boolean, keyPrefix = '') {
  return generator.toPaths(drawable).map((p, i) => {
    const isFill = p.fill && p.fill !== 'none' && p.stroke === 'none';
    return (
      <path
        key={`${keyPrefix}${i}`}
        d={p.d}
        fill={isFill ? fillVar(fill) : 'none'}
        stroke={isFill ? 'none' : toneVar(stroke)}
        strokeWidth={isFill ? 0 : sw}
        strokeDasharray={dashed && !isFill ? '6 5' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  });
}

/**
 * Calm sketchiness: roughness scales with the shape's size so tiny items
 * (checkboxes, icons) don't look scribbled, and large frames stay steady.
 */
export function calmRoughness(size: number): number {
  return Math.min(0.9, Math.max(0.35, size / 160));
}

function roughOpts(seed: number, fill: Tone, sw: number, size = 120): Options {
  return {
    seed: Math.max(1, Math.floor(seed) % 2 ** 31),
    roughness: calmRoughness(size),
    bowing: 0.6,
    maxRandomnessOffset: 1.4,
    strokeWidth: sw,
    fill: fill === 'none' ? undefined : 'x',
    fillStyle: 'solid',
    preserveVertices: true,
  };
}

function extent(points: [number, number][]): number {
  if (!points.length) return 0;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

const svgStyle: CSSProperties = { position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' };

/** SVG path for a rounded rectangle; radius is clamped to half the shorter side. */
export function roundedRectPath(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r === 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  return [
    `M${x + r} ${y}`, `H${x + w - r}`, `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`, `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`, `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`, `A${r} ${r} 0 0 1 ${x + r} ${y}`, 'Z',
  ].join(' ');
}

/** Rectangle that fills its parent box (w×h). `radius` rounds corners in both styles. */
export function SketchRect({ w, h, radius = 0, style, seed, stroke = 'ink', fill = 'none', strokeWidth = 1.5, dashed }: ShapeBase & { w: number; h: number; radius?: number }) {
  const inset = strokeWidth / 2;
  const paths = useMemo(
    () => {
      if (style !== 'sketchy') return null;
      const opts = roughOpts(seed, fill, strokeWidth, Math.sqrt(w * h));
      const rw = w - strokeWidth;
      const rh = h - strokeWidth;
      const drawable = radius > 0 ? generator.path(roundedRectPath(inset, inset, rw, rh, radius), opts) : generator.rectangle(inset, inset, rw, rh, opts);
      return roughPaths(drawable, stroke, fill, strokeWidth, dashed);
    },
    [style, w, h, radius, seed, stroke, fill, strokeWidth, dashed, inset],
  );
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? (
        <rect x={inset} y={inset} width={Math.max(0, w - strokeWidth)} height={Math.max(0, h - strokeWidth)} rx={radius}
          fill={fillVar(fill)} stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeDasharray={dashed ? '6 5' : undefined} />
      )}
    </svg>
  );
}

export function SketchEllipse({ w, h, style, seed, stroke = 'ink', fill = 'none', strokeWidth = 1.5, dashed }: ShapeBase & { w: number; h: number }) {
  const paths = useMemo(
    () => (style === 'sketchy' ? roughPaths(generator.ellipse(w / 2, h / 2, w - strokeWidth, h - strokeWidth, roughOpts(seed, fill, strokeWidth, Math.sqrt(w * h))), stroke, fill, strokeWidth, dashed) : null),
    [style, w, h, seed, stroke, fill, strokeWidth, dashed],
  );
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? <ellipse cx={w / 2} cy={h / 2} rx={(w - strokeWidth) / 2} ry={(h - strokeWidth) / 2} fill={fillVar(fill)} stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeDasharray={dashed ? '6 5' : undefined} />}
    </svg>
  );
}

/** Closed polygon, points in local px. */
export function SketchPolygon({ w, h, points, style, seed, stroke = 'ink', fill = 'none', strokeWidth = 1.5, dashed }: ShapeBase & { w: number; h: number; points: [number, number][] }) {
  const key = points.flat().join(',');
  const paths = useMemo(
    () => (style === 'sketchy' ? roughPaths(generator.polygon(points, roughOpts(seed, fill, strokeWidth, extent(points))), stroke, fill, strokeWidth, dashed) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [style, key, seed, stroke, fill, strokeWidth, dashed],
  );
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? <polygon points={points.map((p) => p.join(',')).join(' ')} fill={fillVar(fill)} stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeLinejoin="round" strokeDasharray={dashed ? '6 5' : undefined} />}
    </svg>
  );
}

/** Open polyline (lines, crosses, chevrons, ticks). */
export function SketchLines({ w, h, lines, style, seed, stroke = 'ink', strokeWidth = 1.5 }: Omit<ShapeBase, 'fill'> & { w: number; h: number; lines: [number, number][][] }) {
  const key = lines.map((l) => l.flat().join(',')).join('|');
  const paths = useMemo(
    () =>
      style === 'sketchy'
        ? lines.flatMap((l, i) => roughPaths(generator.linearPath(l, roughOpts(seed + i, 'none', strokeWidth, extent(l))), stroke, 'none', strokeWidth, false, `${i}-`))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [style, key, seed, stroke, strokeWidth],
  );
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? lines.map((l, i) => <polyline key={i} points={l.map((p) => p.join(',')).join(' ')} fill="none" stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

/** Absolutely-positioned box for laying out kit internals. */
export function Box({ x = 0, y = 0, w, h, children, style }: { x?: number; y?: number; w: number; h: number; children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}>{children}</div>;
}

/**
 * Text in the active kit font. Single line with ellipsis by default; pass
 * `lines` (≥ 2) to wrap and clamp to that many lines.
 */
export function KitText({ children, size = 'md', tone = 'ink', weight, align = 'left', lines, style }: { children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; tone?: Tone; weight?: number; align?: CSSProperties['textAlign']; lines?: number; style?: CSSProperties }) {
  const multi = lines !== undefined && lines > 1;
  return (
    <span
      style={{
        fontFamily: 'var(--fs-kit-font)',
        fontSize: `var(--fs-kit-text-${size})`,
        lineHeight: 1.25,
        color: toneVar(tone, 'text'),
        fontWeight: weight,
        textAlign: align,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(multi
          ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: lines, whiteSpace: 'normal', overflowWrap: 'anywhere' }
          : { display: 'block', whiteSpace: 'nowrap' }),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Arrow along a polyline (2+ points, local px). The head is drawn at the last point.
 * Used for connectors and links (Gate 1 D5: links look like arrows).
 */
export function SketchArrow({ w, h, points, style, seed, stroke = 'ink', strokeWidth = 2, dashed, head = 9 }: Omit<ShapeBase, 'fill'> & { w: number; h: number; points: [number, number][]; head?: number }) {
  const key = points.flat().join(',');
  const headLines = useMemo(() => arrowHead(points, head), [key, head]); // eslint-disable-line react-hooks/exhaustive-deps
  const paths = useMemo(
    () =>
      style === 'sketchy'
        ? [
            ...roughPaths(generator.linearPath(points, roughOpts(seed, 'none', strokeWidth, 60)), stroke, 'none', strokeWidth, dashed, 'l'),
            ...roughPaths(generator.linearPath(headLines, roughOpts(seed + 7, 'none', strokeWidth, 30)), stroke, 'none', strokeWidth, false, 'h'),
          ]
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [style, key, seed, stroke, strokeWidth, dashed, headLines],
  );
  const pts = (l: [number, number][]) => l.map((p) => p.join(',')).join(' ');
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? (
        <>
          <polyline points={pts(points)} fill="none" stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '6 5' : undefined} />
          <polyline points={pts(headLines)} fill="none" stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** Open "V" arrowhead points for the last segment of a polyline. */
export function arrowHead(points: [number, number][], size = 9): [number, number][] {
  if (points.length < 2) return [];
  const [x2, y2] = points[points.length - 1];
  const [x1, y1] = points[points.length - 2];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  return [
    [x2 - size * Math.cos(a - spread), y2 - size * Math.sin(a - spread)],
    [x2, y2],
    [x2 - size * Math.cos(a + spread), y2 - size * Math.sin(a + spread)],
  ];
}

/**
 * The small "clickable" badge placed on the top-right corner of a link's source
 * element (Gate 1 D5). Position it inside a relatively/absolutely positioned parent.
 * Decorative by default — the element's describe() text carries the meaning for
 * screen readers; pass `label` to expose it.
 */
export function LinkMarker({ label, style: css }: { label?: string; style?: CSSProperties }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        position: 'absolute',
        top: 'calc(var(--fs-link-marker-size) / -2)',
        right: 'calc(var(--fs-link-marker-size) / -2)',
        width: 'var(--fs-link-marker-size)',
        height: 'var(--fs-link-marker-size)',
        borderRadius: '50%',
        background: 'var(--fs-link-marker)',
        boxShadow: '0 0 0 2px var(--fs-surface)',
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        ...css,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M2 8 L8 2 M4 2 H8 V6" fill="none" stroke="var(--fs-on-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
