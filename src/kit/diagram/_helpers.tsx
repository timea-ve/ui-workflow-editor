import type { CSSProperties, ReactNode } from 'react';
import { SketchPolygon, SketchRect, KitText } from '../../design/primitives';
import type { VisualStyle } from '../types';

/** Stadium / pill outline. Clean style uses a rounded rect; sketchy uses a many-point polygon so Rough.js keeps the curves. */
export function SketchPill({ w, h, style, seed, fill = 'none' }: { w: number; h: number; style: VisualStyle; seed: number; fill?: 'none' | 'faint' | 'surface' }) {
  if (style === 'clean') return <SketchRect w={w} h={h} radius={h / 2} style={style} seed={seed} fill={fill} />;
  return <SketchPolygon w={w} h={h} points={pillPoints(w, h, 1)} style={style} seed={seed} fill={fill} />;
}

export function pillPoints(w: number, h: number, inset: number, steps = 10): [number, number][] {
  const r = Math.max(1, Math.min(h, w) / 2 - inset);
  const cy = h / 2;
  const left = inset + r;
  const right = w - inset - r;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / steps;
    pts.push([round(right + r * Math.cos(a)), round(cy + r * Math.sin(a))]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / steps;
    pts.push([round(left + r * Math.cos(a)), round(cy + r * Math.sin(a))]);
  }
  return pts;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Centered, wrapping text inside a shape. */
export function CenteredLabel({ children, padding = 8, size = 'md', style }: { children: ReactNode; padding?: number | string; size?: 'sm' | 'md' | 'lg' | 'xl'; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding }}>
      <KitText align="center" size={size} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...style }}>{children}</KitText>
    </div>
  );
}
