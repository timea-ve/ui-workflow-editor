import type { CSSProperties } from 'react';
import type { BoardDoc, Element } from '../model/types';
import { DeviceFrame } from '../kit/wireframe/DeviceFrame';
import { seedFromId } from '../kit/registry';
import { LinkMarker, SketchArrow, SketchLines, SketchRect } from '../design/primitives';
import { ElementView } from '../flow/KitNode';
import { linkSourceIds } from '../flow/ops';
import { connectorGeometry, laneRect } from './scope';
import './export.css';

const STYLE = 'clean' as const;

/**
 * Static, non-interactive board renderer used for export capture. Draws straight from the doc:
 * option lanes, screens (+ names above them), elements, connectors and link arrows.
 * `origin` is the canvas point that maps to the top-left of the image.
 */
export function StaticBoard({ doc, origin, width, height, background }: {
  doc: BoardDoc; origin: { x: number; y: number }; width: number; height: number; background: 'white' | 'transparent';
}) {
  const sources = linkSourceIds(doc);
  // Fractional-index keys compare by code unit, not locale.
  const byZ = <T extends { z: string }>(a: T, b: T) => (a.z < b.z ? -1 : a.z > b.z ? 1 : 0);
  const elements = Object.values(doc.elements).sort(byZ);
  const at = (x: number, y: number, w: number, h: number): CSSProperties => ({ position: 'absolute', left: x - origin.x, top: y - origin.y, width: w, height: h });

  const renderElement = (el: Element, abs: boolean) => (
    <div key={el.id} style={abs ? at(el.x, el.y, el.w, el.h) : { position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h }}>
      <ElementView element={el} style={STYLE} />
      {sources.has(el.id) && <LinkMarker />}
    </div>
  );

  return (
    <div className="fs-export-board" data-kit-style={STYLE} data-background={background} style={{ width, height }}>
      {Object.values(doc.variants).map((v) => {
        const r = laneRect(doc, v.id);
        if (!r) return null;
        return (
          <div key={v.id} style={at(r.x, r.y, r.w, r.h)}>
            <SketchRect w={r.w} h={r.h} radius={16} style={STYLE} seed={seedFromId(v.id)} stroke="faint" dashed />
            <span className="fs-export-lane-chip">{v.label}</span>
          </div>
        );
      })}
      {Object.values(doc.frames).sort(byZ).map((f) => (
        <div key={f.id} style={at(f.x, f.y, f.w, f.h)}>
          <DeviceFrame device={f.device} w={f.w} h={f.h} name={f.name} style={STYLE} seed={seedFromId(f.id)} />
          {elements.filter((e) => e.parentId === f.id).map((e) => renderElement(e, false))}
        </div>
      ))}
      {elements.filter((e) => !e.parentId || !doc.frames[e.parentId]).map((e) => renderElement(e, true))}
      {Object.values(doc.connectors).map((c) => {
        const g = connectorGeometry(doc, c);
        if (!g || g.points.length < 2) return null;
        const pts = g.points.map(([x, y]) => [x - origin.x, y - origin.y] as [number, number]);
        const seed = seedFromId(c.id);
        return (
          <div key={c.id} className="fs-export-edge">
            {c.arrowheads === 'none'
              ? <SketchLines w={1} h={1} lines={[pts]} style={STYLE} seed={seed} stroke="ink" strokeWidth={2} />
              : <SketchArrow w={1} h={1} points={pts} style={STYLE} seed={seed} stroke="ink" strokeWidth={2} />}
            {c.arrowheads === 'both' && <SketchArrow w={1} h={1} points={[pts[1], pts[0]]} style={STYLE} seed={seed + 11} stroke="ink" strokeWidth={2} />}
            {c.label && (
              <span className="fs-export-edge-label" style={{ left: g.labelX - origin.x, top: g.labelY - origin.y }}>{c.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
