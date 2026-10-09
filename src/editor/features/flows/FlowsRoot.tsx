// Always-mounted host for flows features: commands, shortcuts, and the Link picker / Play / Compare overlays.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { ID } from '../../../model/types';
import { useEditor, useEditorCommand } from '../../EditorContext';
import { isTypingTarget } from '../../../chrome/tools';
import { canLinkElement, deleteOption, duplicateFlowAsOption, getStartFrame, renameFlow, renameVariant } from '../../../flow/ops';
import { PlayView, type PlayOption } from '../../../flow/PlayView';
import { frameIdOf, getFlowIndex, targetGroup, type FlowGroup } from './flowIndex';
import { LinkPicker } from './LinkPicker';
import { CompareView } from './CompareView';
import { startEdgeLabelEdit } from './edgeEditing';
import './flows.css';

interface PlayState { groupKey: ID; option: number; startFrameId: ID }

const inOverlay = (t: EventTarget | null) =>
  !!(t as HTMLElement | null)?.closest?.('[role="dialog"], [role="menu"], [role="listbox"], [role="alertdialog"]');

const playOptions = (g: FlowGroup): PlayOption[] =>
  g.options.map((o, i) => ({ id: o.variantId ?? `${g.key}-${i}`, letter: o.letter, label: o.label, frameIds: o.frameIds, startFrameId: o.startFrameId }));

export function FlowsRoot() {
  const api = useEditor();
  const { doc, selection, apply, toast, announce, setSelection, zoomToNodes, readOnly, undo } = api;
  const rf = useReactFlow();
  const [picker, setPicker] = useState<ID | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [compare, setCompare] = useState<ID | null>(null);
  const playKeys = useRef<((e: KeyboardEvent) => void) | null>(null);
  const pickerKeys = useRef<((e: KeyboardEvent) => boolean) | null>(null);

  // ---------- link ----------
  const openLink = useCallback((payload?: unknown) => {
    if (readOnly) return;
    const given = (payload as { elementId?: ID } | undefined)?.elementId;
    const id = given ?? (selection.nodes.length === 1 ? selection.nodes[0] : undefined);
    if (!id) { toast('Select a button or text inside a screen, then press L to link it.'); return; }
    const check = canLinkElement(doc, id);
    if (!check.ok) { toast(check.reason); return; }
    setCompare(null);
    setPicker(id);
  }, [readOnly, selection.nodes, doc, toast]);
  useEditorCommand('link', openLink);

  // ---------- play ----------
  const startPlay = useCallback((payload?: unknown) => {
    const p = (payload ?? {}) as { variantId?: ID; groupKey?: ID };
    const idx = getFlowIndex(doc);
    let group: FlowGroup | undefined;
    let option = 0;
    if (p.variantId) {
      group = idx.groups.find((g) => g.options.some((o) => o.variantId === p.variantId));
      option = Math.max(0, group?.options.findIndex((o) => o.variantId === p.variantId) ?? 0);
    } else if (p.groupKey) {
      group = idx.groupByKey.get(p.groupKey);
    } else {
      group = targetGroup(doc, selection.nodes);
      const f = selection.nodes.map((id) => frameIdOf(doc, id)).find(Boolean);
      const o = f ? idx.optionByFrame.get(f) : undefined;
      if (group && o) option = Math.max(0, group.options.indexOf(o));
    }
    if (!group) { toast('Nothing to play yet. Add a screen with F, then press P.'); return; }
    setPicker(null);
    setCompare(null);
    startEdgeLabelEdit(null);
    setPlay({ groupKey: group.key, option, startFrameId: group.options[option].startFrameId });
  }, [doc, selection.nodes, toast]);
  useEditorCommand('play', startPlay);

  const exitPlay = useCallback((frameId: ID) => {
    setPlay(null);
    const f = doc.frames[frameId];
    if (!f) return;
    setSelection([frameId]);
    rf.setCenter(f.x + f.w / 2, f.y + f.h / 2, { zoom: rf.getZoom() });
    announce(`Back in the editor — '${f.name}' selected`);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.fse-editor .react-flow__node[data-id="${frameId}"]`)?.focus({ preventScroll: true }));
  }, [doc.frames, setSelection, rf, announce]);

  // ---------- compare ----------
  const openCompare = useCallback((payload?: unknown) => {
    const key = (payload as { groupKey?: ID } | undefined)?.groupKey;
    const group = key ? getFlowIndex(doc).groupByKey.get(key) : targetGroup(doc, selection.nodes);
    if (!group || group.options.length < 2) {
      toast('Nothing to compare yet. Press ⇧D to copy this flow as a second option.');
      return;
    }
    setPicker(null);
    setCompare(group.key);
  }, [doc, selection.nodes, toast]);
  useEditorCommand('compare', openCompare);

  // ---------- options ----------
  const duplicateOption = useCallback((payload?: unknown) => {
    if (readOnly) return;
    const p = (payload ?? {}) as { groupKey?: ID; variantId?: ID };
    const idx = getFlowIndex(doc);
    const group = p.groupKey ? idx.groupByKey.get(p.groupKey) : targetGroup(doc, selection.nodes);
    if (!group) { toast('Add a screen first, then press ⇧D to copy its flow as an option.'); return; }
    const f = selection.nodes.map((id) => frameIdOf(doc, id)).find(Boolean);
    const fromSel = f ? idx.optionByFrame.get(f) : undefined;
    const option = (p.variantId && group.options.find((o) => o.variantId === p.variantId))
      || (fromSel && group.options.includes(fromSel) ? fromSel : group.options[0]);
    let created: { frameIds: ID[]; variantId: ID } | undefined;
    const ok = apply((d) => { const r = duplicateFlowAsOption(d, option.frameIds); created = r; return r.doc; }, { label: 'Duplicate as option' });
    if (!ok || !created) return;
    const after = api.store.getDoc();
    const label = after.variants[created.variantId]?.label ?? 'New option';
    const newStart = getStartFrame(after, created.frameIds);
    zoomToNodes([...option.frameIds, ...created.frameIds]);
    if (newStart) setSelection([newStart]);
    announce(`${label} added below ${option.label}`);
  }, [readOnly, doc, selection.nodes, toast, apply, api.store, zoomToNodes, setSelection, announce]);
  useEditorCommand('duplicate-option', duplicateOption);

  const removeOption = useCallback((payload?: unknown) => {
    if (readOnly) return;
    const variantId = (payload as { variantId?: ID } | undefined)?.variantId;
    const v = variantId ? doc.variants[variantId] : undefined;
    if (!v) return;
    if (apply((d) => deleteOption(d, v.id), { label: `Delete ${v.label}` })) {
      toast(`Deleted ${v.label}`, { actionLabel: 'Undo', onAction: undo });
      announce(`Deleted ${v.label} and its screens`);
    }
  }, [readOnly, doc.variants, apply, toast, undo, announce]);
  useEditorCommand('delete-option', removeOption);

  useEditorCommand('rename-option', (payload) => {
    const p = payload as { variantId?: ID; label?: string } | undefined;
    if (readOnly || !p?.variantId || !p.label?.trim()) return;
    apply((d) => renameVariant(d, p.variantId!, p.label!.trim()), { label: 'Rename option', announce: `Renamed to ${p.label.trim()}` });
  });
  useEditorCommand('rename-flow', (payload) => {
    const p = payload as { groupKey?: ID; name?: string } | undefined;
    if (readOnly || !p?.groupKey || p.name === undefined) return;
    apply((d) => renameFlow(d, p.groupKey!, p.name!), { label: 'Rename flow', announce: p.name.trim() ? `Flow renamed to ${p.name.trim()}` : 'Flow name reset' });
  });

  const playGroup = play ? getFlowIndex(doc).groupByKey.get(play.groupKey) : undefined;
  // The picked element was deleted (e.g. undo) → the picker just goes away.
  const pickerFor = picker && doc.elements[picker] ? picker : null;

  // ---------- shortcuts (window capture; registered before the editor's own listener) ----------
  const state = useRef({ api, picker, play, compare, openLink, openCompare, duplicateOption });
  useEffect(() => { state.current = { api, picker: pickerFor, play: play && playGroup ? play : null, compare, openLink, openCompare, duplicateOption }; });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = state.current;
      if (s.play) {
        if (e.key === 'Tab' || ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement)?.closest?.('button'))) {
          e.stopImmediatePropagation();
          return;
        }
        playKeys.current?.(e);
        e.stopImmediatePropagation();
        return;
      }
      if (s.compare) {
        if (e.key === 'Escape') { e.preventDefault(); setCompare(null); }
        if (e.key !== 'Tab') e.stopImmediatePropagation();
        return;
      }
      if (e.defaultPrevented) return;
      if (s.picker) {
        if (pickerKeys.current?.(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
        return;
      }
      if (isTypingTarget(e.target) || inOverlay(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (k === 'l' && !mod && !e.altKey && !e.shiftKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        // React Flow's DOM is the freshest selection (the editor's copy lands a render later).
        const sel = document.querySelectorAll<HTMLElement>('.fse-editor .fs-flow-canvas .react-flow__node.selected[data-id]');
        s.openLink(sel.length === 1 ? { elementId: sel[0].dataset.id } : undefined);
        return;
      }
      if (k === 'c' && e.shiftKey && !mod && !e.altKey) {
        e.preventDefault(); e.stopImmediatePropagation(); s.openCompare(); return;
      }
      if (k === 'd' && e.shiftKey && !e.altKey) {
        e.preventDefault(); e.stopImmediatePropagation(); s.duplicateOption(); return;
      }
      if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
        const sel = s.api.selection;
        const t = e.target as HTMLElement | null;
        const onCanvas = !t || t === document.body || (!!t.closest?.('.fs-flow-canvas') && !t.closest('button, input, a'));
        const focused = t?.closest?.<HTMLElement>('.react-flow__node[data-id], .react-flow__edge[data-id]');
        const elsewhere = !!focused && focused.dataset.id !== sel.edges[0];
        if (onCanvas && !elsewhere && sel.nodes.length === 0 && sel.edges.length === 1 && !s.api.readOnly) {
          e.preventDefault(); e.stopImmediatePropagation(); startEdgeLabelEdit(sel.edges[0]);
        }
      }
    };
    const onDblClick = (e: MouseEvent) => {
      const s = state.current;
      if (s.api.readOnly || s.play || s.compare) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.('.fse-editor .fs-flow-canvas') || t.closest('.fs-compare')) return;
      const edge = t.closest<HTMLElement>('.react-flow__edge[data-id], [data-edge-id]');
      const id = edge?.dataset.id ?? edge?.dataset.edgeId;
      if (!id || !s.api.doc.connectors[id]) return;
      e.preventDefault();
      e.stopPropagation();
      s.api.setSelection({ nodes: [], edges: [id] });
      startEdgeLabelEdit(id);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('dblclick', onDblClick, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('dblclick', onDblClick, true);
    };
  }, []);

  // Keyboard users keep their place: focus goes back to the canvas selection (the linked item, or a new screen).
  const closePicker = useCallback(() => {
    const from = state.current.picker;
    setPicker(null);
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected) return;
      const selected = document.querySelectorAll<HTMLElement>('.fse-editor .fs-flow-canvas .react-flow__node.selected[data-id]');
      const target = selected.length === 1 ? selected[0]
        : from ? document.querySelector<HTMLElement>(`.fse-editor .fs-flow-canvas .react-flow__node[data-id="${from}"]`) : null;
      target?.focus({ preventScroll: true });
    });
  }, []);
  const closeCompare = useCallback(() => setCompare(null), []);

  return (
    <>
      {pickerFor && <LinkPicker key={pickerFor} elementId={pickerFor} onClose={closePicker} keyHandlerRef={pickerKeys} />}
      {compare && <CompareView groupKey={compare} onClose={closeCompare} />}
      {play && playGroup && (
        <PlayView
          key={`${play.groupKey}-${play.startFrameId}`}
          doc={doc}
          startFrameId={play.startFrameId}
          style="clean"
          title={playGroup.name}
          options={playGroup.options.length > 1 ? playOptions(playGroup) : undefined}
          initialOption={play.option}
          onExit={exitPlay}
          keyHandlerRef={playKeys}
        />
      )}
    </>
  );
}
