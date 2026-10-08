// Compare: two read-only panes side by side, one option each, pan/zoom kept in sync (aligned on start screens).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, useNodesInitialized, useOnViewportChange, useReactFlow, type Viewport } from '@xyflow/react';
import { X } from 'lucide-react';
import type { BoardDoc, ID } from '../../../model/types';
import { EditorContext, useEditor } from '../../EditorContext';
import { FlowCanvas } from '../../../flow/FlowCanvas';
import { OptionChip } from '../../../chrome/OptionChip';
import { getFlowIndex, type FlowGroup, type FlowOption } from './flowIndex';

/** A sub-board with just one option: its screens, their contents, arrows/links between them, and shapes wired to them. */
export function optionDoc(doc: BoardDoc, option: FlowOption): BoardDoc {
  const frameIds = new Set(option.frameIds);
  const frames = Object.fromEntries(option.frameIds.filter((id) => doc.frames[id]).map((id) => {
    const { variantId: _v, ...f } = doc.frames[id];
    return [id, f];
  }));
  const keep = new Set<ID>(frameIds);
  for (const e of Object.values(doc.elements)) if (e.parentId && frameIds.has(e.parentId)) keep.add(e.id);
  const shapes = new Set<ID>();
  for (const c of Object.values(doc.connectors)) {
    const a = keep.has(c.from.nodeId); const b = keep.has(c.to.nodeId);
    const free = (id: ID) => doc.elements[id] && !doc.elements[id].parentId;
    if (a && free(c.to.nodeId)) shapes.add(c.to.nodeId);
    if (b && free(c.from.nodeId)) shapes.add(c.from.nodeId);
  }
  shapes.forEach((id) => keep.add(id));
  const elements = Object.fromEntries([...keep].filter((id) => doc.elements[id]).map((id) => [id, doc.elements[id]]));
  const connectors = Object.fromEntries(Object.values(doc.connectors)
    .filter((c) => keep.has(c.from.nodeId) && keep.has(c.to.nodeId)).map((c) => [c.id, c]));
  const links = Object.fromEntries(Object.values(doc.links)
    .filter((l) => keep.has(l.sourceElementId) && frameIds.has(l.targetFrameId)).map((l) => [l.id, l]));
  return { frames, elements, connectors, links, variants: {}, flowNames: {} };
}

type Side = 0 | 1;

/** Keeps two React Flow viewports aligned: same zoom, each option's start screen at the same spot. */
class ViewportSync {
  private setters: [((v: Viewport) => void) | null, ((v: Viewport) => void) | null] = [null, null];
  private last: [Viewport | null, Viewport | null] = [null, null];
  private applying = false;
  starts: [{ x: number; y: number }, { x: number; y: number }];
  constructor(starts: [{ x: number; y: number }, { x: number; y: number }]) { this.starts = starts; }
  private map(from: Side, v: Viewport): Viewport {
    const a = this.starts[from]; const b = this.starts[from === 0 ? 1 : 0];
    return { zoom: v.zoom, x: v.x + v.zoom * (a.x - b.x), y: v.y + v.zoom * (a.y - b.y) };
  }
  register(side: Side, set: (v: Viewport) => void) {
    this.setters[side] = set;
    const other: Side = side === 0 ? 1 : 0;
    const lv = this.last[other];
    if (lv) this.push(other, lv);
    return () => { if (this.setters[side] === set) this.setters[side] = null; };
  }
  emit(side: Side, v: Viewport) {
    if (this.applying) return;
    this.last[side] = v;
    this.push(side, v);
  }
  private push(from: Side, v: Viewport) {
    const to: Side = from === 0 ? 1 : 0;
    const set = this.setters[to];
    if (!set) return;
    const next = this.map(from, v);
    this.last[to] = next;
    this.applying = true;
    try { set(next); } finally { this.applying = false; }
  }
}

function SyncAgent({ side, sync, lead }: { side: Side; sync: ViewportSync; lead: boolean }) {
  const rf = useReactFlow();
  const ready = useNodesInitialized();
  useOnViewportChange({ onChange: (v) => sync.emit(side, v) });
  useEffect(() => sync.register(side, (v) => { void rf.setViewport(v); }), [rf, side, sync]);
  useEffect(() => {
    if (!ready || !lead) return;
    void Promise.resolve(rf.fitView({ padding: 0.15, maxZoom: 1 })).then(() => sync.emit(side, rf.getViewport()));
  }, [ready, lead, rf, side, sync]);
  return null;
}

const VIEW = { style: 'clean' as const };

function Pane({ doc, option, side, sync, lead, label }: { doc: BoardDoc; option: FlowOption; side: Side; sync: ViewportSync; lead: boolean; label: string }) {
  const sub = useMemo(() => optionDoc(doc, option), [doc, option]);
  return (
    <section className="fs-compare__pane" aria-label={label} data-side={side === 0 ? 'left' : 'right'}>
      <ReactFlowProvider>
        <FlowCanvas doc={sub} view={VIEW} readOnly showMiniMap={false}>
          <SyncAgent side={side} sync={sync} lead={lead} />
        </FlowCanvas>
      </ReactFlowProvider>
    </section>
  );
}

export function CompareView({ groupKey, onClose }: { groupKey: ID; onClose: () => void }) {
  const { doc } = useEditor();
  const group: FlowGroup | undefined = getFlowIndex(doc).groupByKey.get(groupKey);
  const options = group?.options ?? [];
  const [picked, setPicked] = useState<[number, number]>([0, Math.min(1, options.length - 1)]);
  const left = options[Math.min(picked[0], options.length - 1)];
  const right = options[Math.min(picked[1], options.length - 1)];
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    closeRef.current?.focus();
    return () => { (returnFocus.current as HTMLElement | null)?.focus?.(); };
  }, []);
  useEffect(() => { if (!group || options.length < 2) onClose(); }, [group, options.length, onClose]);

  const startOf = (o?: FlowOption) => (o && doc.frames[o.startFrameId]) || { x: 0, y: 0 };
  const sa = startOf(left); const sb = startOf(right);
  // New sync whenever the pair changes; panes remount with it.
  const sync = useMemo(() => new ViewportSync([{ x: sa.x, y: sa.y }, { x: sb.x, y: sb.y }]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [left?.variantId, right?.variantId]);
  sync.starts = [{ x: sa.x, y: sa.y }, { x: sb.x, y: sb.y }];

  if (!group || !left || !right) return null;
  const pickerFor = (side: Side) => (
    <div className="fs-compare__picker" role="radiogroup" aria-label={side === 0 ? 'Left pane option' : 'Right pane option'}>
      {options.map((o, i) => (
        <span key={o.variantId ?? i} role="presentation">
          <OptionChip
            letter={o.letter}
            label={o.label}
            active={picked[side] === i}
            role="radio"
            onClick={() => setPicked((p) => (side === 0 ? [i, p[1]] : [p[0], i]))}
          />
        </span>
      ))}
    </div>
  );
  return (
    <div className="fs-compare fsc-root" role="dialog" aria-modal="true" aria-label={`Compare options – ${group.name}`}>
      <header className="fs-compare__bar">
        <strong className="fs-compare__title">Compare · {group.name}</strong>
        <span className="fs-compare__hint">Pan or zoom either side — both follow.</span>
        <span style={{ flex: 1 }} />
        <button ref={closeRef} type="button" className="fsc-btn" onClick={onClose} aria-keyshortcuts="Escape">
          <X size={16} strokeWidth={1.75} aria-hidden /> Close <kbd className="fsc-kbd">Esc</kbd>
        </button>
      </header>
      <div className="fs-compare__heads">
        {pickerFor(0)}
        {pickerFor(1)}
      </div>
      <EditorContext.Provider value={null}>
        <div className="fs-compare__panes">
          <Pane key={`l-${left.variantId}`} doc={doc} option={left} side={0} sync={sync} lead label={`Left: ${left.label}`} />
          <Pane key={`r-${right.variantId}-${left.variantId}`} doc={doc} option={right} side={1} sync={sync} lead={false} label={`Right: ${right.label}`} />
        </div>
      </EditorContext.Provider>
    </div>
  );
}
