import type { NodeProps } from '@xyflow/react';

/**
 * Node components render only from `data` + `selected`. Ignoring the rest of NodeProps
 * (absolute position, drag flags, z) means dragging a screen doesn't re-render its children.
 */
export const sameNodeView = (a: Pick<NodeProps, 'data' | 'selected'>, b: Pick<NodeProps, 'data' | 'selected'>) =>
  a.data === b.data && a.selected === b.selected;
