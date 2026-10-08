// All editor keyboard shortcuts + clipboard. Listens on window (capture phase for keys React Flow
// would otherwise handle itself, e.g. arrow keys on a focused node).
import { useEffect, useRef, type RefObject } from 'react';
import { useReactFlow } from '@xyflow/react';
import { isTypingTarget, toolForKey } from '../chrome/tools';
import { connectNodes, deleteConnector, deleteNodes, moveNode } from '../flow/ops';
import type { BoardDoc, Device, ID } from '../model/types';
import type { ToolId } from '../chrome/tools';
import {
  PASTE_OFFSET, copySelection, duplicateSelection, parseClipboard, pastePayload, serializeClipboard,
  type ClipboardPayload,
} from './clipboard';
import type { EditorApi } from './EditorContext';
import { isPlacementTool } from './placement';
import { reorder, type ZMove } from './zorder';

// In-memory clipboard shared by every editor in this tab (fallback when the system clipboard is unavailable).
let memoryClipboard: { text: string; payload: ClipboardPayload } | null = null;

const DEVICE_KEYS: Record<string, Device> = { '1': 'mobile', '2': 'tablet', '3': 'desktop' };
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Focus is in app chrome (toolbar, top bar, panels), where arrows / Enter / Delete belong to the control. */
const inChrome = (t: EventTarget | null) =>
  !!(t as HTMLElement | null)?.closest?.('.fsc-topbar, .fsc-toolbar, .fse-left__panel, .fse-right, .fse-device-hint, button, a, [role="menu"]')
  && !(t as HTMLElement).closest('.react-flow__node');
const inOverlay = (t: EventTarget | null) =>
  !!(t as HTMLElement | null)?.closest?.('[role="dialog"], [role="menu"], [role="listbox"], [role="alertdialog"]');

export interface EditorKeyboardOptions {
  api: EditorApi;
  canvasEl: RefObject<HTMLDivElement | null>;
  lastPointer: RefObject<{ x: number; y: number } | null>;
  device: Device;
  setDevice(d: Device): void;
  place(tool: ToolId, at: { x: number; y: number }, frameId?: ID): void;
  openShortcuts(): void;
  shortcutsOpen: boolean;
}

/** Every node id at the same level as the current selection (screens + loose shapes, or one screen's children). */
export function selectAllIds(doc: BoardDoc, selected: ID[]): ID[] {
  const parents = new Set(selected.map((id) => doc.elements[id]?.parentId).filter(Boolean));
  const onlyChildren = selected.length > 0 && selected.every((id) => doc.elements[id]?.parentId);
  if (onlyChildren && parents.size === 1) {
    const [parent] = parents;
    return Object.values(doc.elements).filter((e) => e.parentId === parent).map((e) => e.id);
  }
  return [
    ...Object.keys(doc.frames),
    ...Object.values(doc.elements).filter((e) => !e.parentId).map((e) => e.id),
  ];
}

/** Moves the top-level selected items (children whose screen is also selected move with it). */
export function nudgeOp(ids: ID[], dx: number, dy: number) {
  return (doc: BoardDoc): BoardDoc => {
    const set = new Set(ids);
    let next = doc;
    for (const id of ids) {
      const f = doc.frames[id];
      const el = doc.elements[id];
      if (f) next = moveNode(next, id, f.x + dx, f.y + dy);
      else if (el && !(el.parentId && set.has(el.parentId))) next = moveNode(next, id, el.x + dx, el.y + dy);
    }
    return next;
  };
}

export function useEditorKeyboard(opts: EditorKeyboardOptions) {
  const rf = useReactFlow();
  const ref = useRef(opts);
  useEffect(() => { ref.current = opts; });
  const pasteCount = useRef(0);
  const pendingPaste = useRef<number | null>(null);
  const copiedAt = useRef(0);

  useEffect(() => {
    const o = () => ref.current;

    const doCopy = (cut: boolean, e?: ClipboardEvent) => {
      const { api } = o();
      const { nodes, edges } = api.selection;
      const payload = copySelection(api.doc, nodes, edges, api.boardId);
      if (!payload) return false;
      const text = serializeClipboard(payload);
      memoryClipboard = { text, payload };
      pasteCount.current = 0;
      if (e?.clipboardData) {
        e.clipboardData.setData('text/plain', text);
        e.preventDefault();
      } else {
        navigator.clipboard?.writeText?.(text).catch(() => { /* memory fallback */ });
      }
      if (cut && !api.readOnly) {
        deleteSelection(`Cut ${plural(nodes.length + edges.length, 'item')}`);
        api.announce(`Cut ${plural(nodes.length + edges.length, 'item')}`);
      } else api.announce(`Copied ${plural(nodes.length + edges.length, 'item')}`);
      return true;
    };

    const doPaste = (payload: ClipboardPayload | undefined) => {
      const { api, lastPointer } = o();
      if (!payload || api.readOnly) return;
      const sameBoard = payload.sourceBoardId === api.boardId;
      const selFrame = api.selection.nodes.length === 1 ? api.doc.frames[api.selection.nodes[0]] : undefined;
      const onlyElements = payload.frames.length === 0;
      let pasteOpts: Parameters<typeof pastePayload>[2];
      if (sameBoard) {
        pasteCount.current += 1;
        const d = PASTE_OFFSET * pasteCount.current;
        pasteOpts = { offset: { x: d, y: d } };
      } else {
        const r = o().canvasEl.current?.getBoundingClientRect();
        const p = lastPointer.current;
        const over = p && r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
        pasteOpts = { at: over ? api.screenToFlow(p) : api.viewportCenter() };
      }
      if (selFrame && onlyElements) pasteOpts.targetFrameId = selFrame.id;
      let ids: ID[] = [];
      const ok = api.apply((d) => {
        const r = pastePayload(d, payload, pasteOpts);
        ids = r.ids;
        return r.doc;
      }, { label: 'Paste' });
      if (!ok) return;
      api.setSelection(ids);
      api.announce(`Pasted ${plural(ids.length, 'item')}`);
    };

    const deleteSelection = (label?: string) => {
      const { api } = o();
      const { nodes, edges } = api.selection;
      if (!nodes.length && !edges.length) return false;
      const n = nodes.length + edges.length;
      api.apply((d) => edges.reduce((acc, id) => deleteConnector(acc, id), deleteNodes(d, nodes)), { label: label ?? `Delete ${plural(n, 'item')}` });
      api.setSelection([]);
      return true;
    };

    const zoom = (fn: () => unknown) => { void fn(); };

    const onKeyDown = (e: KeyboardEvent) => {
      const { api, shortcutsOpen } = o();
      if (e.defaultPrevented || shortcutsOpen || inOverlay(e.target) || isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const chrome = inChrome(e.target);
      const sel = api.selection;
      const ro = api.readOnly;

      if (mod && !e.altKey) {
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); api.undo(); return; }
        if ((key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey)) { e.preventDefault(); api.redo(); return; }
        if (key === 'a' && !chrome) {
          e.preventDefault();
          const ids = selectAllIds(api.doc, sel.nodes);
          api.setSelection(ids);
          api.announce(`Selected ${plural(ids.length, 'item')}`);
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          if (ro || (!sel.nodes.length && !sel.edges.length)) return;
          let ids: ID[] = [];
          api.apply((d) => { const r = duplicateSelection(d, sel.nodes, sel.edges); ids = r.ids; return r.doc; }, { label: 'Duplicate' });
          api.setSelection(ids);
          api.announce(`Duplicated ${plural(ids.length, 'item')}`);
          return;
        }
        if (key === 'c' || key === 'x') {
          if (chrome || window.getSelection()?.toString()) return;
          // The copy/cut event that follows writes the system clipboard; this covers browsers that skip it.
          copiedAt.current = performance.now();
          doCopy(key === 'x');
          return;
        }
        if (key === 'v') {
          if (chrome) return;
          // Prefer the paste event (system clipboard); fall back to memory if it doesn't arrive.
          if (pendingPaste.current) clearTimeout(pendingPaste.current);
          pendingPaste.current = window.setTimeout(() => {
            pendingPaste.current = null;
            doPaste(memoryClipboard?.payload);
          }, 80);
          return;
        }
        if (key === '=' || key === '+') { e.preventDefault(); zoom(() => rf.zoomIn({ duration: 150 })); return; }
        if (key === '-' || key === '_') { e.preventDefault(); zoom(() => rf.zoomOut({ duration: 150 })); return; }
        if (key === '0') { e.preventDefault(); zoom(() => rf.zoomTo(1, { duration: 150 })); return; }
        if (e.code === 'BracketRight' || e.code === 'BracketLeft') {
          e.preventDefault();
          if (ro || !sel.nodes.length) return;
          const move: ZMove = e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward');
          const labels: Record<ZMove, string> = { front: 'Bring to front', back: 'Send to back', forward: 'Bring forward', backward: 'Send backward' };
          api.apply((d) => reorder(d, sel.nodes, move), { label: labels[move], announce: true });
          return;
        }
        return;
      }
      if (e.altKey && !e.shiftKey) return;

      // Shift+1 / Shift+2 (layout independent).
      if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); api.zoomToFit(); return; }
      if (e.shiftKey && e.code === 'Digit2') { e.preventDefault(); api.zoomToNodes(sel.nodes); return; }
      if (e.key === '?') { e.preventDefault(); o().openShortcuts(); return; }

      if (e.key.startsWith('Arrow') && !chrome) {
        if (!sel.nodes.length || ro) return;
        e.preventDefault();
        e.stopPropagation(); // React Flow would move the focused node itself
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        api.apply(nudgeOp(sel.nodes, dx, dy), { label: 'Nudge', mergeKey: `nudge:${sel.nodes.join(',')}` });
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !chrome) {
        if (ro) return;
        const n = sel.nodes.length + sel.edges.length;
        if (deleteSelection()) { e.preventDefault(); api.announce(`Deleted ${plural(n, 'item')}`); }
        return;
      }
      if (e.key === 'Enter' && !chrome && !ro) {
        if (isPlacementTool(api.tool)) {
          e.preventDefault();
          e.stopPropagation();
          const frame = api.tool !== 'screen' && sel.nodes.length === 1 ? api.doc.frames[sel.nodes[0]] : undefined;
          const at = frame ? { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 } : api.viewportCenter();
          o().place(api.tool, at, frame?.id);
          return;
        }
        if (api.tool === 'arrow' && sel.nodes.length === 2) {
          e.preventDefault();
          e.stopPropagation();
          const [from, to] = sel.nodes;
          let linked = false;
          const ok = api.apply((d) => { const r = connectNodes(d, from, to); linked = !!r.linkId; return r.doc; }, { label: 'Connect' });
          if (ok) { api.announce(linked ? 'Linked to screen' : 'Connected'); api.setTool('select'); }
          return;
        }
        return;
      }
      if (e.key === 'Escape') {
        // React Flow toggles a focused node on Escape; we own Escape on the canvas.
        if ((e.target as HTMLElement | null)?.closest?.('.react-flow__node')) e.stopPropagation();
        if (api.tool !== 'select') { api.setTool('select'); api.announce('Select tool'); return; }
        const only = sel.nodes.length === 1 ? api.doc.elements[sel.nodes[0]] : undefined;
        if (only?.parentId) { api.setSelection([only.parentId]); return; }
        // Always clear: a selection requested a moment ago may not have reached `sel` yet.
        api.setSelection([]);
        if (sel.nodes.length || sel.edges.length) api.announce('Selection cleared');
        return;
      }
      if (e.shiftKey && e.key.length === 1 && e.key !== '?') return;
      if (api.tool === 'screen' && DEVICE_KEYS[e.key] && !e.shiftKey) {
        e.preventDefault();
        o().setDevice(DEVICE_KEYS[e.key]);
        api.announce(`${DEVICE_KEYS[e.key][0].toUpperCase()}${DEVICE_KEYS[e.key].slice(1)} screen`);
        return;
      }
      const t = toolForKey(e);
      if (!t) return;
      if (t === 'insert' || t === 'play') { e.preventDefault(); api.runCommand(t); return; }
      if (ro && t !== 'select' && t !== 'pan') return;
      e.preventDefault();
      api.setTool(t);
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || inOverlay(e.target) || window.getSelection()?.toString()) return;
      // The keydown already copied; just put the same text on the system clipboard.
      if (memoryClipboard && performance.now() - copiedAt.current < 500) {
        e.clipboardData?.setData('text/plain', memoryClipboard.text);
        e.preventDefault();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || inOverlay(e.target) || o().shortcutsOpen) return;
      if (pendingPaste.current) { clearTimeout(pendingPaste.current); pendingPaste.current = null; }
      const text = e.clipboardData?.getData('text/plain');
      const parsed = parseClipboard(text);
      if (parsed) {
        e.preventDefault();
        if (memoryClipboard?.text !== text) pasteCount.current = 0;
        doPaste(parsed);
      } else if (!text) {
        doPaste(memoryClipboard?.payload);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
      if (pendingPaste.current) clearTimeout(pendingPaste.current);
    };
  }, [rf]);
}

