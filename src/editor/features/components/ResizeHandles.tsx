// Corner resize handles for the selected node. Pointer-only affordance; keyboard users resize with
// Alt+Shift+Arrows or the Inspector's W/H fields. One undo step per resize (committed on pointer up).
import { memo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore, useStoreApi, type ReactFlowState } from '@xyflow/react';
import type { ID } from '../../../model/types';
import { useEditableBridge } from './bridge';
import { resizeBox, resizeRules, setNodeBox, type Box, type ResizeHandle } from './ops';

const multiSelected = (s: ReactFlowState) => {
  let n = 0;
  for (const node of s.nodes) if (node.selected && ++n > 1) return true;
  return false;
};

export interface ResizeHandlesProps {
  id: ID;
  /** Live preview while dragging (stored coordinates), null when done. */
  onPreview(box: Box | null): void;
}

export const ResizeHandles = memo(function ResizeHandles({ id, onPreview }: ResizeHandlesProps) {
  const bridge = useEditableBridge();
  const multi = useStore(multiSelected);
  const storeApi = useStoreApi();
  const drag = useRef<{ handle: ResizeHandle; sx: number; sy: number; start: Box; last: Box } | null>(null);
  if (!bridge || multi) return null;
  const doc = bridge.getDoc();
  const rules = resizeRules(doc, id);
  if (!rules || rules.axes === 'none') return null;
  const handles: ResizeHandle[] = rules.axes === 'vertical' ? ['sw', 'se'] : ['nw', 'ne', 'sw', 'se'];

  const down = (handle: ResizeHandle) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const cur = bridge.getDoc();
    const node = cur.frames[id] ?? cur.elements[id];
    if (!node) return;
    const start = { x: node.x, y: node.y, w: node.w, h: node.h };
    drag.current = { handle, sx: e.clientX, sy: e.clientY, start, last: start };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = resizeRules(bridge.getDoc(), id);
    if (!r) return;
    const zoom = storeApi.getState().transform[2] || 1;
    const box = resizeBox(d.start, d.handle, (e.clientX - d.sx) / zoom, (e.clientY - d.sy) / zoom, { ...r, snap: !e.altKey });
    if (box.x === d.last.x && box.y === d.last.y && box.w === d.last.w && box.h === d.last.h) return;
    d.last = box;
    onPreview(box);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onPreview(null);
    const b = d.last;
    if (bridge.apply((cur) => setNodeBox(cur, id, b), { label: 'Resize' })) bridge.announce(`Resized to ${b.w} × ${b.h}`);
  };
  const cancel = () => { drag.current = null; onPreview(null); };

  return (
    <>
      {handles.map((h) => (
        <div
          key={h}
          className={`fs-resize-handle fs-resize-handle--${h} nodrag nopan`}
          data-handle={h}
          aria-hidden
          onPointerDown={down(h)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
        />
      ))}
    </>
  );
});
