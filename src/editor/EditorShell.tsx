// The board editor: layout (top bar, toolbar, canvas, named slots), the Editor API context, tools,
// clipboard, z-order and keyboard shortcuts. Document state lives in a BoardStore (Yjs).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { AlertTriangle, Keyboard } from 'lucide-react';
import { Announcer, ChromeProvider, CoachMark, Tip, Toasts, Toolbar, TopBar, type SaveStatus, type ToastMessage } from '../chrome';
import { ICON_STROKE } from '../chrome/shared';
import type { ToolAction, ToolId } from '../chrome/tools';
import { FlowCanvas, type FlowCanvasHandle } from '../flow/FlowCanvas';
import type { FlowViewContextValue } from '../flow/context';
import type { FlowNode, SketchFlowEdge } from '../flow/adapter';
import type { Device, ID } from '../model/types';
import type { BoardStore } from '../store/boardStore';
import {
  CommandContext, CommandRegistry, EditorContext,
  type EditorApi, type EditorApplyOptions, type EditorExtension, type EditorSelection, type EditorSlotName, type DocOp,
} from './EditorContext';
import { EDITOR_EXTENSIONS } from './extensions';
import { isPlacementTool, placeScreen, placeShape } from './placement';
import { ShortcutsDialog } from './ShortcutsDialog';
import { FirstRunTour } from './tour/FirstRunTour';
import { markTourSeen, shouldAutoShowTour } from './tour/tourState';
import { useEditorKeyboard } from './useEditorKeyboard';
import './editor.css';

const EMPTY_SEL: EditorSelection = { nodes: [], edges: [] };
const sameIds = (a: ID[], b: ID[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export type EditorSlots = Partial<Record<EditorSlotName, ReactNode>>;

export interface EditorShellProps {
  boardId: ID;
  store: BoardStore;
  title: string;
  onTitleChange?: (title: string) => void;
  saveStatus: SaveStatus;
  readOnly?: boolean;
  /** Left of the title (e.g. back to dashboard). */
  leading?: ReactNode;
  /** Extra slot content (in addition to EDITOR_EXTENSIONS). */
  slots?: EditorSlots;
  extensions?: EditorExtension[];
}

export function EditorShell(props: EditorShellProps) {
  return (
    <ReactFlowProvider>
      <ChromeProvider>
        <EditorInner {...props} />
      </ChromeProvider>
    </ReactFlowProvider>
  );
}

function EditorInner({
  boardId, store, title, onTitleChange, saveStatus, readOnly = false, leading, slots, extensions = EDITOR_EXTENSIONS,
}: EditorShellProps) {
  const doc = useSyncExternalStore(store.subscribe, store.getDoc);
  const rf = useReactFlow<FlowNode, SketchFlowEdge>();
  const canvasRef = useRef<FlowCanvasHandle>(null);
  const canvasEl = useRef<HTMLDivElement>(null);
  const [tool, setToolState] = useState<ToolId>('select');
  const [device, setDevice] = useState<Device>('desktop');
  const [selection, setSelectionState] = useState<EditorSelection>(EMPTY_SEL);
  const [announcement, setAnnouncement] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // First-run tour: shown by itself once (see tour/tourState.ts), re-openable from the shortcuts dialog.
  const [tour, setTour] = useState<{ run: number; focus: boolean } | null>(() => (!readOnly && shouldAutoShowTour() ? { run: 0, focus: false } : null));
  useEffect(() => { if (tour) markTourSeen(); }, [tour]);
  const closeTour = useCallback(() => setTour(null), []);
  const openTour = useCallback(() => {
    setShortcutsOpen(false);
    setTour((t) => ({ run: (t?.run ?? 0) + 1, focus: true }));
  }, []);
  const storageTrouble = useLasting(saveStatus === 'error', 3000);
  const commands = useMemo(() => new CommandRegistry(), []);

  const announce = useCallback((message: string) => {
    // Re-announce identical messages by toggling a zero-width suffix.
    setAnnouncement((prev) => (prev === message ? `${message}\u200b` : message));
  }, []);
  const toast = useCallback((message: string, opts: { actionLabel?: string; onAction?: () => void } = {}) => {
    setToasts((t) => [...t.slice(-2), { id: `${Date.now()}-${Math.random()}`, message, ...opts }]);
  }, []);

  const apply = useCallback((op: DocOp, opts: EditorApplyOptions = {}) => {
    if (readOnly) return false;
    const changed = store.apply(op, { label: opts.label, mergeKey: opts.mergeKey });
    if (changed && opts.announce) announce(typeof opts.announce === 'string' ? opts.announce : opts.label ?? 'Changed');
    return changed;
  }, [store, readOnly, announce]);

  const undo = useCallback(() => {
    if (readOnly) return;
    const label = store.undo();
    announce(label ? `Undone: ${label}` : 'Nothing to undo');
  }, [store, readOnly, announce]);
  const redo = useCallback(() => {
    if (readOnly) return;
    const label = store.redo();
    announce(label ? `Redone: ${label}` : 'Nothing to redo');
  }, [store, readOnly, announce]);

  const setSelection = useCallback((sel: ID[] | Partial<EditorSelection>) => {
    const next = Array.isArray(sel) ? { nodes: sel, edges: [] } : { nodes: sel.nodes ?? [], edges: sel.edges ?? [] };
    canvasRef.current?.select(next);
  }, []);
  const onSelectionChange = useCallback((nodes: ID[], edges: ID[]) => {
    setSelectionState((prev) => (sameIds(prev.nodes, nodes) && sameIds(prev.edges, edges) ? prev : { nodes, edges }));
  }, []);

  const setTool = useCallback((t: ToolId) => {
    setToolState(t);
    if (t !== 'select' && t !== 'pan') announce(`${t === 'screen' ? 'Screen' : t[0].toUpperCase() + t.slice(1)} tool`);
  }, [announce]);

  const viewportCenter = useCallback(() => {
    const r = canvasEl.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [rf]);

  const runCommand = useCallback((name: string, payload?: unknown) => {
    if (!commands.run(name, payload)) toast(`${name[0].toUpperCase()}${name.slice(1)} is coming soon.`);
  }, [commands, toast]);

  const api: EditorApi = useMemo(() => ({
    boardId, doc, readOnly, apply, undo, redo,
    canUndo: store.canUndo(), canRedo: store.canRedo(),
    selection, setSelection, tool, setTool,
    screenToFlow: (p) => rf.screenToFlowPosition(p),
    flowToScreen: (p) => rf.flowToScreenPosition(p),
    viewportCenter,
    zoomToFit: () => { void rf.fitView({ padding: 0.15, duration: 200, maxZoom: 1 }); },
    zoomToNodes: (ids) => { if (ids.length) void rf.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.25, duration: 200, maxZoom: 2 }); },
    announce, toast, runCommand, store,
  }), [boardId, doc, readOnly, apply, undo, redo, store, selection, setSelection, tool, setTool, rf, viewportCenter, announce, toast, runCommand]);

  const place = useCallback((t: ToolId, at: { x: number; y: number }, frameId?: ID) => {
    if (readOnly || !isPlacementTool(t)) return;
    const cur = store.getDoc();
    const placed = t === 'screen' ? placeScreen(cur, at, device) : placeShape(cur, t, at, frameId);
    apply(() => placed.doc, { label: `Add ${placed.label.replace(/ added$/, '')}` });
    setToolState('select');
    setSelection([placed.id]);
    announce(placed.label);
  }, [readOnly, store, device, apply, setSelection, announce]);

  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  useEditorKeyboard({
    api, canvasEl, lastPointer, device, setDevice, place,
    openShortcuts: () => setShortcutsOpen(true),
    shortcutsOpen,
  });

  const onToolbarAction = useCallback((a: ToolAction) => runCommand(a), [runCommand]);
  const view: FlowViewContextValue = useMemo(() => ({ style: 'clean' }), []);

  const slot = (name: EditorSlotName) => {
    const fromExt = extensions.filter((x) => x.slot === name);
    const extra = slots?.[name];
    if (!fromExt.length && !extra) return null;
    return <>{fromExt.map((x) => <ExtensionSlot key={x.id} ext={x} />)}{extra}</>;
  };
  const leftPanel = slot('leftPanel');
  const rightPanel = slot('rightPanel');

  return (
    <EditorContext.Provider value={api}>
      <CommandContext.Provider value={commands}>
        <div className="fse-editor" data-kit-style="clean">
          <TopBar
            title={title}
            onTitleChange={(t) => onTitleChange?.(t)}
            saveStatus={saveStatus}
            leading={leading}
            actions={(
              <>
                {slot('topBarActions')}
                <Tip label="Keyboard shortcuts" shortcut="?">
                  <button type="button" className="fsc-btn fsc-btn--icon" aria-label="Keyboard shortcuts" aria-keyshortcuts="Shift+?"
                    onClick={() => setShortcutsOpen(true)}>
                    <Keyboard size={16} strokeWidth={ICON_STROKE} aria-hidden />
                  </button>
                </Tip>
              </>
            )}
          />
          {tour && !readOnly && <FirstRunTour key={tour.run} doc={doc} onClose={closeTour} autoFocus={tour.focus} />}
          {storageTrouble && !readOnly && (
            <div className="fse-save-alert fsc-root" role="alert">
              <AlertTriangle size={16} strokeWidth={ICON_STROKE} aria-hidden />
              <span>
                <strong>Changes aren't being saved.</strong> Your browser's storage may be full or turned off (for example, in a private window).
                Keep this tab open while we try again, and use Export to keep a copy.
              </span>
            </div>
          )}
          <div className="fse-body">
            {!readOnly && (
              <div className="fse-left">
                <Toolbar activeTool={tool} onToolChange={setTool} onAction={onToolbarAction} />
                {leftPanel && <div className="fse-left__panel">{leftPanel}</div>}
              </div>
            )}
            <main
              className="fse-canvas"
              ref={canvasEl}
              aria-label="Board canvas"
              onPointerMove={(e) => { lastPointer.current = { x: e.clientX, y: e.clientY }; }}
              onPointerLeave={() => { lastPointer.current = null; }}
            >
              <FlowCanvas
                doc={doc}
                view={view}
                readOnly={readOnly}
                apply={apply}
                tool={tool}
                onPlace={place}
                onAnnounce={announce}
                onSelectionChange={onSelectionChange}
                manageKeyboard
                showMiniMap={false}
                handle={canvasRef}
              >
                {slot('canvas')}
              </FlowCanvas>
              {tool === 'screen' && <DeviceHint device={device} onChange={setDevice} />}
              {Object.keys(doc.frames).length === 0 && Object.keys(doc.elements).length === 0 && !readOnly && tool === 'select' && (
                <div className="fse-empty"><CoachMark /></div>
              )}
            </main>
            {rightPanel && <aside className="fse-right" aria-label="Inspector">{rightPanel}</aside>}
          </div>
          {slot('overlay')}
          <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
          <Announcer message={announcement} />
          <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} onShowTour={readOnly ? undefined : openTour} />
        </div>
      </CommandContext.Provider>
    </EditorContext.Provider>
  );
}

/** True once `value` has stayed true for `ms` (avoids flashing alerts for blips). */
function useLasting(value: boolean, ms: number) {
  const [lasting, setLasting] = useState(false);
  useEffect(() => {
    if (!value) { setLasting(false); return; }
    const t = setTimeout(() => setLasting(true), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return lasting;
}

function ExtensionSlot({ ext }: { ext: EditorExtension }) {
  return <>{ext.render()}</>;
}

const DEVICES: { id: Device; key: string; label: string }[] = [
  { id: 'mobile', key: '1', label: 'Mobile' },
  { id: 'tablet', key: '2', label: 'Tablet' },
  { id: 'desktop', key: '3', label: 'Desktop' },
];

function DeviceHint({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  return (
    <div className="fse-device-hint fsc-root" role="radiogroup" aria-label="Screen size">
      <span className="fse-device-hint__label">Click to place a screen</span>
      {DEVICES.map((d) => (
        <button key={d.id} type="button" role="radio" aria-checked={device === d.id}
          className="fse-device-hint__opt" onClick={() => onChange(d.id)} aria-keyshortcuts={d.key}>
          {d.label} <kbd className="fsc-kbd">{d.key}</kbd>
        </button>
      ))}
    </div>
  );
}
