// Left panel: auto-detected flows (renameable) and their options. Collapsed by default to keep the canvas calm.
import { useState } from 'react';
import { ChevronDown, ChevronRight, Columns2, CopyPlus, Pencil, Play, Trash2, Workflow } from 'lucide-react';
import type { ID } from '../../../model/types';
import { Tip } from '../../../chrome';
import { ICON_STROKE } from '../../../chrome/shared';
import { useEditor } from '../../EditorContext';
import { getFlowIndex, frameIdOf, type FlowGroup, type FlowOption } from './flowIndex';

const STORAGE_KEY = 'fs.flowsPanel.open';
const readOpen = () => { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; } };

function InlineName({ value, label, onCommit, onCancel }: { value: string; label: string; onCommit: (v: string) => void; onCancel: () => void }) {
  return (
    <input
      className="fsc-input fs-flows__input"
      defaultValue={value}
      aria-label={label}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); onCommit(e.currentTarget.value); }
        else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      onBlur={(e) => onCommit(e.currentTarget.value)}
    />
  );
}

function OptionRow({ group, option, active }: { group: FlowGroup; option: FlowOption; active: boolean }) {
  const { runCommand, zoomToNodes, setSelection, readOnly } = useEditor();
  const [editing, setEditing] = useState(false);
  const vid = option.variantId;
  return (
    <li className="fs-flows__option" data-active={active || undefined}>
      {editing && vid ? (
        <InlineName
          value={option.label}
          label="Option name"
          onCancel={() => setEditing(false)}
          onCommit={(v) => { setEditing(false); if (v.trim() && v.trim() !== option.label) runCommand('rename-option', { variantId: vid, label: v }); }}
        />
      ) : (
        <button
          type="button"
          className="fs-flows__option-name"
          onClick={() => { zoomToNodes(option.frameIds); setSelection([option.startFrameId]); }}
          onDoubleClick={() => vid && !readOnly && setEditing(true)}
          aria-label={`${option.label} — show on canvas`}
        >
          <span className="fs-flows__letter" aria-hidden>{option.letter}</span>
          <span className="fs-flows__text">{option.label}</span>
        </button>
      )}
      {!editing && (
        <span className="fs-flows__row-actions">
          {vid && !readOnly && (
            <Tip label="Rename option" side="right">
              <button type="button" className="fsc-btn fsc-btn--icon fs-flows__icon" onClick={() => setEditing(true)} aria-label={`Rename ${option.label}`}>
                <Pencil size={14} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            </Tip>
          )}
          <Tip label="Play this option" side="right">
            <button type="button" className="fsc-btn fsc-btn--icon fs-flows__icon" onClick={() => runCommand('play', vid ? { variantId: vid } : { groupKey: group.key })} aria-label={`Play ${option.label}`}>
              <Play size={14} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </Tip>
          {vid && !readOnly && (
            <Tip label="Delete option and its screens" side="right">
              <button type="button" className="fsc-btn fsc-btn--icon fs-flows__icon" onClick={() => runCommand('delete-option', { variantId: vid })} aria-label={`Delete ${option.label}`}>
                <Trash2 size={14} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            </Tip>
          )}
        </span>
      )}
    </li>
  );
}

function FlowItem({ group, activeFrame }: { group: FlowGroup; activeFrame?: ID }) {
  const { runCommand, zoomToNodes, setSelection, readOnly } = useEditor();
  const [editing, setEditing] = useState(false);
  const isActive = !!activeFrame && group.frameIds.includes(activeFrame);
  const canCompare = group.options.length > 1;
  return (
    <li className="fs-flows__flow" data-active={isActive || undefined} data-flow-key={group.key}>
      <div className="fs-flows__flow-head">
        {editing ? (
          <InlineName
            value={group.name}
            label="Flow name"
            onCancel={() => setEditing(false)}
            onCommit={(v) => { setEditing(false); if (v.trim() !== group.name) runCommand('rename-flow', { groupKey: group.key, name: v }); }}
          />
        ) : (
          <button
            type="button"
            className="fs-flows__flow-name"
            onClick={() => { zoomToNodes(group.frameIds); setSelection([group.startFrameId]); }}
            onDoubleClick={() => !readOnly && setEditing(true)}
            aria-label={`${group.name}, ${group.frameIds.length} screens — show on canvas`}
          >
            {group.name}
          </button>
        )}
        {!editing && !readOnly && (
          <Tip label="Rename flow" side="right">
            <button type="button" className="fsc-btn fsc-btn--icon fs-flows__icon" onClick={() => setEditing(true)} aria-label={`Rename ${group.name}`}>
              <Pencil size={14} strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </Tip>
        )}
      </div>
      <ul className="fs-flows__options" aria-label={`Options in ${group.name}`}>
        {group.options.map((o, i) => (
          <OptionRow key={o.variantId ?? i} group={group} option={o} active={!!activeFrame && o.frameIds.includes(activeFrame)} />
        ))}
      </ul>
      <div className="fs-flows__flow-actions">
        {!readOnly && (
          <Tip label="Duplicate as option" shortcut="⇧D" side="right">
            <button type="button" className="fsc-btn fs-flows__small" onClick={() => runCommand('duplicate-option', { groupKey: group.key })} aria-label={`Duplicate ${group.name} as a new option`}>
              <CopyPlus size={14} strokeWidth={ICON_STROKE} aria-hidden /> Option
            </button>
          </Tip>
        )}
        <Tip label={canCompare ? 'Compare options side by side' : 'Add a second option to compare'} shortcut={canCompare ? '⇧C' : undefined} side="right">
          <button
            type="button"
            className="fsc-btn fs-flows__small"
            aria-disabled={!canCompare || undefined}
            onClick={() => canCompare && runCommand('compare', { groupKey: group.key })}
            aria-label={canCompare ? `Compare options of ${group.name}` : `Compare (needs 2 options) – ${group.name}`}
          >
            <Columns2 size={14} strokeWidth={ICON_STROKE} aria-hidden /> Compare
          </button>
        </Tip>
      </div>
    </li>
  );
}

export function FlowsPanel() {
  const { doc, selection } = useEditor();
  const [open, setOpen] = useState(readOpen);
  const toggle = () => setOpen((o) => { try { localStorage.setItem(STORAGE_KEY, o ? '0' : '1'); } catch { /* private mode */ } return !o; });
  const idx = getFlowIndex(doc);
  const flows = idx.listed;
  const activeFrame = selection.nodes.map((id) => frameIdOf(doc, id)).find(Boolean);
  return (
    <section className="fs-flows fsc-root fsc-float" aria-label="Flows">
      <button type="button" className="fs-flows__toggle" aria-expanded={open} onClick={toggle}>
        {open ? <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden /> : <ChevronRight size={14} strokeWidth={ICON_STROKE} aria-hidden />}
        <Workflow size={14} strokeWidth={ICON_STROKE} aria-hidden />
        <span>Flows</span>
        <span className="fs-flows__count" aria-label={`${flows.length} flows`}>{flows.length}</span>
      </button>
      {open && (
        flows.length ? (
          <ul className="fs-flows__list">
            {flows.map((g) => <FlowItem key={g.key} group={g} activeFrame={activeFrame} />)}
          </ul>
        ) : (
          <p className="fs-flows__empty">Link two screens to make a flow. Select a button and press <kbd className="fsc-kbd">L</kbd>.</p>
        )
      )}
    </section>
  );
}
