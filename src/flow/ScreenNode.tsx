import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { DeviceFrame } from '../kit/wireframe/DeviceFrame';
import { seedFromId } from '../kit/registry';
import type { ScreenFlowNode } from './adapter';
import { sameNodeView } from './memo';
import { useFlowView } from './context';
import { SideHandles } from './Handles';
import { ResizeHandles } from '../editor/features/components/ResizeHandles';
import type { Box } from '../editor/features/components/ops';

/** A screen on the canvas: device chrome only. Child elements are separate React Flow nodes (parentId). */
export const ScreenNode = memo(function ScreenNode({ data, selected }: NodeProps<ScreenFlowNode>) {
  const { style } = useFlowView();
  const { frame } = data;
  const [preview, setPreview] = useState<Box | null>(null);
  const w = preview?.w ?? frame.w;
  const h = preview?.h ?? frame.h;
  return (
    <div className={`fs-screen-node${selected ? ' is-selected' : ''}${preview ? ' is-resizing' : ''}`} style={{ width: w, height: h }}>
      <DeviceFrame device={frame.device} w={w} h={h} name={frame.name} style={style} seed={seedFromId(frame.id)} />
      <SideHandles />
      {selected && <ResizeHandles id={frame.id} onPreview={setPreview} />}
    </div>
  );
}, sameNodeView);
