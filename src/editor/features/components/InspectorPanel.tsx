// Contextual Inspector (rightPanel slot): only rendered while something is selected.
// Screen → name, device, start screen, height. Element → its kit props, W/H, "Link to…".
// Several items → count + align / distribute. Typing merges into one undo step (mergeKey).
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, Link2,
} from 'lucide-react';
import { Inspector, InspectorSection, type InspectorSelection } from '../../../chrome/Inspector';
import { ICON_STROKE } from '../../../chrome/shared';
import { renameFrame } from '../../../flow/ops';
import { kitRegistry } from '../../../kit/registry';
import type { PropField } from '../../../kit/types';
import type { BoardDoc, Device, ID } from '../../../model/types';
import { useEditor, type EditorApi } from '../../EditorContext';
import { focusNode } from './insert';
import {
  alignNodes, distributeNodes, resizeRules, setElementProps, setFrameDevice, setNodeSize, setStartScreen,
  type AlignMode,
} from './ops';

const SCREEN_FIELDS: PropField[] = [
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'device', label: 'Device', kind: 'select', options: ['desktop', 'tablet', 'mobile'] },
  { key: 'isStart', label: 'Start screen', kind: 'boolean' },
];

const ALIGN: { mode: AlignMode; label: string; Icon: typeof AlignStartVertical }[] = [
  { mode: 'left', label: 'Align left', Icon: AlignStartVertical },
  { mode: 'center', label: 'Align centre', Icon: AlignCenterVertical },
  { mode: 'right', label: 'Align right', Icon: AlignEndVertical },
  { mode: 'top', label: 'Align top', Icon: AlignStartHorizontal },
  { mode: 'middle', label: 'Align middle', Icon: AlignCenterHorizontal },
  { mode: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontal },
];

const PANEL_CLASS = 'fs-inspector-panel';

export function InspectorPanel() {
  const api = useEditor();
  const apiRef = useRef(api);
  apiRef.current = api;

  // Esc anywhere in the panel returns focus to the selected node (before the editor clears the selection).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.(`.${PANEL_CLASS}`)) return;
      e.preventDefault();
      e.stopPropagation();
      if (t instanceof HTMLElement) t.blur();
      const id = apiRef.current.selection.nodes[0];
      if (id) focusNode(id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const { doc, selection, readOnly } = api;
  const ids = selection.nodes.filter((id) => doc.frames[id] || doc.elements[id]);
  if (readOnly || !ids.length) return null;
  if (ids.length > 1) return <MultiInspector api={api} ids={ids} />;
  const id = ids[0];
  return doc.frames[id] ? <ScreenInspector key={id} api={api} id={id} /> : <ElementInspector key={id} api={api} id={id} />;
}

function MultiInspector({ api, ids }: { api: EditorApi; ids: ID[] }) {
  const run = (label: string, op: (d: BoardDoc) => BoardDoc) => {
    if (api.apply(op, { label })) api.announce(`${label}: ${ids.length} items`);
    else api.announce(`${label}: nothing to change`);
  };
  return (
    <Inspector selection={null} onChange={() => {}} multiCount={ids.length} landmark={false} className={PANEL_CLASS}>
      <InspectorSection title="Align">
        <div className="fs-inspector-tools" role="group" aria-label="Align">
          {ALIGN.map(({ mode, label, Icon }) => (
            <IconButton key={mode} label={label} onClick={() => run(label, (d) => alignNodes(d, ids, mode))}>
              <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden />
            </IconButton>
          ))}
        </div>
      </InspectorSection>
      <InspectorSection title="Distribute">
        <div className="fs-inspector-tools" role="group" aria-label="Distribute">
          <IconButton label="Distribute horizontally" disabled={ids.length < 3}
            onClick={() => run('Distribute horizontally', (d) => distributeNodes(d, ids, 'horizontal'))}>
            <AlignHorizontalDistributeCenter size={16} strokeWidth={ICON_STROKE} aria-hidden />
          </IconButton>
          <IconButton label="Distribute vertically" disabled={ids.length < 3}
            onClick={() => run('Distribute vertically', (d) => distributeNodes(d, ids, 'vertical'))}>
            <AlignVerticalDistributeCenter size={16} strokeWidth={ICON_STROKE} aria-hidden />
          </IconButton>
        </div>
        {ids.length < 3 && <p className="fs-inspector-note">Select 3 or more items to distribute.</p>}
      </InspectorSection>
    </Inspector>
  );
}

function ScreenInspector({ api, id }: { api: EditorApi; id: ID }) {
  const f = api.doc.frames[id];
  const selection: InspectorSelection = {
    // Headings name the kind of thing, not its content, so they never duplicate text on the canvas.
    kind: 'Screen', title: `${f.device[0].toUpperCase()}${f.device.slice(1)} screen`, fields: SCREEN_FIELDS,
    values: { name: f.name, device: f.device, isStart: !!f.isStart },
  };
  const onChange = (key: string, value: unknown) => {
    if (key === 'name') {
      api.apply((d) => renameFrame(d, id, String(value)), { label: 'Rename screen', mergeKey: `name:${id}` });
    } else if (key === 'device') {
      if (api.apply((d) => setFrameDevice(d, id, value as Device), { label: 'Change device' })) api.announce(`${f.name} is now a ${String(value)} screen`);
    } else if (key === 'isStart') {
      if (api.apply((d) => setStartScreen(d, id, Boolean(value)), { label: value ? 'Set start screen' : 'Unset start screen' })) {
        api.announce(value ? `${f.name} is the start screen` : `${f.name} is no longer the start screen`);
      }
    }
  };
  return (
    <Inspector selection={selection} onChange={onChange} landmark={false} className={PANEL_CLASS}>
      <InspectorSection title="Size">
        <SizeFields api={api} id={id} />
        <p className="fs-inspector-note">Width follows the device. Drag the bottom corners to make a taller, scrolling page.</p>
      </InspectorSection>
    </Inspector>
  );
}

function ElementInspector({ api, id }: { api: EditorApi; id: ID }) {
  const e = api.doc.elements[id];
  const def = kitRegistry.get(e.type);
  const selection: InspectorSelection = {
    kind: def?.category === 'diagram' ? 'Shape' : 'Component',
    title: def?.label ?? e.type,
    fields: def?.editableProps ?? [],
    values: { ...(def?.defaultProps ?? {}), ...e.props },
  };
  const onChange = (key: string, value: unknown) => {
    const field = def?.editableProps.find((x) => x.key === key);
    api.apply((d) => setElementProps(d, id, { [key]: value }), { label: `Edit ${field?.label ?? key}`, mergeKey: `props:${id}:${key}` });
  };
  return (
    <Inspector selection={selection} onChange={onChange} landmark={false} className={PANEL_CLASS}>
      <InspectorSection title="Size">
        <SizeFields api={api} id={id} />
      </InspectorSection>
      {def?.linkable && (
        <InspectorSection title="Prototype">
          <button type="button" className="fsc-btn fs-inspector-link" onClick={() => api.runCommand('link', { elementId: id })}>
            <Link2 size={16} strokeWidth={ICON_STROKE} aria-hidden />
            Link to…
          </button>
        </InspectorSection>
      )}
    </Inspector>
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
    <div className="fs-inspector-size">
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
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
  };
  return (
    <div className="fsc-field fs-inspector-num">
      <label className="fsc-field__label" htmlFor={id} title={title}>{label}<span className="fsc-sr-only"> ({title.toLowerCase()})</span></label>
      <input id={id} className="fsc-input" type="number" inputMode="numeric" min={1} step={8} value={draft} disabled={disabled}
        aria-label={title}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKeyDown} />
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick(): void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="fsc-btn fsc-btn--icon" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
