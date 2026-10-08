// The Editor API that Wave B features build on. See docs/phase-3/editor-api.md.
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { BoardDoc, ID } from '../model/types';
import type { ToolId } from '../chrome/tools';
import type { BoardStore } from '../store/boardStore';

export type DocOp = (doc: BoardDoc) => BoardDoc;

export interface EditorApplyOptions {
  /** Shown in "Undone: <label>" and used as the undo-step name. */
  label?: string;
  /** Consecutive applies with the same key (within ~1s) merge into one undo step (typing, nudging). */
  mergeKey?: string;
  /** Announce to screen readers (true → the label, or a custom message). */
  announce?: boolean | string;
}

export interface EditorSelection {
  /** Selected frames / elements. */
  nodes: ID[];
  /** Selected connectors. */
  edges: ID[];
}

export interface ToastOptions { actionLabel?: string; onAction?: () => void }

/** Commands that toolbar buttons / shortcuts route to Wave B features. */
export type EditorCommand = 'insert' | 'play' | 'compare' | 'share' | 'export' | 'inspect' | 'link' | (string & {});
export type CommandHandler = (payload?: unknown) => void;

export interface EditorApi {
  boardId: ID;
  /** Current document snapshot (immutable; unchanged entities keep their identity). */
  doc: BoardDoc;
  readOnly: boolean;
  /** Apply a pure op as one undoable step. Returns false when nothing changed. */
  apply(op: DocOp, opts?: EditorApplyOptions): boolean;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  selection: EditorSelection;
  /** Accepts node ids, or { nodes, edges }. */
  setSelection(sel: ID[] | Partial<EditorSelection>): void;
  tool: ToolId;
  setTool(tool: ToolId): void;
  /** Client (screen) point → canvas coordinates. */
  screenToFlow(p: { x: number; y: number }): { x: number; y: number };
  /** Canvas coordinates → client (screen) point. */
  flowToScreen(p: { x: number; y: number }): { x: number; y: number };
  /** Centre of the visible canvas, in canvas coordinates. */
  viewportCenter(): { x: number; y: number };
  zoomToFit(): void;
  zoomToNodes(ids: ID[]): void;
  /** Polite screen-reader announcement. */
  announce(message: string): void;
  toast(message: string, opts?: ToastOptions): void;
  /** Run a command registered with useEditorCommand (no-op + calm toast if nobody handles it). */
  runCommand(name: EditorCommand, payload?: unknown): void;
  /** Escape hatch: the underlying Yjs-backed store. */
  store: BoardStore;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const api = useContext(EditorContext);
  if (!api) throw new Error('useEditor() must be used inside <EditorShell>');
  return api;
}

/** Same as useEditor but returns null outside an editor (for components shared with read-only views). */
export const useOptionalEditor = () => useContext(EditorContext);

// ---------- commands ----------

export class CommandRegistry {
  private handlers = new Map<string, CommandHandler[]>();
  register(name: string, fn: CommandHandler) {
    const list = this.handlers.get(name) ?? [];
    list.push(fn);
    this.handlers.set(name, list);
    return () => {
      const cur = this.handlers.get(name) ?? [];
      this.handlers.set(name, cur.filter((h) => h !== fn));
    };
  }
  /** The most recently registered handler wins. Returns false when unhandled. */
  run(name: string, payload?: unknown): boolean {
    const list = this.handlers.get(name);
    const fn = list?.[list.length - 1];
    if (!fn) return false;
    fn(payload);
    return true;
  }
  has(name: string) { return !!this.handlers.get(name)?.length; }
}

export const CommandContext = createContext<CommandRegistry | null>(null);

/**
 * Handle an editor command, e.g. useEditorCommand('insert', () => setPaletteOpen(true)).
 * The toolbar's Insert ("/") and Play ("P") buttons and shortcuts dispatch these.
 */
export function useEditorCommand(name: EditorCommand, handler: CommandHandler) {
  const registry = useContext(CommandContext);
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => registry?.register(name, (p) => ref.current(p)), [registry, name]);
}

// ---------- slots ----------

export type EditorSlotName = 'leftPanel' | 'rightPanel' | 'topBarActions' | 'overlay' | 'canvas';

export interface EditorExtension {
  id: string;
  slot: EditorSlotName;
  /** Rendered inside the editor (useEditor() available). */
  render: () => ReactNode;
}
