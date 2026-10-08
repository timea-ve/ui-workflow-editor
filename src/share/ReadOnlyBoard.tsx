import { useCallback, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, ReactFlow, applyNodeChanges,
  type NodeChange, type OnSelectionChangeFunc,
} from '@xyflow/react';
import type { BoardDoc, ID } from '../model/types';
import { docToEdges, docToNodes, type FlowNode, type SketchFlowEdge } from '../flow/adapter';
import { FlowViewContext, type FlowViewContextValue } from '../flow/context';
import { ScreenNode } from '../flow/ScreenNode';
import { KitNode } from '../flow/KitNode';
import { LaneNode } from '../flow/LaneNode';
import { SketchEdge } from '../flow/SketchEdge';
import '../flow/flow.css';
import './share.css';

const nodeTypes = { screen: ScreenNode, kit: KitNode, lane: LaneNode };
const edgeTypes = { sketch: SketchEdge };

/**
 * Read-only board for the share view: pan, zoom and select only.
 *
 * INTEGRATION NOTE: built on the same node/edge components and adapter as `FlowCanvas`, with
 * React Flow's editing disabled. Once `FlowCanvas` ships its `readOnly` prop (Canvas Core), this can
 * become `<FlowCanvas doc={doc} view={view} readOnly onSelectionChange={…} />`.
 * Must be rendered inside a <ReactFlowProvider>.
 */
export function ReadOnlyBoard({ doc, view, onSelectionChange }: {
  doc: BoardDoc; view: FlowViewContextValue; onSelectionChange?: (ids: ID[]) => void;
}) {
  const [nodes, setNodes] = useState<FlowNode[]>(() => docToNodes(doc));
  const edges = useMemo<SketchFlowEdge[]>(() => docToEdges(doc), [doc]);

  // Only selection/measurement changes reach here: dragging, connecting and deleting are off.
  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((nds) => applyNodeChanges(changes.filter((c) => c.type === 'select' || c.type === 'dimensions'), nds));
  }, []);

  const onSel: OnSelectionChangeFunc = useCallback(({ nodes: ns }) => {
    onSelectionChange?.(ns.map((n) => n.id));
  }, [onSelectionChange]);

  return (
    <FlowViewContext.Provider value={view}>
      <ReactFlow<FlowNode, SketchFlowEdge>
        className="fs-flow-canvas fs-readonly"
        data-kit-style={view.style}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onSelectionChange={onSel}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable
        deleteKeyCode={null}
        onlyRenderVisibleElements
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        aria-label="Board (view only)"
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--fs-grid-dot)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="var(--fs-faint)" maskColor="rgb(245 245 244 / 0.7)" />
      </ReactFlow>
    </FlowViewContext.Provider>
  );
}
