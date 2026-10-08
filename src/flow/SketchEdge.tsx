import { memo, useMemo } from 'react';
import {
  BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps,
} from '@xyflow/react';
import { SketchArrow, SketchLines } from '../design/primitives';
import { seedFromId } from '../kit/registry';
import type { SketchFlowEdge } from './adapter';
import { useFlowView } from './context';

type Pt = [number, number];

/** Polyline points from an SVG path made of M/L/Q segments (React Flow step paths with radius 0). */
export function pathToPoints(d: string): Pt[] {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const p: Pt = [nums[i], nums[i + 1]];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  // Drop collinear mid points so sketchy strokes are drawn per real segment.
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const [a, b] = [pts[i - 1], pts[i + 1]];
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) !== 0;
  });
}

/** Samples a cubic bezier "M sx,sy C c1 c2 t" path into a polyline. */
function bezierPoints(d: string, steps = 16): Pt[] {
  const n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  if (n.length < 8) return pathToPoints(d);
  const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ] as Pt;
  });
}

/**
 * Connector / link arrow. Elbow (step) routing by default; drawn with the shared SketchArrow
 * primitive so sketchy and clean styles match the kit. Labels sit on a surface-coloured pill.
 */
export const SketchEdge = memo(function SketchEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps<SketchFlowEdge>) {
  const { style } = useFlowView();
  const routing = data?.routing ?? 'step';
  const [path, labelX, labelY] = useMemo(() => {
    const args = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    if (routing === 'straight') return getStraightPath(args);
    if (routing === 'curved') return getBezierPath(args);
    return getSmoothStepPath({ ...args, borderRadius: 0, offset: 24 });
  }, [routing, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);
  const points = useMemo(() => (routing === 'curved' ? bezierPoints(path) : pathToPoints(path)), [routing, path]);
  const seed = seedFromId(id);
  const tone = selected ? 'accent' : 'ink';
  const heads = data?.arrowheads ?? 'end';

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: 'transparent', strokeWidth: 0 }} interactionWidth={16} />
      {points.length >= 2 && (
        <g className="fs-sketch-edge">
          {heads === 'none'
            ? <SketchLines w={1} h={1} lines={[points]} style={style} seed={seed} stroke={tone} strokeWidth={2} />
            : <SketchArrow w={1} h={1} points={points} style={style} seed={seed} stroke={tone} strokeWidth={2} />}
          {heads === 'both' && (
            <SketchArrow w={1} h={1} points={[points[1], points[0]]} style={style} seed={seed + 11} stroke={tone} strokeWidth={2} />
          )}
        </g>
      )}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className={`fs-edge-label nodrag nopan${selected ? ' is-selected' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
