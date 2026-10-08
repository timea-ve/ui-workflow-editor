// Single source of truth for the shortcuts dialog (and docs). `mod` = ⌘ on macOS, Ctrl elsewhere.
import { TOOLS, TOOL_ACTIONS } from '../chrome/tools';

export interface ShortcutDef { keys: string[]; label: string }
export interface ShortcutGroup { title: string; items: ShortcutDef[] }

export function shortcutGroups(mod: string): ShortcutGroup[] {
  return [
    {
      title: 'Tools',
      items: [
        ...TOOLS.map((t) => ({ keys: [t.key], label: t.label })),
        ...TOOL_ACTIONS.map((a) => ({ keys: [a.key], label: a.label })),
        { keys: ['1', '2', '3'], label: 'Screen tool: mobile / tablet / desktop' },
        { keys: ['Enter'], label: 'Place with the active tool at the centre of the view' },
        { keys: ['Esc'], label: 'Back to Select, then select parent, then clear selection' },
      ],
    },
    {
      title: 'Edit',
      items: [
        { keys: [mod, 'Z'], label: 'Undo' },
        { keys: [mod, '⇧', 'Z'], label: 'Redo (also Ctrl Y)' },
        { keys: [mod, 'C'], label: 'Copy' },
        { keys: [mod, 'X'], label: 'Cut' },
        { keys: [mod, 'V'], label: 'Paste' },
        { keys: [mod, 'D'], label: 'Duplicate' },
        { keys: ['Delete'], label: 'Delete (also Backspace)' },
        { keys: [mod, 'A'], label: 'Select all' },
        { keys: ['Arrows'], label: 'Nudge 1px' },
        { keys: ['⇧', 'Arrows'], label: 'Nudge 10px' },
        { keys: ['Alt'], label: 'Hold while dragging to turn off snapping' },
        { keys: ['A', 'Enter'], label: 'Arrow tool with two items selected: connect them' },
      ],
    },
    {
      title: 'Flows & options',
      items: [
        { keys: ['L'], label: 'Link the selected component to a screen' },
        { keys: ['Enter'], label: 'Edit text, or the label of a selected arrow (also double-click)' },
        { keys: ['⇧', 'D'], label: 'Duplicate the selected flow as a new option' },
        { keys: ['⇧', 'C'], label: 'Compare options side by side' },
        { keys: [mod, '⇧', 'E'], label: 'Export PNG or PDF' },
      ],
    },
    {
      title: 'Play mode',
      items: [
        { keys: ['←'], label: 'Back (also Backspace)' },
        { keys: ['→'], label: 'Follow the only link on this screen' },
        { keys: ['R'], label: 'Restart' },
        { keys: ['1–9'], label: 'Switch option' },
        { keys: ['Esc'], label: 'Exit to the editor' },
      ],
    },
    {
      title: 'Arrange',
      items: [
        { keys: [mod, '⇧', ']'], label: 'Bring to front' },
        { keys: [mod, ']'], label: 'Bring forward' },
        { keys: [mod, '['], label: 'Send backward' },
        { keys: [mod, '⇧', '['], label: 'Send to back' },
      ],
    },
    {
      title: 'View',
      items: [
        { keys: ['Space', 'Drag'], label: 'Pan (also H, or scroll / trackpad)' },
        { keys: [mod, '+'], label: 'Zoom in (also pinch, or ⌘ / Ctrl scroll)' },
        { keys: [mod, '−'], label: 'Zoom out' },
        { keys: [mod, '0'], label: 'Zoom to 100%' },
        { keys: ['⇧', '1'], label: 'Zoom to fit' },
        { keys: ['⇧', '2'], label: 'Zoom to selection' },
        { keys: ['Tab'], label: 'Move focus between items' },
        { keys: ['?'], label: 'Show keyboard shortcuts' },
      ],
    },
  ];
}
