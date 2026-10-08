import { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { KitItemView } from '../kit/KitItemView';
import { kitRegistry, seedFromId } from '../kit/registry';
import { LinkMarker } from '../design/primitives';
import type { Element } from '../model/types';
import type { VisualStyle } from '../kit/types';
import type { KitFlowNode } from './adapter';
import { sameNodeView } from './memo';
import { useFlowView } from './context';
import { SideHandles } from './Handles';
import { ResizeHandles } from '../editor/features/components/ResizeHandles';
import type { Box } from '../editor/features/components/ops';

/** Renders any element via the kit registry; unknown types get a labelled placeholder. */
export function ElementView({ element, style }: { element: Element; style: VisualStyle }) {
  const def = kitRegistry.get(element.type);
  if (!def) return <PlaceholderView element={element} />;
  return <KitItemView def={def} props={element.props} w={element.w} h={element.h} style={style} seed={seedFromId(element.id)} />;
}

function PlaceholderView({ element }: { element: Element }) {
  const text = String(element.props.label ?? element.props.text ?? '');
  return (
    <div className="fs-placeholder" role="img" aria-label={`${element.type} (not available yet)`} style={{ width: element.w, height: element.h }}>
      <span>{element.type}{text ? `: ${text}` : ''}</span>
    </div>
  );
}

export const KitNode = memo(function KitNode({ data, selected }: NodeProps<KitFlowNode>) {
  const { style } = useFlowView();
  const { element: stored, isLinkSource } = data;
  const [preview, setPreview] = useState<Box | null>(null);
  const element = preview ? { ...stored, w: preview.w, h: preview.h } : stored;
  return (
    <div className={`fs-kit-node${selected ? ' is-selected' : ''}${preview ? ' is-resizing' : ''}`}
      style={{ width: element.w, height: element.h, ...(preview ? { transform: `translate(${preview.x - stored.x}px, ${preview.y - stored.y}px)` } : {}) }}>
      <ElementView element={element} style={style} />
      {isLinkSource && <LinkMarker label="Clickable: links to another screen" />}
      <SideHandles />
      {selected && <ResizeHandles id={stored.id} onPreview={setPreview} />}
    </div>
  );
}, sameNodeView);
