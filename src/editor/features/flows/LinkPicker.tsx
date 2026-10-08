// "Link to…" picker: click a screen on the canvas, or choose one from the list (keyboard), or "New screen →".
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link2, Plus, Unlink } from 'lucide-react';
import type { ID } from '../../../model/types';
import { useEditor } from '../../EditorContext';
import { linkOf, linkToNewScreen, retargetLink, unlinkElement } from '../../../flow/ops';
import { kitRegistry } from '../../../kit/registry';
import { frameIdOf } from './flowIndex';

export function elementName(doc: ReturnType<typeof useEditor>['doc'], id: ID): string {
  const el = doc.elements[id];
  if (!el) return 'component';
  const text = el.props.label ?? el.props.text ?? el.props.title;
  const label = kitRegistry.get(el.type)?.label ?? el.type;
  return typeof text === 'string' && text ? `${label} '${text.length > 28 ? `${text.slice(0, 27)}…` : text}'` : label;
}

/** The click that follows a canvas pick must not reach React Flow (it would select the clicked screen). */
function swallowNextClick() {
  const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, true), 400);
}

type Item = { kind: 'new' } | { kind: 'screen'; id: ID; name: string } | { kind: 'unlink' };

export function LinkPicker({ elementId, onClose, keyHandlerRef }: {
  elementId: ID;
  onClose: () => void;
  /** The host routes keydown here (window capture) so the list works wherever focus is. Returns true when handled. */
  keyHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>;
}) {
  const { doc, apply, announce, setSelection, toast, zoomToNodes } = useEditor();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // Browsers fire mousemove when the list appears under a resting pointer; only real movement should move the highlight.
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const ownFrame = frameIdOf(doc, elementId);
  const current = linkOf(doc, elementId);
  const source = elementName(doc, elementId);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const screens = Object.values(doc.frames)
      .filter((f) => f.id !== ownFrame && (!q || f.name.toLowerCase().includes(q)))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((f) => ({ kind: 'screen' as const, id: f.id, name: f.name }));
    return [{ kind: 'new' as const }, ...screens, ...(current ? [{ kind: 'unlink' as const }] : [])];
  }, [doc.frames, ownFrame, query, current]);
  const activeIndex = Math.min(active, items.length - 1);

  const pickRef = useRef<(frameId: ID) => void>(() => {});
  const choose = (item: Item) => {
    if (item.kind === 'new') {
      let frameId: ID | undefined;
      const ok = apply((d) => { const r = linkToNewScreen(d, elementId); frameId = r.frameId; return r.doc; }, { label: 'Link to new screen' });
      onClose();
      if (ok && frameId) {
        setSelection([frameId]);
        const shown = ownFrame ? [ownFrame, frameId] : [frameId];
        requestAnimationFrame(() => zoomToNodes(shown));
        announce(`Linked ${source} to a new screen on the right`);
      }
      return;
    }
    if (item.kind === 'unlink') {
      apply((d) => unlinkElement(d, elementId), { label: 'Remove link' });
      onClose();
      setSelection([elementId]);
      announce(`Removed the link from ${source}`);
      return;
    }
    pick(item.id);
  };
  const pick = (frameId: ID) => {
    if (frameId === ownFrame) { toast('Pick another screen — a component can’t link to its own screen.'); return; }
    const target = doc.frames[frameId];
    if (!target) return;
    apply((d) => retargetLink(d, elementId, frameId), { label: current ? 'Change link' : 'Link to screen' });
    onClose();
    setSelection([elementId]);
    announce(`Linked ${source} to '${target.name}'`);
  };

  useEffect(() => {
    inputRef.current?.focus();
    // The editor may move focus to the selected node right after; take it back once.
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const docRef = useRef(doc);
  const toastRef = useRef(toast);
  const closeRef = useRef(onClose);
  useEffect(() => { docRef.current = doc; toastRef.current = toast; closeRef.current = onClose; pickRef.current = pick; });

  // Canvas pick mode: screens highlight; a click on a screen (or anything inside it) picks it.
  useEffect(() => {
    document.body.classList.add('fs-linking');
    let down: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || rootRef.current?.contains(t) || e.button !== 0) return;
      const node = t.closest<HTMLElement>('.fs-flow-canvas .react-flow__node[data-id]');
      if (node) {
        e.preventDefault();
        e.stopPropagation();
        swallowNextClick();
        const id = node.dataset.id!;
        const frameId = frameIdOf(docRef.current, id);
        if (frameId) pickRef.current(frameId);
        else toastRef.current('Pick a screen — diagram shapes can’t be link targets.');
        return;
      }
      if (t.closest('.fs-flow-canvas .react-flow__pane')) down = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) closeRef.current();
      down = null;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    return () => {
      document.body.classList.remove('fs-linking');
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    };
  }, []);

  const handleKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.key === 'ArrowDown') setActive((i) => Math.min(items.length - 1, Math.min(i, items.length - 1) + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, Math.min(i, items.length - 1) - 1));
    else if (e.key === 'Home' && e.target !== inputRef.current) setActive(0);
    else if (e.key === 'End' && e.target !== inputRef.current) setActive(items.length - 1);
    else if (e.key === 'Enter') { const it = items[activeIndex]; if (it) choose(it); }
    else if (e.key === 'Escape') onClose();
    else {
      // Typing anywhere searches the list.
      if (e.key.length === 1 && e.target !== inputRef.current) inputRef.current?.focus();
      return false;
    }
    return true;
  };
  useEffect(() => { keyHandlerRef.current = handleKey; });
  useEffect(() => () => { keyHandlerRef.current = null; }, [keyHandlerRef]);

  useEffect(() => {
    rootRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const optionId = (i: number) => `${listId}-${i}`;
  return (
    <div ref={rootRef} className="fs-link-picker fsc-root fsc-float" role="dialog" aria-label={`Link ${source} to a screen`}>
      <p className="fs-link-picker__hint">
        <Link2 size={16} strokeWidth={1.75} aria-hidden />
        <span>Click a screen to link <strong>{source}</strong>, or pick one below.</span>
        <kbd className="fsc-kbd">Esc</kbd>
      </p>
      <input
        ref={inputRef}
        className="fsc-input"
        placeholder="Search screens"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={optionId(activeIndex)}
        aria-label="Search screens"
      />
      <ul id={listId} className="fs-link-picker__list" role="listbox" aria-label="Screens">
        {items.map((it, i) => {
          const isCurrent = it.kind === 'screen' && current?.targetFrameId === it.id;
          return (
            <li
              key={it.kind === 'screen' ? it.id : it.kind}
              id={optionId(i)}
              data-index={i}
              role="option"
              aria-selected={i === activeIndex}
              className={`fs-link-picker__item${it.kind === 'unlink' ? ' is-danger' : ''}`}
              onMouseMove={(e) => {
                const p = lastPointer.current;
                lastPointer.current = { x: e.screenX, y: e.screenY };
                if (p && (p.x !== e.screenX || p.y !== e.screenY)) setActive(i);
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(it)}
            >
              {it.kind === 'new' && <><Plus size={16} strokeWidth={1.75} aria-hidden /><span>New screen</span><span className="fs-link-picker__meta">to the right →</span></>}
              {it.kind === 'screen' && <><span className="fs-link-picker__thumb" aria-hidden /><span>{it.name}</span>{isCurrent && <span className="fs-link-picker__meta">Current</span>}</>}
              {it.kind === 'unlink' && <><Unlink size={16} strokeWidth={1.75} aria-hidden /><span>Remove link</span></>}
            </li>
          );
        })}
        {items.length === 1 && query && <li className="fs-link-picker__empty" role="presentation">No screens match “{query}”</li>}
      </ul>
    </div>
  );
}
