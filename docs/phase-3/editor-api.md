# Editor API (for Wave B)

The board editor at `/b/:boardId` is `EditorShell` (`src/editor/EditorShell.tsx`). Wave B features (insert palette, inspector, inline text editing, link picker, Compare, Play, Share, Export) plug into it with:

1. **`useEditor()`** reads the document, applies undoable changes, and works with the selection, tools, viewport and announcements.
2. **Slots** let a feature mount UI without editing the editor layout.
3. **Commands** connect toolbar buttons and shortcuts (`/` Insert, `P` Play) to the feature that handles them.

Everything below is exported from `src/editor/EditorContext.tsx`.

## `useEditor(): EditorApi`

`useEditor()` throws outside the editor. For components that also render in read-only views, use `useOptionalEditor()`, which returns `null` instead.

| Member | What it does |
|---|---|
| `boardId` | Current board id. |
| `doc: BoardDoc` | Current document snapshot. It is immutable, and unchanged entities keep their object identity, so `memo`/`useMemo` work. |
| `readOnly` | Whether the board is read-only. When true, `apply` is a no-op that returns `false`. |
| `apply(op, { label?, mergeKey?, announce? }) → boolean` | Applies a pure op `(doc) => doc` as **one undo step**. Only the entities that changed are written to Yjs and IndexedDB. Returns `false` if nothing changed. `label` is used in "Undone: …". `mergeKey` merges consecutive applies with the same key within about 1s, for typing or slider drags. `announce: true` reads the label aloud; pass a string to read a custom message. |
| `undo()`, `redo()`, `canUndo`, `canRedo` | Undo history. Undo and redo announce their result automatically. |
| `selection: { nodes: ID[], edges: ID[] }` | `nodes` are frame and element ids. `edges` are connector ids. |
| `setSelection(ids \| { nodes?, edges? })` | Changes the selection. It is safe to call right after `apply` creates the nodes. |
| `tool`, `setTool(tool)` | The active toolbar tool (`ToolId` from `src/chrome/tools.ts`). |
| `screenToFlow(p)`, `flowToScreen(p)` | Convert between client pixels and canvas coordinates. |
| `viewportCenter()` | Centre of the visible canvas, in canvas coordinates. Use it to place new things. |
| `zoomToFit()`, `zoomToNodes(ids)` | Viewport helpers. |
| `announce(msg)` | Polite screen-reader announcement (`aria-live`). |
| `toast(msg, { actionLabel?, onAction? })` | Calm bottom toast. |
| `runCommand(name, payload?)` | Runs a registered command. If nothing handles it, a "coming soon" toast is shown. |
| `store` | Escape hatch: the underlying `BoardStore` (Yjs `doc`, `getDoc`, `subscribe`). |

Coordinates: frames use absolute canvas coordinates. Elements inside a frame (`parentId`) use coordinates relative to that frame, the same as React Flow.

### Example: inspector field (one undo step per edit session)

```tsx
function NameField({ frameId }: { frameId: ID }) {
  const { doc, apply } = useEditor();
  const frame = doc.frames[frameId];
  return (
    <input
      value={frame.name}
      onChange={(e) => apply((d) => renameFrame(d, frameId, e.target.value), { label: 'Rename screen', mergeKey: `rename:${frameId}` })}
    />
  );
}
```

### Example: insert a component at the centre and select it

```tsx
const { apply, viewportCenter, setSelection, selection, doc } = useEditor();
function insert(type: ElementType) {
  const frameId = selection.nodes.find((id) => doc.frames[id]);
  const c = viewportCenter();
  let id = '';
  apply((d) => {
    const f = frameId ? d.frames[frameId] : undefined;
    const r = addElement(d, { type, parentId: f?.id, x: f ? 24 : c.x, y: f ? 24 : c.y });
    id = r.id;
    return r.doc;
  }, { label: `Insert ${type}`, announce: `${type} added` });
  setSelection([id]);
}
```

All pure ops in `src/flow/ops.ts` work with `apply`. Examples include `linkElementToScreen`, `linkToNewScreen`, `duplicateAsOption`, `renameFrame`, `updateConnectorLabel` and `deleteNodes`. The same goes for `reorder` (`src/editor/zorder.ts`) and any op you write yourself, as long as it returns a new doc and leaves the input unmodified.

## Slots

| Slot | Where it renders |
|---|---|
| `leftPanel` | Floating column to the right of the toolbar, for example the insert palette. |
| `rightPanel` | A 280px docked aside, for example the inspector. It only appears when something is mounted in it. |
| `topBarActions` | The right side of the top bar, before the shortcuts button: Compare, Play, Share, Export. |
| `overlay` | Above everything in the editor root, for example the Play view, the Compare view or the link picker. Position it `fixed` yourself. |
| `canvas` | Inside React Flow, so React Flow hooks and `<ViewportPortal>` work there. Use it for canvas-anchored UI such as inline text editors. |

There are two ways to fill a slot:

**A. Register an extension** (recommended, so there is no layout edit). Append it to `src/editor/extensions.ts`:

```ts
export const EDITOR_EXTENSIONS: EditorExtension[] = [
  { id: 'insert-palette', slot: 'leftPanel', render: () => <InsertPaletteSlot /> },
  { id: 'inspector', slot: 'rightPanel', render: () => <InspectorSlot /> },
  { id: 'share', slot: 'topBarActions', render: () => <ShareButton /> },
];
```

Each `render()` runs inside the editor, so `useEditor()` and `useEditorCommand()` are available. Return `null` when there is nothing to show.

**B. Pass slots as props**, e.g. `<EditorShell slots={{ topBarActions: <SharePopover … /> }} … />`. `EditorPage` would pass them; that file is owned by Canvas Core.

## Commands

The toolbar's **Insert** button and the `/` key run `runCommand('insert')`. The **Play** button and the `P` key run `runCommand('play')`. A feature claims a command like this:

```tsx
function InsertPaletteSlot() {
  const [open, setOpen] = useState(false);
  useEditorCommand('insert', () => setOpen(true));
  return open ? <InsertPalette onClose={() => setOpen(false)} … /> : null;
}
```

When several handlers are registered for the same command, the most recently mounted one wins. Suggested names: `insert`, `play`, `compare`, `share`, `export`, `inspect`, `link`. Any string works.

## Keyboard etiquette

- The editor ignores keys while focus is in an `input`, `textarea` or `contenteditable`, or inside `[role=dialog|menu|listbox]`. Wave B UI gets its own keys for free there.
- Arrow keys, Enter and Delete are also ignored when focus is on buttons or links, or inside `.fse-left__panel` or `.fse-right`.
- If you need a key elsewhere, handle it and call `e.preventDefault()`. The editor skips events whose default was already prevented. Its own listener runs on `window` in the capture phase, so to take precedence over it, listen on `window` in capture phase too and register before it, or use a focused element inside a dialog.
- Inline text editing: render the editor in the `canvas` slot (or in a node) with `contenteditable` or an `<input>`, then commit with `apply(op, { mergeKey: 'text:<id>' })`.

## Rendering contract

- `FlowCanvas` (`src/flow/FlowCanvas.tsx`) still works stand-alone with `{ doc, setDoc?, view, onSelectionChange?, readOnly? }`, for the sandbox, share view and thumbnails. The editor passes `apply`, `tool`, `onPlace`, `handle` and `manageKeyboard`.
- Z order uses `fractional-indexing` keys, so compare them with `compareZ` from `src/flow/ops.ts`, never `localeCompare`. New entities get `nextZ(doc)`. Use `reorder(doc, ids, 'front' | 'back' | 'forward' | 'backward')` to restack.
- The clipboard format is a JSON text payload with `marker: 'flowsketch/v1'` (`src/editor/clipboard.ts`).
