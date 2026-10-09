// Mounted in the editor's `canvas` slot: inline text editing (double-click / Enter / F2, and straight
// after placing Text or Sticky), keyboard resize (Alt+Shift+Arrows), palette drag-and-drop target,
// and the bridge that lets memoised nodes commit resizes.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ViewportPortal, useStore } from '@xyflow/react';
import { isTypingTarget } from '../../../chrome/tools';
import { renameFrame } from '../../../flow/ops';
import type { ID } from '../../../model/types';
import { useEditor } from '../../EditorContext';
import { setBridge, setEditingId, type ComponentsBridge } from './bridge';
import { focusNode, insertPaletteItem } from './insert';
import { absRect, frameAtPoint, nudgeSize, setElementText, textPropOf, GRID } from './ops';
import { DRAG_MIME, paletteItem } from './paletteItems';

interface Editing { id: ID; kind: 'element' | 'frame'; multiline: boolean; initial: string }

const inChrome = (t: EventTarget | null) =>
  !!(t as HTMLElement | null)?.closest?.('.fsc-topbar, .fsc-toolbar, .fse-left__panel, .fse-right, .fse-device-hint, .fs-ctx-bar, button, a, [role="menu"], [role="dialog"], [role="listbox"]')
  && !(t as HTMLElement).closest('.react-flow__node');

export function CanvasLayer() {
  const api = useEditor();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  useEffect(() => { setEditingId(editing?.id ?? null); }, [editing]);
  useEffect(() => () => setEditingId(null), []);
  const domNode = useStore((s) => s.domNode);

  const startEdit = useCallback((id: ID): boolean => {
    const { store, readOnly } = apiRef.current;
    if (readOnly) return false;
    const doc = store.getDoc();
    const f = doc.frames[id];
    if (f) { setEditing({ id, kind: 'frame', multiline: false, initial: f.name }); return true; }
    const e = doc.elements[id];
    const tp = e && textPropOf(e.type);
    if (!e || !tp) return false;
    const v = e.props[tp.key];
    setEditing({ id, kind: 'element', multiline: tp.multiline, initial: Array.isArray(v) ? v.join(', ') : String(v ?? '') });
    return true;
  }, []);

  // Bridge for memoised nodes (resize handles).
  const editable = !api.readOnly && api.tool === 'select';
  const bridge = useRef<ComponentsBridge>({
    apply: (op, opts) => apiRef.current.apply(op, opts),
    getDoc: () => apiRef.current.store.getDoc(),
    announce: (m) => apiRef.current.announce(m),
    editText: (id) => { startEdit(id); },
  });
  useEffect(() => { setBridge({ api: bridge.current, editable }); }, [editable]);
  useEffect(() => () => setBridge({ api: null, editable: false }), []);

  // Double-click a text element, or a screen's name label, to edit in place.
  useEffect(() => {
    if (!domNode) return;
    const onDbl = (e: MouseEvent) => {
      const a = apiRef.current;
      if (a.readOnly || a.tool !== 'select' || editingRef.current) return;
      const node = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('.react-flow__node');
      const id = node?.dataset.id;
      if (!id) return;
      const doc = a.store.getDoc();
      const f = doc.frames[id];
      if (f && a.screenToFlow({ x: e.clientX, y: e.clientY }).y >= f.y) return;
      if (!startEdit(id)) return;
      e.preventDefault();
      e.stopPropagation(); // no double-click zoom
      a.setSelection([id]);
    };
    domNode.addEventListener('dblclick', onDbl, true);
    return () => domNode.removeEventListener('dblclick', onDbl, true);
  }, [domNode, startEdit]);

  // Enter / F2 edits the selected node's text; Alt+Shift+Arrows resize by 8px. Registered before the
  // editor's own keyboard handler (child effects run first), so we see these keys first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = apiRef.current;
      if (e.defaultPrevented || editingRef.current || a.readOnly || isTypingTarget(e.target) || inChrome(e.target)) return;
      const sel = a.selection.nodes;
      if (sel.length !== 1) return;
      const id = sel[0];
      if ((e.key === 'Enter' || e.key === 'F2') && a.tool === 'select' && !e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (!startEdit(id)) return;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.altKey && e.shiftKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        e.stopPropagation();
        const dw = e.key === 'ArrowRight' ? GRID : e.key === 'ArrowLeft' ? -GRID : 0;
        const dh = e.key === 'ArrowDown' ? GRID : e.key === 'ArrowUp' ? -GRID : 0;
        const ok = a.apply((d) => nudgeSize(d, id, dw, dh), { label: 'Resize', mergeKey: `resize:${id}` });
        const n = a.store.getDoc().frames[id] ?? a.store.getDoc().elements[id];
        if (ok && n) a.announce(`${n.w} × ${n.h}`);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [startEdit]);

  // Text (T) and Sticky (N) placements go straight into edit mode.
  // The selection of the placed element arrives a moment after the tool switches back, so remember
  // which elements existed while the tool was active and wait briefly for a new one to be selected.
  const pendingAuto = useRef<{ before: Set<ID>; until: number } | null>(null);
  useEffect(() => {
    if (api.tool === 'text' || api.tool === 'sticky') {
      pendingAuto.current = { before: new Set(Object.keys(api.store.getDoc().elements)), until: Infinity };
      return;
    }
    const p = pendingAuto.current;
    if (!p) return;
    if (p.until === Infinity) p.until = Date.now() + 1000;
    if (api.tool !== 'select' || Date.now() > p.until) { pendingAuto.current = null; return; }
    const sel = api.selection.nodes;
    if (sel.length === 1 && !p.before.has(sel[0]) && api.store.getDoc().elements[sel[0]]) {
      pendingAuto.current = null;
      startEdit(sel[0]);
    }
  }, [api.tool, api.selection.nodes, api.store, startEdit]);

  // Drag-and-drop from the Insert palette.
  const [dropFrame, setDropFrame] = useState<ID | null>(null);
  useEffect(() => {
    if (!domNode) return;
    const accepts = (e: DragEvent) => !!e.dataTransfer?.types.includes(DRAG_MIME) && !apiRef.current.readOnly;
    const over = (e: DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
      const a = apiRef.current;
      const f = frameAtPoint(a.store.getDoc(), a.screenToFlow({ x: e.clientX, y: e.clientY })) ?? null;
      setDropFrame((cur) => (cur === f ? cur : f));
    };
    const leave = (e: DragEvent) => {
      if (!domNode.contains(e.relatedTarget as Node | null)) setDropFrame(null);
    };
    const drop = (e: DragEvent) => {
      setDropFrame(null);
      if (!accepts(e)) return;
      const item = paletteItem(e.dataTransfer!.getData(DRAG_MIME));
      if (!item) return;
      e.preventDefault();
      const a = apiRef.current;
      const id = insertPaletteItem(a, item, a.screenToFlow({ x: e.clientX, y: e.clientY }));
      if (id) focusNode(id);
    };
    domNode.addEventListener('dragover', over);
    domNode.addEventListener('dragleave', leave);
    domNode.addEventListener('drop', drop);
    return () => {
      domNode.removeEventListener('dragover', over);
      domNode.removeEventListener('dragleave', leave);
      domNode.removeEventListener('drop', drop);
    };
  }, [domNode]);

  const doc = api.doc;
  // Cancel editing if the node disappears (undo, remote delete).
  useEffect(() => {
    if (editing && !doc.frames[editing.id] && !doc.elements[editing.id]) setEditing(null);
  }, [doc, editing]);

  const finish = useCallback((value: string | null) => {
    const ed = editingRef.current;
    if (!ed) return;
    setEditing(null);
    editingRef.current = null;
    const a = apiRef.current;
    if (value !== null && value !== ed.initial) {
      if (ed.kind === 'frame') {
        const name = value.trim();
        if (name && a.apply((d) => renameFrame(d, ed.id, name), { label: 'Rename screen' })) a.announce(`Renamed to ${name}`);
      } else if (a.apply((d) => setElementText(d, ed.id, value), { label: 'Edit text' })) a.announce('Text updated');
    }
    focusNode(ed.id);
  }, []);

  const dropRect = dropFrame ? absRect(doc, dropFrame) : undefined;
  const editRect = editing ? absRect(doc, editing.id) : undefined;

  return (
    <ViewportPortal>
      {dropRect && (
        <div className="fs-drop-target" aria-hidden
          style={{ transform: `translate(${dropRect.x}px, ${dropRect.y}px)`, width: dropRect.w, height: dropRect.h }} />
      )}
      {editing && editRect && (
        <InlineEditor key={editing.id} editing={editing} rect={editRect} onDone={finish} />
      )}
    </ViewportPortal>
  );
}

function InlineEditor({ editing, rect, onDone }: {
  editing: Editing; rect: { x: number; y: number; w: number; h: number }; onDone(value: string | null): void;
}) {
  const [value, setValue] = useState(editing.initial);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, []);
  const end = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); end(null); return; }
    if (e.key === 'Enter' && !(editing.multiline && e.shiftKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      end(value);
    }
  };
  const frame = editing.kind === 'frame';
  const single = !editing.multiline;
  const h = frame ? 28 : single ? Math.max(28, Math.min(rect.h, 48)) : Math.max(40, rect.h);
  const style = {
    transform: `translate(${rect.x}px, ${frame ? rect.y - 30 : rect.y + (single ? Math.max(0, (rect.h - h) / 2) : 0)}px)`,
    width: frame ? Math.max(160, Math.min(rect.w, 360)) : Math.max(80, rect.w),
    height: h,
  };
  const common = {
    ref,
    className: `fs-inline-edit nodrag nopan nowheel${frame ? ' fs-inline-edit--name' : ''}`,
    style,
    value,
    'aria-label': frame ? 'Screen name' : editing.multiline ? 'Edit text (Shift+Enter for a new line)' : 'Edit text',
    onChange: (e: { target: { value: string } }) => setValue(e.target.value),
    onKeyDown,
    onBlur: () => end(value),
    onPointerDown: (e: { stopPropagation(): void }) => e.stopPropagation(),
    spellCheck: false,
  };
  return editing.multiline ? <textarea {...common} /> : <input {...common} />;
}
