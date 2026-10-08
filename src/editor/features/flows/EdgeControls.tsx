// Inline connector label editor + the small toolbar shown on a selected connector.
import { useEffect, useRef, useState } from 'react';
import { EdgeLabelRenderer, EdgeToolbar } from '@xyflow/react';
import { ArrowLeftRight, ArrowRight, CornerDownRight, Minus, MoveRight, Spline, Type } from 'lucide-react';
import type { Connector, ID } from '../../../model/types';
import { useOptionalEditor } from '../../EditorContext';
import { updateConnectorLabel, updateConnectorStyle } from '../../../flow/ops';
import { startEdgeLabelEdit } from './edgeEditing';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const;

export function EdgeLabelEditor({ id, x, y }: { id: ID; x: number; y: number }) {
  const editor = useOptionalEditor();
  const initial = editor?.doc.connectors[id]?.label ?? '';
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  if (!editor || editor.readOnly) return null;
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit && value.trim() !== initial.trim()) {
      editor.apply((d) => updateConnectorLabel(d, id, value.trim()), { label: value.trim() ? 'Edit label' : 'Remove label' });
    }
    startEdgeLabelEdit(null);
    // Keep the connector selected so Enter edits again.
    requestAnimationFrame(() => editor.setSelection({ nodes: [], edges: [id] }));
  };
  return (
    <EdgeLabelRenderer>
      <input
        ref={ref}
        className="fs-edge-label-input nodrag nopan nowheel"
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
        value={value}
        size={Math.max(6, value.length + 1)}
        aria-label="Connector label"
        placeholder="Label"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        }}
        onBlur={() => finish(true)}
      />
    </EdgeLabelRenderer>
  );
}

const ROUTES: { id: Connector['style']; label: string; icon: React.ReactNode }[] = [
  { id: 'straight', label: 'Straight', icon: <MoveRight {...ICON} /> },
  { id: 'step', label: 'Elbow', icon: <CornerDownRight {...ICON} /> },
  { id: 'curved', label: 'Curved', icon: <Spline {...ICON} /> },
];
const HEADS: { id: Connector['arrowheads']; label: string; icon: React.ReactNode }[] = [
  { id: 'end', label: 'Arrow at end', icon: <ArrowRight {...ICON} /> },
  { id: 'both', label: 'Arrows at both ends', icon: <ArrowLeftRight {...ICON} /> },
  { id: 'none', label: 'No arrowheads', icon: <Minus {...ICON} /> },
];

/** Small floating toolbar on a selected connector (editor only). */
export function EdgeTools({ id, x, y }: { id: ID; x: number; y: number }) {
  const editor = useOptionalEditor();
  const c = editor?.doc.connectors[id];
  if (!editor || editor.readOnly || !c) return null;
  const set = (patch: Partial<Pick<Connector, 'style' | 'arrowheads'>>, label: string) =>
    editor.apply((d) => updateConnectorStyle(d, id, patch), { label, announce: label });
  return (
    <EdgeToolbar edgeId={id} x={x} y={y} alignY="bottom" isVisible style={{ paddingBottom: 14 }}>
      <div className="fs-edge-tools fsc-root nodrag nopan" role="toolbar" aria-label="Connector">
        <button type="button" className="fs-edge-tools__btn" onClick={() => startEdgeLabelEdit(id)} aria-label={c.label ? 'Edit label' : 'Add label'} title="Label (Enter)">
          <Type {...ICON} />
        </button>
        <span className="fs-edge-tools__sep" aria-hidden />
        {ROUTES.map((r) => (
          <button key={r.id} type="button" className="fs-edge-tools__btn" aria-pressed={c.style === r.id} aria-label={r.label} title={r.label}
            onClick={() => set({ style: r.id }, `${r.label} connector`)}>
            {r.icon}
          </button>
        ))}
        <span className="fs-edge-tools__sep" aria-hidden />
        {HEADS.map((h) => (
          <button key={h.id} type="button" className="fs-edge-tools__btn" aria-pressed={c.arrowheads === h.id} aria-label={h.label} title={h.label}
            onClick={() => set({ arrowheads: h.id }, h.label)}>
            {h.icon}
          </button>
        ))}
      </div>
    </EdgeToolbar>
  );
}
