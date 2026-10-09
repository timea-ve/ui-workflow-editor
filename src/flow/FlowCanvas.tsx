import {
  useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type Dispatch, type ReactNode, type Ref, type SetStateAction,
} from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, ConnectionLineType, Controls, MiniMap, ReactFlow, ViewportPortal,
  ReactFlowProvider, applyNodeChanges, useReactFlow, useStore, useStoreApi,
  type Connection, type EdgeChange, type NodeChange, type NodeMouseHandler, type OnConnectEnd, type OnSelectionChangeFunc,
} from '@xyflow/react';
import type { Anchor, BoardDoc, ID } from '../model/types';
import type { ToolId } from '../chrome/tools';
import { reconcileEdges, reconcileNodes, type FlowNode, type SketchFlowEdge } from './adapter';
import { connectNodes, deleteConnector, deleteNodes, moveNode } from './ops';
import { FlowViewContext, type FlowViewContextValue } from './context';
import { ScreenNode } from './ScreenNode';
import { KitNode } from './KitNode';
import { LaneNode } from './LaneNode';
import { SketchEdge } from './SketchEdge';
import { snapBox, unionBox, type Box, type Guide } from '../editor/snap';
import { reparentAfterMove } from '../editor/features/components/ops';
import './flow.css';

const nodeTypes = { screen: ScreenNode, kit: KitNode, lane: LaneNode };
const edgeTypes = { sketch: SketchEdge };
const SIDES = new Set(['top', 'right', 'bottom', 'left']);
const asAnchor = (h: string | null | undefined): Anchor => (h && SIDES.has(h) ? (h as Anchor) : 'auto');
const isLane = (id: string) => id.startsWith('lane:');
const PLACE_TOOLS = new Set<ToolId>(['screen', 'rect', 'diamond', 'ellipse', 'text', 'sticky']);
/** Snap distance in screen pixels. */
const SNAP_PX = 6;
/** Moves land on this grid when no neighbour alignment/spacing wins (resize uses the same 8px). */
const SNAP_GRID = 8;
/** Below this zoom the dot grid is noise; hide it. */
const DOTS_MIN_ZOOM = 0.4;

export type CanvasOp = (doc: BoardDoc) => BoardDoc;
export interface CanvasApplyOptions { label?: string; mergeKey?: string }
export interface CanvasSelection { nodes: ID[]; edges: ID[] }

/** Imperative handle for the editor (selection is React Flow UI state, not document state). */
export interface FlowCanvasHandle {
  select(sel: Partial<CanvasSelection>): void;
  getSelection(): CanvasSelection;
}

export interface FlowCanvasProps {
  doc: BoardDoc;
  /** Simple state wiring (sandbox). The editor passes `apply` instead. */
  setDoc?: Dispatch<SetStateAction<BoardDoc>>;
  view: FlowViewContextValue;
  /** Selected node ids (+ connector ids as second argument). */
  onSelectionChange?: (nodeIds: ID[], connectorIds: ID[]) => void;
  /** Nothing editable; pan / zoom / select still work. Also implied when neither setDoc nor apply is given. */
  readOnly?: boolean;

  // ---- editor wiring (all optional) ----
  /** Undoable writes. Takes precedence over setDoc. */
  apply?: (op: CanvasOp, opts?: CanvasApplyOptions) => void;
  tool?: ToolId;
  /** A placement tool was clicked at `at` (canvas coords); `frameId` = the screen under the pointer. */
  onPlace?: (tool: ToolId, at: { x: number; y: number }, frameId?: ID) => void;
  /** Screen-reader announcements ("Connected"). */
  onAnnounce?: (message: string) => void;
  /** The editor handles Delete/Backspace itself. */
  manageKeyboard?: boolean;
  /** Alignment guides while dragging (default on when editable). Hold Alt to bypass. */
  snapping?: boolean;
  showMiniMap?: boolean;
  showControls?: boolean;
  handle?: Ref<FlowCanvasHandle>;
  className?: string;
  /** Rendered inside React Flow (use ViewportPortal / Panel for overlays). */
  children?: ReactNode;
}

interface DragState { ids: Set<ID>; targets: Box[]; parentOffset: { x: number; y: number }; sizes: Map<ID, { w: number; h: number }> }

/**
 * The board canvas. BoardDoc is the source of truth; React Flow nodes are reconciled from it so that
 * unchanged entities keep their node objects (React Flow and the memoised node views skip them).
 * Drags live in React Flow state and are committed to the doc once, on drop (one undo step).
 */
export function FlowCanvas(props: FlowCanvasProps) {
  // Works standalone (sandbox, share view) or inside the editor's ReactFlowProvider.
  // Called on every render in the same order; it throws (consistently) when there is no provider.
  let hasProvider = true;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  try { useStoreApi(); } catch { hasProvider = false; }
  return hasProvider ? <CanvasInner {...props} /> : <ReactFlowProvider><CanvasInner {...props} /></ReactFlowProvider>;
}

function CanvasInner(props: FlowCanvasProps) {
  const {
    doc, setDoc, view, onSelectionChange, apply, tool = 'select', onPlace, onAnnounce, manageKeyboard,
    showMiniMap = true, showControls = true, handle, className, children,
  } = props;
  const readOnly = props.readOnly || (!apply && !setDoc);
  const snapping = props.snapping ?? !readOnly;
  const rf = useReactFlow<FlowNode, SketchFlowEdge>();
  const storeApi = useStoreApi<FlowNode, SketchFlowEdge>();

  const commit = useCallback((op: CanvasOp, opts?: CanvasApplyOptions) => {
    if (readOnly) return;
    if (apply) apply(op, opts);
    else setDoc?.((d) => op(d));
  }, [apply, setDoc, readOnly]);

  // ---- nodes: reconciled from the doc during render (no extra frame of lag) ----
  const [nodes, setNodes] = useState<FlowNode[]>(() => reconcileNodes(doc));
  const [seenDoc, setSeenDoc] = useState(doc);
  // A selection requested for nodes that don't exist yet (e.g. select right after apply()).
  const pendingSelect = useRef<Set<ID> | null>(null);
  if (seenDoc !== doc) {
    setSeenDoc(doc);
    let next = reconcileNodes(doc, nodes);
    const want = pendingSelect.current;
    if (want) {
      pendingSelect.current = null;
      next = next.map((n) => (!!n.selected === want.has(n.id) ? n : { ...n, selected: want.has(n.id) } as FlowNode));
    }
    setNodes(next);
  }
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const [selectedEdges, setSelectedEdges] = useState<ReadonlySet<ID>>(() => new Set());
  const prevEdges = useRef<SketchFlowEdge[]>([]);
  const edges = useMemo(() => {
    const next = reconcileEdges(doc, prevEdges.current, selectedEdges);
    prevEdges.current = next;
    return next;
  }, [doc, selectedEdges]);

  useImperativeHandle(handle, () => ({
    select: ({ nodes: ns, edges: es }) => {
      const nodeSet = new Set(ns ?? []);
      const known = new Set(nodesRef.current.map((n) => n.id));
      pendingSelect.current = [...nodeSet].some((id) => !known.has(id)) ? nodeSet : null;
      setNodes((cur) => cur.map((n) => (!!n.selected === nodeSet.has(n.id) ? n : { ...n, selected: nodeSet.has(n.id) } as FlowNode)));
      setSelectedEdges(new Set(es ?? []));
    },
    getSelection: () => ({
      nodes: nodesRef.current.filter((n) => n.selected).map((n) => n.id),
      edges: [...selectedEdgesRef.current],
    }),
  }), []);
  const selectedEdgesRef = useRef(selectedEdges);
  selectedEdgesRef.current = selectedEdges;

  // ---- dragging + snapping ----
  const drag = useRef<DragState | null>(null);
  const altDown = useRef(false);
  const [guides, setGuides] = useState<Guide[]>([]);
  useEffect(() => {
    const track = (e: KeyboardEvent | PointerEvent) => { altDown.current = e.altKey; };
    window.addEventListener('keydown', track, true);
    window.addEventListener('keyup', track, true);
    window.addEventListener('pointermove', track, true);
    return () => {
      window.removeEventListener('keydown', track, true);
      window.removeEventListener('keyup', track, true);
      window.removeEventListener('pointermove', track, true);
    };
  }, []);

  const sizeOf = (n: FlowNode) => ({ w: n.measured?.width ?? n.width ?? 0, h: n.measured?.height ?? n.height ?? 0 });

  const onNodeDragStart = useCallback((_e: unknown, node: FlowNode) => {
    const all = nodesRef.current;
    const ids = new Set(all.filter((n) => n.selected || n.id === node.id).map((n) => n.id));
    if (!node.selected) { ids.clear(); ids.add(node.id); }
    const parentId = node.parentId;
    const parent = parentId ? all.find((n) => n.id === parentId) : undefined;
    const sizes = new Map<ID, { w: number; h: number }>();
    for (const n of all) if (ids.has(n.id)) sizes.set(n.id, sizeOf(n));
    const targets: Box[] = all
      .filter((n) => !ids.has(n.id) && n.type !== 'lane' && n.parentId === parentId)
      .map((n) => ({ x: n.position.x, y: n.position.y, ...sizeOf(n) }));
    if (parent) targets.push({ x: 0, y: 0, ...sizeOf(parent) });
    drag.current = { ids, targets, sizes, parentOffset: parent ? { ...parent.position } : { x: 0, y: 0 } };
  }, []);

  const snapChanges = useCallback((moves: Extract<NodeChange<FlowNode>, { type: 'position' }>[], showGuides: boolean) => {
    const d = drag.current;
    if (!d || !snapping || altDown.current) { setGuides((g) => (g.length ? [] : g)); return moves; }
    const boxes = moves.filter((c) => c.position && d.sizes.has(c.id)).map((c) => ({ ...c.position!, ...d.sizes.get(c.id)! }));
    const box = unionBox(boxes);
    if (!box) return moves;
    const zoom = storeApi.getState().transform[2] || 1;
    const r = snapBox(box, d.targets, SNAP_PX / zoom, { grid: SNAP_GRID });
    if (showGuides) {
      setGuides(r.guides.map((g) => ({
        ...g,
        pos: g.pos + (g.axis === 'x' ? d.parentOffset.x : d.parentOffset.y),
        from: g.from + (g.axis === 'x' ? d.parentOffset.y : d.parentOffset.x),
        to: g.to + (g.axis === 'x' ? d.parentOffset.y : d.parentOffset.x),
      })));
    }
    if (!r.dx && !r.dy) return moves;
    return moves.map((c) => (c.position ? { ...c, position: { x: c.position.x + r.dx, y: c.position.y + r.dy } } : c));
  }, [snapping, storeApi]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    // Removals go through the cascade ops; everything else is UI state until a drag ends.
    let rest = changes.filter((c) => c.type !== 'remove' && !(readOnly && c.type === 'position'));
    const moves = rest.filter((c): c is Extract<NodeChange<FlowNode>, { type: 'position' }> => c.type === 'position' && !!c.position);
    let commitMoves: typeof moves = [];
    if (moves.length) {
      const live = moves.filter((c) => c.dragging);
      const done = moves.filter((c) => !c.dragging);
      const others = rest.filter((c) => !(c.type === 'position' && c.position));
      const snappedLive = live.length ? snapChanges(live, true) : [];
      commitMoves = done.length ? snapChanges(done, false) : [];
      rest = [...others, ...snappedLive, ...commitMoves];
      if (done.length) { drag.current = null; setGuides([]); }
    }
    if (rest.length) setNodes((nds) => applyNodeChanges(rest, nds));
    if (commitMoves.length) {
      commit((d) => reparentAfterMove(
        commitMoves.reduce((acc, c) => moveNode(acc, c.id, Math.round(c.position!.x), Math.round(c.position!.y)), d),
        commitMoves.map((c) => c.id)),
        { label: commitMoves.length > 1 ? `Move ${commitMoves.length} items` : 'Move' });
    }
  }, [commit, readOnly, snapChanges]);

  const onEdgesChange = useCallback((changes: EdgeChange<SketchFlowEdge>[]) => {
    setSelectedEdges((prev) => {
      let next: Set<ID> | undefined;
      for (const c of changes) {
        if (c.type !== 'select' || prev.has(c.id) === c.selected) continue;
        next ??= new Set(prev);
        if (c.selected) next.add(c.id); else next.delete(c.id);
      }
      return next ?? prev;
    });
  }, []);

  const onDelete = useCallback(({ nodes: ns, edges: es }: { nodes: FlowNode[]; edges: SketchFlowEdge[] }) => {
    commit((d) => es.reduce((acc, e) => deleteConnector(acc, e.id), deleteNodes(d, ns.map((n) => n.id))), { label: 'Delete' });
  }, [commit]);

  // ---- connecting ----
  const connect = useCallback((from: ID, to: ID, fromAnchor: Anchor = 'auto', toAnchor: Anchor = 'auto') => {
    if (from === to || isLane(to) || isLane(from)) return;
    let linked = false;
    commit((d) => {
      try {
        const r = connectNodes(d, from, to, { fromAnchor, toAnchor });
        linked = !!r.linkId;
        return r.doc;
      } catch { return d; }
    }, { label: 'Connect' });
    onAnnounce?.(linked ? 'Linked to screen' : 'Connected');
  }, [commit, onAnnounce]);

  const [connecting, setConnecting] = useState(false);
  const onConnect = useCallback((c: Connection) => {
    connect(c.source, c.target, asAnchor(c.sourceHandle), asAnchor(c.targetHandle));
  }, [connect]);

  // Dropping a connection anywhere on a node (not just on a handle) still connects to it.
  const onConnectEnd: OnConnectEnd = useCallback((event, state) => {
    setConnecting(false);
    if (state.isValid || !state.fromNode) return;
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    const hit = nodeIdAt(point.clientX, point.clientY, state.fromNode.id);
    if (hit) connect(state.fromNode.id, hit, asAnchor(state.fromHandle?.id), 'auto');
  }, [connect]);

  // Arrow tool: drag from any node to any node.
  const [arrow, setArrow] = useState<{ from: ID; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    if (tool !== 'arrow' || readOnly || e.button !== 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.react-flow__node');
    const from = el?.dataset.id;
    if (!from || isLane(from)) return;
    e.preventDefault();
    e.stopPropagation();
    setArrow({ from, x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    const move = (ev: PointerEvent) => setArrow((a) => (a ? { ...a, x2: ev.clientX, y2: ev.clientY } : a));
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setArrow(null);
      const to = nodeIdAt(ev.clientX, ev.clientY, from);
      if (to) connect(from, to);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [tool, readOnly, connect]);

  // ---- placement tools ----
  const placing = !readOnly && PLACE_TOOLS.has(tool);
  const onPaneClick = useCallback((e: React.MouseEvent) => {
    if (!placing) return;
    onPlace?.(tool, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [placing, onPlace, tool, rf]);
  const onNodeClick: NodeMouseHandler<FlowNode> = useCallback((e, node) => {
    if (!placing) return;
    const frameId = node.type === 'screen' ? node.id : node.type === 'kit' ? node.parentId : undefined;
    onPlace?.(tool, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }), frameId);
  }, [placing, onPlace, tool, rf]);

  const onSel: OnSelectionChangeFunc<FlowNode, SketchFlowEdge> = useCallback(({ nodes: ns, edges: es }) => {
    onSelectionChange?.(ns.map((n) => n.id), es.map((e) => e.id));
  }, [onSelectionChange]);

  const selectMode = tool === 'select';
  const editable = !readOnly && selectMode;
  return (
    <FlowViewContext.Provider value={view}>
      <ReactFlow<FlowNode, SketchFlowEdge>
        className={[
          'fs-flow-canvas', `fs-tool-${tool}`, connecting && 'fs-connecting', readOnly && 'fs-readonly', className,
        ].filter(Boolean).join(' ')}
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
        onNodeDragStart={onNodeDragStart}
        onSelectionDragStart={(e, ns) => ns[0] && onNodeDragStart(e, ns[0])}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onPointerDownCapture={onPointerDownCapture}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={selectMode || readOnly}
        selectionOnDrag={selectMode}
        panOnDrag={tool === 'pan' || readOnly ? true : [1, 2]}
        panOnScroll
        zoomOnPinch
        selectionKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Step}
        connectionRadius={24}
        onlyRenderVisibleElements
        minZoom={0.05}
        maxZoom={4}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        deleteKeyCode={readOnly || manageKeyboard ? null : ['Backspace', 'Delete']}
        proOptions={{ hideAttribution: false }}
      >
        <DotGrid />
        {showControls && <Controls showInteractive={false} />}
        {showMiniMap && <MiniMap pannable zoomable nodeColor="var(--fs-faint)" maskColor="rgb(245 245 244 / 0.7)" />}
        {guides.length > 0 && (
          <ViewportPortal>
            <GuideLines guides={guides} />
          </ViewportPortal>
        )}
        {children}
      </ReactFlow>
      {arrow && (
        <svg className="fs-arrow-preview" aria-hidden>
          <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} />
        </svg>
      )}
    </FlowViewContext.Provider>
  );
}

function DotGrid() {
  const show = useStore((st) => st.transform[2] >= DOTS_MIN_ZOOM);
  return show ? <Background variant={BackgroundVariant.Dots} gap={24} size={1.25} color="var(--fs-grid-dot)" /> : null;
}

function GuideLines({ guides }: { guides: Guide[] }) {
  return (
    <>
      {guides.map((g, i) => (
        <div
          key={i}
          className="fs-guide"
          data-axis={g.axis}
          data-kind={g.kind}
          style={g.axis === 'x'
            ? { transform: `translate(${g.pos}px, ${g.from}px)`, height: g.to - g.from }
            : { transform: `translate(${g.from}px, ${g.pos}px)`, width: g.to - g.from }}
        />
      ))}
    </>
  );
}

/** Topmost connectable node under a screen point (lanes and `exclude` skipped). */
function nodeIdAt(clientX: number, clientY: number, exclude?: ID): ID | undefined {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const id = el.closest<HTMLElement>('.react-flow__node')?.dataset.id;
    if (id && id !== exclude && !isLane(id)) return id;
  }
  return undefined;
}
