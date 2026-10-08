import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { DeviceFrame } from '../kit/wireframe/DeviceFrame';
import { seedFromId } from '../kit/registry';
import type { ScreenFlowNode } from './adapter';
import { useFlowView } from './context';
import { SideHandles } from './Handles';

/** A screen on the canvas: device chrome only. Child elements are separate React Flow nodes (parentId). */
export const ScreenNode = memo(function ScreenNode({ data, selected }: NodeProps<ScreenFlowNode>) {
  const { style } = useFlowView();
  const { frame } = data;
  return (
    <div className={`fs-screen-node${selected ? ' is-selected' : ''}`} style={{ width: frame.w, height: frame.h }}>
      <DeviceFrame device={frame.device} w={frame.w} h={frame.h} name={frame.name} style={style} seed={seedFromId(frame.id)} />
      <SideHandles />
    </div>
  );
});
