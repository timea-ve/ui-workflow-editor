// Shared drawing primitives. Every kit item draws with these so the
// sketchy/clean switch is handled in exactly one place.
// Owner: Design System agent (may tune roughness, stroke widths, etc.).

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import type { VisualStyle } from '../kit/types';

const generator = rough.generator();

export type Tone = 'ink' | 'muted' | 'faint' | 'accent' | 'surface' | 'none';

const toneVar = (t: Tone) => (t === 'none' ? 'none' : `var(--fs-${t})`);

interface ShapeBase {
  style: VisualStyle;
  seed: number;
  stroke?: Tone;
  fill?: Tone;
  strokeWidth?: number;
  dashed?: boolean;
}

function roughPaths(drawable: ReturnType<typeof generator.rectangle>, stroke: Tone, fill: Tone, sw: number, dashed?: boolean) {
  return generator.toPaths(drawable).map((p, i) => {
    const isFill = p.fill && p.fill !== 'none' && p.stroke === 'none';
    return (
      <path
        key={i}
        d={p.d}
        fill={isFill ? toneVar(fill) : 'none'}
        stroke={isFill ? 'none' : toneVar(stroke)}
        strokeWidth={isFill ? 0 : sw}
        strokeDasharray={dashed && !isFill ? '6 5' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  });
}

function roughOpts(seed: number, fill: Tone, sw: number): Options {
  return {
    seed: Math.max(1, Math.floor(seed) % 2 ** 31),
    roughness: 1.1,
    bowing: 0.8,
    strokeWidth: sw,
    fill: fill === 'none' ? undefined : 'x',
    fillStyle: 'solid',
    preserveVertices: true,
  };
}

const svgStyle: CSSProperties = { position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' };

/** Rectangle that fills its parent box (w×h). */
export function SketchRect({ w, h, radius = 0, style, seed, stroke = 'ink', fill = 'none', strokeWidth = 1.5, dashed }: ShapeBase & { w: number; h: number; radius?: number }) {
  const inset = strokeWidth / 2;
  const paths = useMemo(
    () => (style === 'sketchy' ? roughPaths(generator.rectangle(inset, inset, w - strokeWidth, h - strokeWidth, roughOpts(seed, fill, strokeWidth)), stroke, fill, strokeWidth, dashed) : null),
    [style, w, h, seed, stroke, fill, strokeWidth, dashed, inset],
  );
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? (
        <rect x={inset} y={inset} width={Math.max(0, w - strokeWidth)} height={Math.max(0, h - strokeWidth)} rx={radius}
          fill={toneVar(fill)} stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeDasharray={dashed ? '6 5' : undefined} />
      )}
    </svg>
  );
}

export function SketchEllipse({ w, h, style, seed, stroke = 'ink', fill = 'none', strokeWidth = 1.5, dashed }: ShapeBase & { w: number; h: number }) {
  const paths = useMemo(
    () => (style === 'sketchy' ? roughPaths(generator.ellipse(w / 2, h / 2, w - strokeWidth, h - strokeWidth, roughOpts(seed, fill, strokeWidth)), stroke, fill, strokeWidth, dashed) : null),
    [style, w, h, seed, stroke, fill, strokeWidth, dashed],
  );
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? <ellipse cx={w / 2} cy={h / 2} rx={(w - strokeWidth) / 2} ry={(h - strokeWidth) / 2} fill={toneVar(fill)} stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeDasharray={dashed ? '6 5' : undefined} />}
    </svg>
  );
}

/** Closed polygon, points in local px. */
export function SketchPolygon({ w, h, points, style, seed, stroke = 'ink', fill = 'none', strokeWidth = 1.5, dashed }: ShapeBase & { w: number; h: number; points: [number, number][] }) {
  const key = points.flat().join(',');
  const paths = useMemo(
    () => (style === 'sketchy' ? roughPaths(generator.polygon(points, roughOpts(seed, fill, strokeWidth)), stroke, fill, strokeWidth, dashed) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [style, key, seed, stroke, fill, strokeWidth, dashed],
  );
  return (
    <svg width={w} height={h} style={svgStyle} aria-hidden>
      {paths ?? <polygon points={points.map((p) => p.join(',')).join(' ')} fill={toneVar(fill)} stroke={toneVar(stroke)} strokeWidth={strokeWidth} strokeLinejoin="round" strokeDasharray={dashed ? '6 5' : undefined} />}
    </svg>
  );
}

/** Open polyline (lines, crosses, chevrons, ticks). */
export function SketchLines({ w, h, lines, style, seed, stroke = 'ink', strokeWidth = 1.5 }: Omit<ShapeBase, 'fill'> & { w: number; h: number; lines: [number, number][][] }) {
  const key = lines.map((l) => l.flat().join(',')).join('|');
  const paths = useMemo(
    () =>
      style === 'sketchy'
        ? lines.flatMap((l, i) => roughPaths(generator.linearPath(l, roughOpts(seed + i, 'none', strokeWidth)), stroke, 'none', strokeWidth))
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

/** Text in the active kit font. */
export function KitText({ children, size = 'md', tone = 'ink', weight, align = 'left', style }: { children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; tone?: Tone; weight?: number; align?: CSSProperties['textAlign']; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: 'var(--fs-kit-font)',
        fontSize: `var(--fs-kit-text-${size})`,
        lineHeight: 1.25,
        color: toneVar(tone),
        fontWeight: weight,
        textAlign: align,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
