import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, ConnectionLineType, Controls, MiniMap, ReactFlow,
  applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type OnConnectEnd, type OnSelectionChangeFunc,
} from '@xyflow/react';
import type { Anchor, BoardDoc, ID } from '../model/types';
import { docToEdges, docToNodes, type FlowNode, type SketchFlowEdge } from './adapter';
import { connectNodes, deleteConnector, deleteNodes, moveNode } from './ops';
import { FlowViewContext, type FlowViewContextValue } from './context';
import { ScreenNode } from './ScreenNode';
import { KitNode } from './KitNode';
import { LaneNode } from './LaneNode';
import { SketchEdge } from './SketchEdge';
import './flow.css';

const nodeTypes = { screen: ScreenNode, kit: KitNode, lane: LaneNode };
const edgeTypes = { sketch: SketchEdge };
const SIDES = new Set(['top', 'right', 'bottom', 'left']);
const asAnchor = (h: string | null | undefined): Anchor => (h && SIDES.has(h) ? (h as Anchor) : 'auto');

/** Keep React Flow's per-node UI state (selection, measurements, dragging) when nodes are re-derived from the doc. */
function mergeUiState(next: FlowNode[], prev: FlowNode[]): FlowNode[] {
  const byId = new Map(prev.map((n) => [n.id, n]));
  return next.map((n) => {
    const p = byId.get(n.id);
    return p ? ({ ...n, selected: p.selected, measured: p.measured, dragging: p.dragging } as FlowNode) : n;
  });
}

export interface FlowCanvasProps {
  doc: BoardDoc;
  setDoc: Dispatch<SetStateAction<BoardDoc>>;
  view: FlowViewContextValue;
  onSelectionChange?: (ids: ID[]) => void;
}

/**
 * The board canvas: BoardDoc is the source of truth; React Flow nodes/edges are derived from it.
 * Drags, connections and deletes are written back through the pure ops in ./ops.
 */
export function FlowCanvas({ doc, setDoc, view, onSelectionChange }: FlowCanvasProps) {
  const [nodes, setNodes] = useState<FlowNode[]>(() => docToNodes(doc));
  const [selectedEdges, setSelectedEdges] = useState<Set<ID>>(new Set());
  const [connecting, setConnecting] = useState(false);

  useEffect(() => { setNodes((prev) => mergeUiState(docToNodes(doc), prev)); }, [doc]);

  const edges = useMemo<SketchFlowEdge[]>(
    () => docToEdges(doc).map((e) => (selectedEdges.has(e.id) ? { ...e, selected: true } : e)),
    [doc, selectedEdges],
  );

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    // Deletions go through the cascade ops (onDelete); everything else is UI state.
    setNodes((nds) => applyNodeChanges(changes.filter((c) => c.type !== 'remove'), nds));
    const moves = changes.filter((c) => c.type === 'position' && c.position);
    if (moves.length) {
      setDoc((d) => moves.reduce((acc, c) => (c.type === 'position' && c.position ? moveNode(acc, c.id, c.position.x, c.position.y) : acc), d));
    }
  }, [setDoc]);

  const onEdgesChange = useCallback((changes: EdgeChange<SketchFlowEdge>[]) => {
    setSelectedEdges((prev) => {
      let next = prev;
      for (const c of changes) {
        if (c.type !== 'select') continue;
        if (next === prev) next = new Set(prev);
        if (c.selected) next.add(c.id); else next.delete(c.id);
      }
      return next;
    });
  }, []);

  const onDelete = useCallback(({ nodes: ns, edges: es }: { nodes: FlowNode[]; edges: SketchFlowEdge[] }) => {
    setDoc((d) => es.reduce((acc, e) => deleteConnector(acc, e.id), deleteNodes(d, ns.map((n) => n.id))));
  }, [setDoc]);

  const connect = useCallback((from: ID, to: ID, fromAnchor: Anchor, toAnchor: Anchor) => {
    if (from === to || to.startsWith('lane:') || from.startsWith('lane:')) return;
    setDoc((d) => {
      try { return connectNodes(d, from, to, { fromAnchor, toAnchor }).doc; } catch { return d; }
    });
  }, [setDoc]);

  const onConnect = useCallback((c: Connection) => {
    connect(c.source, c.target, asAnchor(c.sourceHandle), asAnchor(c.targetHandle));
  }, [connect]);

  // Dropping a connection anywhere on a node (not just on a handle) still connects to it.
  const onConnectEnd: OnConnectEnd = useCallback((event, state) => {
    setConnecting(false);
    if (state.isValid || !state.fromNode) return;
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    const hit = document.elementsFromPoint(point.clientX, point.clientY)
      .map((el) => el.closest<HTMLElement>('.react-flow__node'))
      .find((el) => el && el.dataset.id && el.dataset.id !== state.fromNode!.id && !el.dataset.id.startsWith('lane:'));
    if (hit?.dataset.id) connect(state.fromNode.id, hit.dataset.id, asAnchor(state.fromHandle?.id), 'auto');
  }, [connect]);

  const onSel: OnSelectionChangeFunc = useCallback(({ nodes: ns }) => {
    onSelectionChange?.(ns.map((n) => n.id));
  }, [onSelectionChange]);

  return (
    <FlowViewContext.Provider value={view}>
      <ReactFlow<FlowNode, SketchFlowEdge>
        className={`fs-flow-canvas${connecting ? ' fs-connecting' : ''}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDelete={onDelete}
        onConnect={onConnect}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSel}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Step}
        connectionRadius={24}
        onlyRenderVisibleElements
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--fs-grid-dot)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="var(--fs-faint)" maskColor="rgb(245 245 244 / 0.7)" />
      </ReactFlow>
    </FlowViewContext.Provider>
  );
}
