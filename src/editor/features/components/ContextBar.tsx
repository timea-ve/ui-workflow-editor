// Context bar (canvas slot): a small floating toolbar just above the selection, replacing the old
// right-hand Inspector. One kit element → its options (generated from `editableProps`), Link and a
// "More" popover; a screen → name, device, start screen, Play; several items → align / distribute.
// Hidden while dragging, resizing, panning or editing text. ⌘/Ctrl+. (or Alt+F10) focuses it; Esc
// returns to the canvas. Every change is one undo step (typing merges via mergeKey).
import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { useStore } from '@xyflow/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, ArrowDown, ArrowUp, BringToFront, Check,
  ChevronDown, Copy, Flag, Link2, List, MoreHorizontal, Play, Plus, SendToBack, Trash2, X,
} from 'lucide-react';
import { ICON_STROKE, MOD_KEY } from '../../../chrome/shared';
import { isTypingTarget } from '../../../chrome/tools';
import { deleteNodes, renameFrame } from '../../../flow/ops';
import { KIT_ICON_NAMES, KitIcon } from '../../../kit/icons';
import { kitRegistry } from '../../../kit/registry';
import type { KitItemDef, PropField } from '../../../kit/types';
import { DEVICE_TITLE_H } from '../../../kit/wireframe/DeviceFrame';
import type { BoardDoc, Device, ID } from '../../../model/types';
import { duplicateSelection } from '../../clipboard';
import { useEditor, type EditorApi } from '../../EditorContext';
import { reorder } from '../../zorder';
import { useEditingId } from './bridge';
import { joinItems, splitFields, splitItems } from './contextBarFields';
import { focusNode } from './insert';
import {
  absRect, alignNodes, distributeNodes, resizeRules, setElementProps, setFrameDevice, setNodeSize, setStartScreen,
  type AlignMode,
} from './ops';

const BAR_CLASS = 'fs-ctx-bar';
/** Gap between the bar and the selection, and the margin kept from the canvas edges (screen px). */
const GAP = 10;
const EDGE = 8;
const I = { size: 16, strokeWidth: ICON_STROKE, 'aria-hidden': true } as const;

const ALIGN: { mode: AlignMode; label: string; Icon: typeof AlignStartVertical }[] = [
  { mode: 'left', label: 'Align left', Icon: AlignStartVertical },
  { mode: 'center', label: 'Align centre', Icon: AlignCenterVertical },
  { mode: 'right', label: 'Align right', Icon: AlignEndVertical },
  { mode: 'top', label: 'Align top', Icon: AlignStartHorizontal },
  { mode: 'middle', label: 'Align middle', Icon: AlignCenterHorizontal },
  { mode: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontal },
];

const DEVICES: Device[] = ['mobile', 'tablet', 'desktop'];

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : s);

// ───────────────────────────── root ─────────────────────────────

export function ContextBar() {
  const api = useEditor();
  const apiRef = useRef(api);
  apiRef.current = api;
  const domNode = useStore((s) => s.domNode);
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const vw = useStore((s) => s.width);
  const vh = useStore((s) => s.height);
  const editingId = useEditingId();
  const barRef = useRef<HTMLDivElement>(null);
  const roving = useRef(0);

  // Hide while the pointer is down on the canvas (dragging nodes, resizing, panning, marquee).
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (!domNode) return;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.(`.${BAR_CLASS}`)) return;
      setPressed(true);
    };
    const up = () => setPressed(false);
    domNode.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      domNode.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, [domNode]);

  const focusBar = useCallback(() => {
    const items = barItems(barRef.current);
    const el = items[Math.min(roving.current, items.length - 1)] ?? items[0];
    el?.focus();
    return !!el;
  }, []);

  // ⌘/Ctrl+. or Alt+F10 → into the bar; Esc inside the bar → back to the selected node. Registered on
  // window capture before the editor's own handler (child effects run first), so Esc doesn't clear the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const inBar = !!t?.closest?.(`.${BAR_CLASS}`);
      if (e.key === 'Escape' && inBar) {
        e.preventDefault();
        e.stopPropagation();
        t?.blur();
        const id = apiRef.current.selection.nodes[0];
        if (id) focusNode(id);
        return;
      }
      const shortcut = ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === '.') || (e.altKey && e.key === 'F10');
      if (!shortcut || inBar || (isTypingTarget(e.target) && !t?.closest?.('.react-flow__node'))) return;
      if (focusBar()) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [focusBar]);

  const { doc, selection, readOnly, tool } = api;
  const ids = useMemo(() => selection.nodes.filter((id) => doc.frames[id] || doc.elements[id]), [doc, selection.nodes]);
  const hidden = readOnly || tool !== 'select' || !ids.length || pressed || !!editingId;

  // Anchor: union of the selection (plus a screen's name label above it), in canvas pixels.
  const anchor = useMemo(() => {
    if (hidden) return undefined;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const r = absRect(doc, id);
      if (!r) continue;
      const top = doc.frames[id] ? r.y - DEVICE_TITLE_H : r.y;
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, top); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    }
    if (!Number.isFinite(x0)) return undefined;
    return { left: x0 * zoom + tx, top: y0 * zoom + ty, right: x1 * zoom + tx, bottom: y1 * zoom + ty };
  }, [hidden, ids, doc, zoom, tx, ty]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (w !== size.w || h !== size.h) setSize({ w, h });
  });

  // Roving tabindex: exactly one bar item is tabbable (the last focused one).
  useLayoutEffect(() => {
    const items = barItems(barRef.current);
    roving.current = Math.min(roving.current, Math.max(0, items.length - 1));
    items.forEach((el, i) => el.setAttribute('tabindex', i === roving.current ? '0' : '-1'));
  });

  // Keep the current selection identity: new selection → start roving from the first control.
  const selKey = ids.join(',');
  useEffect(() => { roving.current = 0; }, [selKey]);

  if (hidden || !anchor) return null;

  const visible = anchor.bottom > 0 && anchor.top < vh && anchor.right > 0 && anchor.left < vw;
  const above = anchor.top - GAP - size.h;
  const top = above >= EDGE ? above : Math.min(anchor.bottom + GAP, vh - size.h - EDGE);
  const left = Math.max(EDGE, Math.min((anchor.left + anchor.right) / 2 - size.w / 2, vw - size.w - EDGE));

  const onFocus = (e: ReactFocusEvent) => {
    const i = barItems(barRef.current).indexOf(e.target as HTMLElement);
    if (i >= 0) roving.current = i;
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const t = e.target as HTMLElement;
    const textual = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || textual) return;
    const items = barItems(barRef.current);
    const i = items.indexOf(t);
    if (i < 0) return;
    e.preventDefault();
    const n = items.length;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    items[next].focus();
  };

  const id = ids[0];
  let label: string;
  let body: ReactNode;
  if (ids.length > 1) {
    label = `${ids.length} items options`;
    body = <MultiBar api={api} ids={ids} />;
  } else if (doc.frames[id]) {
    label = 'Screen options';
    body = <ScreenBar key={id} api={api} id={id} />;
  } else {
    const def = kitRegistry.get(doc.elements[id].type);
    label = `${def?.label ?? 'Element'} options`;
    body = def ? <ElementBar key={id} api={api} id={id} def={def} /> : null;
  }

  return (
    <div
      ref={barRef}
      className={`${BAR_CLASS} nodrag nopan nowheel`}
      role="toolbar"
      aria-label={label}
      aria-keyshortcuts="Meta+. Control+. Alt+F10"
      data-placement={above >= EDGE ? 'above' : 'below'}
      style={{ left, top, visibility: visible && size.w ? 'visible' : 'hidden' }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {body}
    </div>
  );
}

function barItems(bar: HTMLElement | null): HTMLElement[] {
  return bar ? [...bar.querySelectorAll<HTMLElement>('[data-ctx-item]')].filter((el) => !(el as HTMLButtonElement).disabled) : [];
}

// ───────────────────────────── variants ─────────────────────────────

function MultiBar({ api, ids }: { api: EditorApi; ids: ID[] }) {
  const run = (label: string, op: (d: BoardDoc) => BoardDoc) => {
    if (api.apply(op, { label })) api.announce(`${label}: ${ids.length} items`);
    else api.announce(`${label}: nothing to change`);
  };
  const few = ids.length < 3;
  return (
    <>
      <span className="fs-ctx-bar__title" aria-hidden>{ids.length} items</span>
      <Sep />
      {ALIGN.map(({ mode, label, Icon }) => (
        <BarButton key={mode} label={label} onClick={() => run(label, (d) => alignNodes(d, ids, mode))}>
          <Icon {...I} />
        </BarButton>
      ))}
      <Sep />
      <BarButton label={few ? 'Distribute horizontally (select 3 or more)' : 'Distribute horizontally'} disabled={few}
        onClick={() => run('Distribute horizontally', (d) => distributeNodes(d, ids, 'horizontal'))}>
        <AlignHorizontalDistributeCenter {...I} />
      </BarButton>
      <BarButton label={few ? 'Distribute vertically (select 3 or more)' : 'Distribute vertically'} disabled={few}
        onClick={() => run('Distribute vertically', (d) => distributeNodes(d, ids, 'vertical'))}>
        <AlignVerticalDistributeCenter {...I} />
      </BarButton>
      <Sep />
      <MoreMenu api={api} ids={ids} />
    </>
  );
}

function ScreenBar({ api, id }: { api: EditorApi; id: ID }) {
  const f = api.doc.frames[id];
  const setDevice = (value: unknown) => {
    const device = String(value);
    if (device === f.device) return;
    if (api.apply((d) => setFrameDevice(d, id, device as Device), { label: 'Change device' })) api.announce(`${f.name} is now a ${device} screen`);
  };
  const toggleStart = () => {
    const v = !f.isStart;
    if (api.apply((d) => setStartScreen(d, id, v), { label: v ? 'Set start screen' : 'Unset start screen' })) {
      api.announce(v ? `${f.name} is the start screen` : `${f.name} is no longer the start screen`);
    }
  };
  return (
    <>
      <BarText label="Name" value={f.name} width={136}
        onChange={(v) => api.apply((d) => renameFrame(d, id, v), { label: 'Rename screen', mergeKey: `name:${id}` })} />
      <Sep />
      <SelectMenu label="Device" value={f.device} options={DEVICES} onChange={setDevice} />
      <BarButton label="Start screen" pressed={!!f.isStart} onClick={toggleStart} text>
        <Flag {...I} /> Start
      </BarButton>
      <Sep />
      <BarButton label="Play this flow" onClick={() => api.runCommand('play')} shortcut="P">
        <Play {...I} />
      </BarButton>
      <MoreMenu api={api} ids={[id]} />
    </>
  );
}

function ElementBar({ api, id, def }: { api: EditorApi; id: ID; def: KitItemDef }) {
  const e = api.doc.elements[id];
  const values = { ...def.defaultProps, ...e.props } as Record<string, unknown>;
  const { inline, more } = useMemo(() => splitFields(def.editableProps), [def]);
  const set = useCallback((field: PropField, value: unknown, opts?: { merge?: boolean }) => {
    api.apply((d) => setElementProps(d, id, { [field.key]: value }), {
      label: `Edit ${field.label}`,
      // Every edit merges per field: typing in a field, or flicking through a dropdown, is one undo step.
      mergeKey: opts?.merge === false ? undefined : `props:${id}:${field.key}`,
    });
  }, [api, id]);
  return (
    <>
      <span className="fs-ctx-bar__title" aria-hidden>{def.label}</span>
      {inline.length > 0 && <Sep />}
      {inline.map((f) => <FieldControl key={f.key} field={withItemOptions(f, values)} value={values[f.key]} onChange={(v, o) => set(f, v, o)} />)}
      {def.linkable && (
        <>
          <Sep />
          <BarButton label="Link to a screen" shortcut="L" onClick={() => api.runCommand('link', { elementId: id })}>
            <Link2 {...I} />
          </BarButton>
        </>
      )}
      <MoreMenu api={api} ids={[id]}>
        {more.map((f) => <FormField key={f.key} field={withItemOptions(f, values)} value={values[f.key]} onChange={(v, o) => set(f, v, o)} />)}
      </MoreMenu>
    </>
  );
}

// ───────────────────────────── fields ─────────────────────────────

type OnChange = (value: unknown, opts?: { merge?: boolean }) => void;
type BarField = PropField & { itemLabels?: string[] };

/** Index fields (`itemsFrom`) pick from the element's own item names instead of a 0-based number. */
function withItemOptions(field: PropField, values: Record<string, unknown>): BarField {
  if (field.kind !== 'number' || !field.itemsFrom) return field;
  const labels = splitItems(values[field.itemsFrom]);
  return labels.length ? { ...field, itemLabels: labels } : field;
}

function IndexMenu({ field, value, onChange }: { field: BarField; value: unknown; onChange: OnChange }) {
  const labels = field.itemLabels ?? [];
  const options = labels.map((_, i) => String(i));
  return (
    <SelectMenu label={field.label} value={String(value ?? 0)} options={options}
      display={(o) => labels[Number(o)] ?? o} onChange={(v) => onChange(Number(v), { merge: false })} />
  );
}

/** A field rendered compactly on the bar. */
function FieldControl({ field, value, onChange }: { field: BarField; value: unknown; onChange: OnChange }) {
  if (field.itemLabels) return <IndexMenu field={field} value={value} onChange={onChange} />;
  switch (field.kind) {
    case 'select':
      return <SelectMenu label={field.label} value={String(value ?? '')} options={field.options ?? []} onChange={onChange} />;
    case 'boolean':
      return <BarButton label={field.label} pressed={!!value} onClick={() => onChange(!value, { merge: false })} text>{field.label}</BarButton>;
    case 'icon':
      return <IconPicker label={field.label} value={String(value ?? '')} onChange={onChange} />;
    case 'items':
      return <ItemsEditor label={field.label} value={value} onChange={onChange} />;
    case 'number':
      return <BarNumber label={field.label} value={Number(value ?? 0)} onChange={onChange} />;
    default:
      return <BarText label={field.label} value={String(value ?? '')} onChange={onChange} />;
  }
}

/** A field rendered as a labelled form row inside "More". */
function FormField({ field, value, onChange }: { field: BarField; value: unknown; onChange: OnChange }) {
  const id = useId();
  if (field.itemLabels) {
    return <div className="fs-ctx-form__row"><span className="fsc-field__label">{field.label}</span><IndexMenu field={field} value={value} onChange={onChange} /></div>;
  }
  const v = value ?? '';
  let control: ReactNode;
  switch (field.kind) {
    case 'multiline':
      control = <textarea id={id} className="fsc-textarea" rows={3} value={String(v)} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'number':
      control = <input id={id} className="fsc-input" type="number" value={String(v)} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />;
      break;
    case 'boolean':
      return (
        <label className="fs-ctx-form__check">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked, { merge: false })} /> {field.label}
        </label>
      );
    case 'select':
      control = (
        <select id={id} className="fsc-select" value={String(v)} onChange={(e) => onChange(e.target.value, { merge: false })}>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{cap(o)}</option>)}
        </select>
      );
      break;
    case 'icon':
      return <div className="fs-ctx-form__row"><span className="fsc-field__label">{field.label}</span><IconPicker label={field.label} value={String(v)} onChange={onChange} /></div>;
    case 'items':
      return <div className="fs-ctx-form__row"><span className="fsc-field__label">{field.label}</span><ItemsEditor label={field.label} value={value} onChange={onChange} /></div>;
    default:
      control = <input id={id} className="fsc-input" type="text" value={String(v)} onChange={(e) => onChange(e.target.value)} spellCheck={false} />;
  }
  return (
    <div className="fsc-field">
      <label className="fsc-field__label" htmlFor={id}>{field.label}</label>
      {control}
    </div>
  );
}

function SelectMenu({ label, value, options, onChange, display = cap }: {
  label: string; value: string; options: string[]; onChange: OnChange; display?: (o: string) => string;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="fs-ctx-bar__btn fs-ctx-bar__select" data-ctx-item aria-label={`${label}: ${display(value)}`} title={label}>
          <span>{display(value) || label}</span>
          <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="fsc-float fsc-menu fsc-root fs-ctx-menu" sideOffset={6} align="start" aria-label={label}>
          <DropdownMenu.Label className="fs-ctx-menu__label">{label}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v)}>
            {options.map((o) => (
              <DropdownMenu.RadioItem key={o} value={o} className="fsc-menu__item">
                <span className="fsc-menu__label">{display(o)}</span>
                <DropdownMenu.ItemIndicator><Check size={14} strokeWidth={ICON_STROKE} aria-hidden /></DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Text input on the bar: edits live (merged into one undo step per field by the caller's mergeKey). */
function BarText({ label, value, onChange, width = 120 }: { label: string; value: string; onChange(v: string): void; width?: number }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return (
    <input
      className="fs-ctx-bar__input" data-ctx-item type="text" aria-label={label} title={label} value={draft}
      style={{ width }} spellCheck={false}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setDraft(value); }}
      onChange={(e) => { setDraft(e.target.value); if (e.target.value.trim()) onChange(e.target.value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
    />
  );
}

function BarNumber({ label, value, onChange }: { label: string; value: number; onChange: OnChange }) {
  const id = useId();
  return (
    <span className="fs-ctx-bar__num">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="fs-ctx-bar__input" data-ctx-item type="number" value={value} style={{ width: 48 }}
        onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
    </span>
  );
}

// ───────────────────────────── icon picker ─────────────────────────────

const ICON_COLS = 8;

function IconPicker({ label, value, onChange }: { label: string; value: string; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const names = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? KIT_ICON_NAMES.filter((n) => n.includes(s) || n.replace(/-/g, ' ').includes(s)) : KIT_ICON_NAMES;
  }, [q]);
  const choose = (n: string) => { onChange(n, { merge: false }); setOpen(false); };
  const onGridKey = (e: ReactKeyboardEvent) => {
    const btns = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = btns.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: ICON_COLS, ArrowUp: -ICON_COLS } as Record<string, number>;
    if (!(e.key in d)) return;
    e.preventDefault();
    const j = i + d[e.key];
    if (j < 0) { gridRef.current?.closest('.fs-ctx-pop')?.querySelector<HTMLInputElement>('input')?.focus(); return; }
    btns[Math.min(j, btns.length - 1)]?.focus();
  };
  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setQ(''); }}>
      <Popover.Trigger asChild>
        <button type="button" className="fs-ctx-bar__btn" data-ctx-item aria-label={`${label}: ${cap(value)}`} title={label}>
          <KitIcon name={value} size={16} strokeWidth={ICON_STROKE} />
          <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="fsc-float fsc-root fs-ctx-pop fs-ctx-icons" sideOffset={6} align="start" aria-label={`Choose ${label.toLowerCase()}`}>
          <input className="fsc-input" type="search" placeholder="Search icons…" aria-label="Search icons" value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); gridRef.current?.querySelector('button')?.focus(); }
              if (e.key === 'Enter' && names[0]) { e.preventDefault(); choose(names[0]); }
            }} />
          {names.length ? (
            <div ref={gridRef} className="fs-ctx-icons__grid" role="group" aria-label="Icons" onKeyDown={onGridKey}>
              {names.map((n) => (
                <button key={n} type="button" className="fs-ctx-bar__btn" aria-label={cap(n)} title={cap(n)} aria-pressed={n === value}
                  onClick={() => choose(n)}>
                  <KitIcon name={n} size={18} strokeWidth={ICON_STROKE} />
                </button>
              ))}
            </div>
          ) : <p className="fs-ctx-pop__note" role="status">No icon matches “{q}”.</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ───────────────────────────── list editor ─────────────────────────────

function ItemsEditor({ label, value, onChange }: { label: string; value: unknown; onChange: OnChange }) {
  const stored = String(value ?? '');
  const [rows, setRows] = useState(() => splitItems(stored));
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // Re-sync when the doc changes from elsewhere (undo, remote), keeping blank rows the user just added.
  useEffect(() => {
    setRows((cur) => (joinItems(cur) === joinItems(splitItems(stored)) ? cur : splitItems(stored)));
  }, [stored]);
  useEffect(() => {
    if (focusRow === null) return;
    listRef.current?.querySelectorAll<HTMLInputElement>('input')[focusRow]?.focus();
    setFocusRow(null);
  }, [focusRow, rows]);

  const commit = (next: string[], merge = true) => {
    setRows(next);
    const v = joinItems(next);
    if (v !== joinItems(splitItems(stored))) onChange(v, { merge });
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next, false);
    setFocusRow(j);
  };
  const remove = (i: number) => {
    const next = rows.filter((_, k) => k !== i);
    commit(next, false);
    setFocusRow(Math.max(0, i - 1));
  };
  const add = (at = rows.length) => {
    const next = [...rows];
    next.splice(at, 0, '');
    setRows(next);
    setFocusRow(at);
  };
  const onRowKey = (e: ReactKeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(i, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (!e.altKey && e.key === 'ArrowUp' && i > 0) { e.preventDefault(); setFocusRow(i - 1); return; }
    if (!e.altKey && e.key === 'ArrowDown' && i < rows.length - 1) { e.preventDefault(); setFocusRow(i + 1); return; }
    if (e.key === 'Enter') { e.preventDefault(); add(i + 1); return; }
    if (e.key === 'Backspace' && rows[i] === '' && rows.length > 1) { e.preventDefault(); remove(i); }
  };
  const count = splitItems(stored).length;
  return (
    <Popover.Root onOpenChange={(o) => { if (!o) setRows(splitItems(stored)); }}>
      <Popover.Trigger asChild>
        <button type="button" className="fs-ctx-bar__btn" data-ctx-item aria-label={`Edit ${label.toLowerCase()} (${count})`} title={`Edit ${label.toLowerCase()}`}>
          <List {...I} /> {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="fsc-float fsc-root fs-ctx-pop fs-ctx-items" sideOffset={6} align="start" aria-label={label}
          onOpenAutoFocus={(e) => { e.preventDefault(); setFocusRow(0); }}>
          <div className="fs-ctx-pop__head">{label}</div>
          <ol ref={listRef} className="fs-ctx-items__list">
            {rows.map((r, i) => (
              <li key={i} className="fs-ctx-items__row">
                <input className="fsc-input" type="text" value={r} aria-label={`${label} ${i + 1}`} spellCheck={false}
                  onChange={(e) => commit(rows.map((x, k) => (k === i ? e.target.value : x)))}
                  onKeyDown={(e) => onRowKey(e, i)} />
                <button type="button" className="fs-ctx-bar__btn" aria-label={`Move ${r || 'item'} up`} title="Move up (Alt ↑)" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} strokeWidth={ICON_STROKE} aria-hidden /></button>
                <button type="button" className="fs-ctx-bar__btn" aria-label={`Move ${r || 'item'} down`} title="Move down (Alt ↓)" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} strokeWidth={ICON_STROKE} aria-hidden /></button>
                <button type="button" className="fs-ctx-bar__btn" aria-label={`Remove ${r || 'item'}`} title="Remove" disabled={rows.length <= 1} onClick={() => remove(i)}><X size={14} strokeWidth={ICON_STROKE} aria-hidden /></button>
              </li>
            ))}
          </ol>
          <button type="button" className="fs-ctx-bar__btn fs-ctx-items__add" onClick={() => add()}>
            <Plus {...I} /> Add item
          </button>
          <p className="fs-ctx-pop__note">Enter adds a row · Alt ↑↓ reorders</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ───────────────────────────── More ─────────────────────────────

/** "More" popover: secondary fields, size, and arrange actions (duplicate / order / delete). */
function MoreMenu({ api, ids, children }: { api: EditorApi; ids: ID[]; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const single = ids.length === 1 ? ids[0] : undefined;
  const act = (fn: () => void) => () => { setOpen(false); fn(); };
  const duplicate = () => {
    let out: ID[] = [];
    if (!api.apply((d) => { const r = duplicateSelection(d, ids); out = r.ids; return r.doc; }, { label: 'Duplicate' })) return;
    api.setSelection(out);
    api.announce(`Duplicated ${ids.length === 1 ? '1 item' : `${ids.length} items`}`);
  };
  const arrange = (move: 'forward' | 'backward', label: string) => api.apply((d) => reorder(d, ids, move), { label, announce: true });
  const remove = () => {
    api.apply((d) => deleteNodes(d, ids), { label: ids.length === 1 ? 'Delete 1 item' : `Delete ${ids.length} items` });
    api.setSelection([]);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="fs-ctx-bar__btn" data-ctx-item aria-label="More options" title="More options">
          <MoreHorizontal {...I} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="fsc-float fsc-root fs-ctx-pop fs-ctx-more" sideOffset={6} align="end" aria-label="More options">
          {(children || single) && (
            <div className="fs-ctx-form">
              {children}
              {single && <SizeFields api={api} id={single} />}
            </div>
          )}
          <div className="fs-ctx-actions" role="group" aria-label="Arrange">
            <ActionButton icon={<Copy {...I} />} label="Duplicate" shortcut={`${MOD_KEY}D`} onClick={act(duplicate)} />
            <ActionButton icon={<BringToFront {...I} />} label="Bring forward" shortcut={`${MOD_KEY}]`} onClick={act(() => arrange('forward', 'Bring forward'))} />
            <ActionButton icon={<SendToBack {...I} />} label="Send backward" shortcut={`${MOD_KEY}[`} onClick={act(() => arrange('backward', 'Send backward'))} />
            <ActionButton icon={<Trash2 {...I} />} label="Delete" shortcut="Del" onClick={act(remove)} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ActionButton({ icon, label, shortcut, onClick }: { icon: ReactNode; label: string; shortcut: string; onClick(): void }) {
  return (
    <button type="button" className="fs-ctx-actions__btn" onClick={onClick}>
      {icon}<span className="fs-ctx-actions__label">{label}</span><span className="fsc-menu__shortcut">{shortcut}</span>
    </button>
  );
}

function SizeFields({ api, id }: { api: EditorApi; id: ID }) {
  const node = api.doc.frames[id] ?? api.doc.elements[id];
  const rules = resizeRules(api.doc, id);
  const horiz = rules?.axes === 'both' || rules?.axes === 'horizontal';
  const vert = rules?.axes === 'both' || rules?.axes === 'vertical';
  const commit = (key: 'w' | 'h', v: number) => {
    if (api.apply((d) => setNodeSize(d, id, { [key]: v }), { label: 'Resize' })) {
      const n = api.store.getDoc().frames[id] ?? api.store.getDoc().elements[id];
      if (n) api.announce(`Size ${n.w} × ${n.h}`);
    }
  };
  return (
    <div className="fs-ctx-form__size">
      <NumberField label="W" title="Width" value={node.w} disabled={!horiz} onCommit={(v) => commit('w', v)} />
      <NumberField label="H" title="Height" value={node.h} disabled={!vert} onCommit={(v) => commit('h', v)} />
    </div>
  );
}

/** Number input with a local draft: commits once on Enter or blur (one undo step). */
function NumberField({ label, title, value, disabled, onCommit }: {
  label: string; title: string; value: number; disabled?: boolean; onCommit(v: number): void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n) || n === value) { setDraft(String(value)); return; }
    onCommit(n);
  };
  return (
    <div className="fsc-field">
      <label className="fsc-field__label" htmlFor={id} title={title}>{label}</label>
      <input id={id} className="fsc-input" type="number" inputMode="numeric" min={1} step={8} value={draft} disabled={disabled}
        aria-label={title}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
    </div>
  );
}

// ───────────────────────────── primitives ─────────────────────────────

function BarButton({ label, onClick, disabled, pressed, text, shortcut, children }: {
  label: string; onClick(): void; disabled?: boolean; pressed?: boolean; text?: boolean; shortcut?: string; children: ReactNode;
}) {
  return (
    <button
      type="button" className={`fs-ctx-bar__btn${text ? ' fs-ctx-bar__btn--text' : ''}`} data-ctx-item
      aria-label={label} title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={pressed === undefined ? undefined : pressed} aria-keyshortcuts={shortcut}
      disabled={disabled} onClick={onClick}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="fs-ctx-bar__sep" aria-hidden />;
