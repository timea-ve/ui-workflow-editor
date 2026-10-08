// Pure tool/shortcut definitions for the editor toolbar (UX doc §5.1).
// Presentational chrome reads these; the editor owns the active-tool state.

export type ToolId = 'select' | 'pan' | 'screen' | 'rect' | 'diamond' | 'ellipse' | 'arrow' | 'text' | 'sticky';
export type ToolAction = 'insert' | 'play';

export interface ToolDef<T extends string = ToolId> {
  id: T;
  label: string;
  /** Single-key shortcut, shown in the UI as written here. */
  key: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', key: 'V' },
  { id: 'pan', label: 'Pan', key: 'H' },
  { id: 'screen', label: 'Screen', key: 'F' },
  { id: 'rect', label: 'Rectangle', key: 'R' },
  { id: 'diamond', label: 'Decision', key: 'D' },
  { id: 'ellipse', label: 'Start / end', key: 'O' },
  { id: 'arrow', label: 'Arrow', key: 'A' },
  { id: 'text', label: 'Text', key: 'T' },
  { id: 'sticky', label: 'Sticky note', key: 'N' },
];

export const TOOL_ACTIONS: ToolDef<ToolAction>[] = [
  { id: 'insert', label: 'Insert component', key: '/' },
  { id: 'play', label: 'Play', key: 'P' },
];

export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/** True when keyboard focus is in something the user types into. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as HTMLElement;
  return Boolean(el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

/**
 * Map a keypress to a tool or toolbar action. Returns null when the key is
 * unbound, a modifier (other than Shift) is held, or the user is typing.
 */
export function toolForKey(e: KeyLike, typing = false): ToolId | ToolAction | null {
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === 'Escape') return 'select';
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return TOOLS.find((t) => t.key === k)?.id ?? TOOL_ACTIONS.find((a) => a.key === k)?.id ?? null;
}
