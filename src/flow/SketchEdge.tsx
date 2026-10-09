import { memo, useCallback, useMemo } from 'react';
import {
  BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useStore, type EdgeProps,
} from '@xyflow/react';
import { EdgeLabelEditor, EdgeTools } from '../editor/features/flows/EdgeControls';
import { useIsEditingEdge } from '../editor/features/flows/edgeEditing';
import { SketchArrow, SketchLines } from '../design/primitives';
import { seedFromId } from '../kit/registry';
import type { SketchFlowEdge } from './adapter';
import { useFlowView } from './context';
import { pointsToPath } from './routing';

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
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps<SketchFlowEdge>) {
  const { style } = useFlowView();
  const routing = data?.routing ?? 'step';
  const route = data?.route;
  // The stored route is only valid while both ends sit where it was computed (not mid-drag).
  const routeFresh = useStore(useCallback((s: { nodeLookup: Map<string, { internals: { positionAbsolute: { x: number; y: number } } }> }) => {
    if (!route) return false;
    const a = s.nodeLookup.get(source)?.internals.positionAbsolute;
    const b = s.nodeLookup.get(target)?.internals.positionAbsolute;
    const near = (p: { x: number; y: number } | undefined, q: { x: number; y: number }) => !!p && Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5;
    return near(a, route.from) && near(b, route.to);
  }, [route, source, target]));
  const [path, labelX, labelY, points] = useMemo((): [string, number, number, Pt[]] => {
    if (route && routeFresh) return [pointsToPath(route.points), route.labelX, route.labelY, route.points];
    const args = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    const [d, lx, ly] = routing === 'straight' ? getStraightPath(args)
      : routing === 'curved' ? getBezierPath(args)
        : getSmoothStepPath({ ...args, borderRadius: 0, offset: 24 });
    return [d, lx, ly, routing === 'curved' ? bezierPoints(d) : pathToPoints(d)];
  }, [route, routeFresh, routing, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);
  const seed = seedFromId(id);
  const tone = selected ? 'accent' : 'ink';
  const heads = data?.arrowheads ?? 'end';
  const editing = useIsEditingEdge(id);

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: 'transparent', strokeWidth: 0 }} interactionWidth={16} />
      {points.length >= 2 && (
        <g className="fs-sketch-edge" data-source={source} data-target={target}>
          {heads === 'none'
            ? <SketchLines w={1} h={1} lines={[points]} style={style} seed={seed} stroke={tone} strokeWidth={2} />
            : <SketchArrow w={1} h={1} points={points} style={style} seed={seed} stroke={tone} strokeWidth={2} />}
          {heads === 'both' && (
            <SketchArrow w={1} h={1} points={[points[1], points[0]]} style={style} seed={seed + 11} stroke={tone} strokeWidth={2} />
          )}
        </g>
      )}
      {editing
        ? <EdgeLabelEditor id={id} x={labelX} y={labelY} />
        : data?.label && <EdgeLabel id={id} label={data.label} x={labelX} y={labelY} selected={!!selected} />}
      {selected && !editing && <EdgeTools id={id} x={labelX} y={labelY} />}
    </>
  );
});

/** Labels stay readable when zoomed out: below 70% zoom they're partly counter-scaled (quantised so few re-renders). */
const labelScaleSelector = (s: { transform: [number, number, number] }) => {
  const z = s.transform[2];
  return z >= 0.7 ? 1 : Math.round(Math.min(1.8, Math.sqrt(0.7 / z)) * 10) / 10;
};

function EdgeLabel({ id, label, x, y, selected }: { id: string; label: string; x: number; y: number; selected: boolean }) {
  const scale = useStore(labelScaleSelector);
  return (
    <EdgeLabelRenderer>
      <div
        className={`fs-edge-label nodrag nopan${selected ? ' is-selected' : ''}`}
        data-edge-id={id}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)${scale !== 1 ? ` scale(${scale})` : ''}` }}
      >
        {label}
      </div>
    </EdgeLabelRenderer>
  );
}
