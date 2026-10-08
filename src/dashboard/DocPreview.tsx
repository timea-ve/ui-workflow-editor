import { memo, useMemo } from 'react';
import type { BoardDoc, Element, Frame } from '../model/types';
import { kitRegistry, seedFromId } from '../kit/registry';
import { DeviceFrame } from '../kit/wireframe/DeviceFrame';

interface Box { x: number; y: number; w: number; h: number }

const PAD = 40;

/** Absolute board-space box of a frame or element (child elements are frame-relative). */
function absBox(doc: BoardDoc, id: string): Box | undefined {
  const f = doc.frames[id];
  if (f) return f;
  const e = doc.elements[id];
  if (!e) return undefined;
  const p = e.parentId ? doc.frames[e.parentId] : undefined;
  return p ? { x: p.x + e.x, y: p.y + e.y, w: e.w, h: e.h } : e;
}

/**
 * Static, non-interactive mini rendering of a board: device frames, kit elements and simple
 * step arrows. Used for template cards. Decorative (aria-hidden); the card carries the text.
 */
export const DocPreview = memo(function DocPreview({ doc, width, height }: { doc: BoardDoc; width: number; height: number }) {
  const layout = useMemo(() => {
    const frames = Object.values(doc.frames);
    const free = Object.values(doc.elements).filter((e) => !e.parentId || !doc.frames[e.parentId]);
    const boxes: Box[] = [...frames, ...free];
    if (!boxes.length) return undefined;
    const minX = Math.min(...boxes.map((b) => b.x)) - PAD;
    const minY = Math.min(...boxes.map((b) => b.y)) - PAD;
    const maxX = Math.max(...boxes.map((b) => b.x + b.w)) + PAD;
    const maxY = Math.max(...boxes.map((b) => b.y + b.h)) + PAD;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const scale = Math.min(width / bw, height / bh);
    const arrows = Object.values(doc.connectors).flatMap((c) => {
      const a = absBox(doc, c.from.nodeId);
      const b = absBox(doc, c.to.nodeId);
      if (!a || !b) return [];
      const ax = a.x + a.w;
      const ay = a.y + a.h / 2;
      if (b.x > ax) {
        const by = Math.min(Math.max(ay, b.y + 40), b.y + b.h - 40);
        const mid = (ax + b.x) / 2;
        return [`M${ax - minX},${ay - minY} H${mid - minX} V${by - minY} H${b.x - minX}`];
      }
      if (b.y > a.y + a.h) {
        const sx = a.x + a.w / 2;
        return [`M${sx - minX},${a.y + a.h - minY} V${b.y + Math.min(b.h / 2, 60) - minY} H${b.x - minX}`];
      }
      return [];
    });
    return { frames, free, minX, minY, bw, bh, scale, arrows };
  }, [doc, width, height]);

  if (!layout) return <div className="fsd-preview" style={{ width, height }} aria-hidden />;
  const { frames, free, minX, minY, bw, bh, scale, arrows } = layout;
  const children = (f: Frame) => Object.values(doc.elements).filter((e) => e.parentId === f.id);

  return (
    <div className="fsd-preview" style={{ width, height }} aria-hidden data-kit-style="clean">
      <div
        style={{
          position: 'absolute', width: bw, height: bh, transformOrigin: '0 0',
          transform: `translate(${(width - bw * scale) / 2}px, ${(height - bh * scale) / 2}px) scale(${scale})`,
        }}
      >
        <svg width={bw} height={bh} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {arrows.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="var(--fs-accent)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {frames.map((f) => (
          <div key={f.id} style={{ position: 'absolute', left: f.x - minX, top: f.y - minY, width: f.w, height: f.h }}>
            <DeviceFrame device={f.device} w={f.w} h={f.h} name="" style="clean" seed={seedFromId(f.id)} />
            {children(f).map((e) => <Item key={e.id} el={e} left={e.x} top={e.y} />)}
          </div>
        ))}
        {free.map((e) => <Item key={e.id} el={e} left={e.x - minX} top={e.y - minY} />)}
      </div>
    </div>
  );
});

function Item({ el, left, top }: { el: Element; left: number; top: number }) {
  const def = kitRegistry.get(el.type);
  if (!def) return null;
  const props = { ...def.defaultProps, ...el.props };
  return (
    <div style={{ position: 'absolute', left, top, width: el.w, height: el.h }}>
      {def.render(props, { w: el.w, h: el.h, style: 'clean', seed: seedFromId(el.id) })}
    </div>
  );
}
