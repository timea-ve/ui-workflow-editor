import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { SketchRect } from '../design/primitives';
import { seedFromId } from '../kit/registry';
import type { LaneFlowNode } from './adapter';
import { useFlowView } from './context';
import { useOptionalEditor } from '../editor/EditorContext';

/**
 * Faint outline around an option's screens, with its label chip on the left.
 * In the editor the label renames inline (double-click, or Enter when focused) and Play plays this option.
 */
export const LaneNode = memo(function LaneNode({ data }: NodeProps<LaneFlowNode>) {
  const { style, onPlayVariant } = useFlowView();
  const editor = useOptionalEditor();
  const { variant, w, h } = data;
  const [editing, setEditing] = useState(false);
  const canRename = !!editor && !editor.readOnly;
  const play = onPlayVariant ? () => onPlayVariant(variant.id) : editor ? () => editor.runCommand('play', { variantId: variant.id }) : undefined;
  const commit = (value: string) => {
    setEditing(false);
    const label = value.trim();
    if (label && label !== variant.label) editor?.runCommand('rename-option', { variantId: variant.id, label });
  };
  return (
    <div className="fs-lane" style={{ width: w, height: h }}>
      <SketchRect w={w} h={h} radius={16} style={style} seed={seedFromId(variant.id)} stroke="faint" dashed />
      <div className="fs-lane-chip nodrag nopan" data-variant-id={variant.id}>
        {editing ? (
          <input
            className="fs-lane-input nodrag"
            defaultValue={variant.label}
            aria-label="Option name"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commit(e.currentTarget.value);
              else if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={(e) => commit(e.currentTarget.value)}
          />
        ) : canRename ? (
          <button
            type="button"
            className="fs-lane-chip-label"
            onDoubleClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); e.stopPropagation(); setEditing(true); } }}
            onClick={() => editor?.zoomToNodes(Object.values(editor.doc.frames).filter((f) => f.variantId === variant.id).map((f) => f.id))}
            aria-label={`${variant.label} — click to zoom, double-click or Enter to rename`}
            title="Double-click to rename"
          >
            {variant.label}
          </button>
        ) : (
          <span className="fs-lane-chip-label">{variant.label}</span>
        )}
        {play && !editing && (
          <button type="button" className="fs-lane-play" onClick={play} aria-label={`Play ${variant.label}`}>
            <Play size={12} strokeWidth={2} aria-hidden /> Play
          </button>
        )}
      </div>
    </div>
  );
});
