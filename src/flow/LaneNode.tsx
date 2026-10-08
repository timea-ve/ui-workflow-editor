import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { SketchRect } from '../design/primitives';
import { seedFromId } from '../kit/registry';
import type { LaneFlowNode } from './adapter';
import { useFlowView } from './context';

/** Faint outline around an option's screens, with its label chip on the left. */
export const LaneNode = memo(function LaneNode({ data }: NodeProps<LaneFlowNode>) {
  const { style, onPlayVariant } = useFlowView();
  const { variant, w, h } = data;
  return (
    <div className="fs-lane" style={{ width: w, height: h }}>
      <SketchRect w={w} h={h} radius={16} style={style} seed={seedFromId(variant.id)} stroke="faint" dashed />
      <div className="fs-lane-chip nodrag nopan">
        <span className="fs-lane-chip-label">{variant.label}</span>
        {onPlayVariant && (
          <button type="button" className="fs-lane-play" onClick={() => onPlayVariant(variant.id)} aria-label={`Play ${variant.label}`}>
            ▶ Play
          </button>
        )}
      </div>
    </div>
  );
});
