# Canvas Core: phase 3

## Summary
- `/b/:boardId` is now a working board editor. You can place screens and shapes from the toolbar or with letter keys, link them with the arrow tool, and select, move, nudge, delete, copy, paste, duplicate and restack them. Snapping shows violet alignment guides while you drag.
- Every board saves on this device as you edit (Yjs + IndexedDB, one database per board), and the top bar shows the save status. Undo and redo cover every change, and one gesture is one step.
- A 60-screen board drags smoothly. During a drag only the dragged node moves, and the change is written to the document once, when you drop. The e2e test saw no long tasks and a 16.7 ms median frame.
- Everything works from the keyboard. `?` lists all shortcuts, and actions are announced to screen readers ("Screen 3 added", "Undone: Move").
- Wave B has a documented `useEditor()` API plus slots and commands (`docs/phase-3/editor-api.md`). The insert palette, inspector, link picker, Play, Compare, Share and Export can be added without touching the editor layout.

## How to try it
1. `npm run dev`, then create a board on the dashboard (`/`). Or open `/b/<id>` for any board in the list.
2. Press **F** and click to place a screen. Press **1/2/3** first to pick mobile, tablet or desktop.
3. Press **R**, **D**, **O**, **T** or **N** and click to place shapes. Clicking inside a screen with **T** places text in that screen.
4. Press **A** and drag from one item to another to connect them. Dragging from a button inside a screen to another screen creates a Play link.
5. Drag items: guides appear and snapping kicks in. Hold **Alt** to drag freely. Then try **⌘Z** / **⇧⌘Z**, **⌘C** / **⌘V**, **⌘D**, and **⌘]** / **⌘[**.
6. Reload: everything is still there. Unknown ids such as `/b/nope` show "Board not found" with a link back to your boards.
7. **Performance fixture:** open `/b/perf-60` (or append `?fixture=perf60` to any `/b/...` URL). It has 60 mobile screens with 8 elements each, and each screen's button links to the next screen. It lives in memory only and is never saved.

## Shortcuts
`mod` = ⌘ on macOS, Ctrl elsewhere. The in-app list (`?`) comes from the same source, `src/editor/shortcuts.ts`.

| Keys | Action |
|---|---|
| V / H / F / R / D / O / A / T / N | Select, Pan, Screen, Rectangle, Decision, Start/end, Arrow, Text, Sticky |
| 1 / 2 / 3 (Screen tool) | Mobile / tablet / desktop |
| Enter | With a placement tool: place at the centre of the view, or inside the selected screen. With the Arrow tool and 2 items selected: connect them. |
| Esc | Back to the Select tool, then select the parent screen, then clear the selection |
| / , P | Insert, Play (Wave B commands; until then a "coming soon" toast) |
| mod Z, mod ⇧ Z, Ctrl Y | Undo, redo |
| mod C / X / V / D | Copy, cut, paste, duplicate |
| Delete / Backspace | Delete. Removing a screen also removes its contents, links and connectors. |
| mod A | Select all at the current level (all screens and loose shapes, or the siblings inside one screen) |
| Arrows, ⇧ Arrows | Nudge 1px / 10px. A run of nudges is one undo step. |
| mod ] / mod [ | Bring forward / send backward |
| mod ⇧ ] / mod ⇧ [ | Bring to front / send to back |
| mod + / mod − / mod 0 | Zoom in / out / 100% |
| ⇧ 1 / ⇧ 2 | Zoom to fit / zoom to selection |
| Space + drag, scroll, pinch | Pan, zoom |
| Alt (while dragging) | Turn off snapping |
| Tab | Move focus between canvas items. Enter selects the focused item. |
| ? | Keyboard shortcuts dialog |

## What's built (files)
- **Store (`src/store/`)**
  - `docSync.ts`: one `Y.Map` per BoardDoc key, holding plain entity objects. It diffs the old and new doc and writes only the entities that changed, all in one transaction.
  - `boardStore.ts`: `BoardStore`, with an incremental snapshot, `apply`, a labelled `Y.UndoManager` and `mergeKey` merging.
  - `persistence.ts`: y-indexeddb room `fs-board-<id>`, the contract functions `writeInitialDoc`, `readBoardDoc` and `deleteBoardData`, and `openBoardSession` with save state.
  - `useBoardSession.ts`.
- **Canvas (`src/flow/`)**
  - `FlowCanvas.tsx` was rewritten. React Flow nodes are reconciled from the doc, reusing the objects of unchanged entities. Drags stay in React Flow state and are committed once on drop. It also adds snapping and guides, arrow-tool connecting, placement tools and an imperative selection handle.
  - `adapter.ts` gains `reconcileNodes` and `reconcileEdges`. `ScreenNode` and `KitNode` are memoised with the `memo.ts` comparator.
  - `ops.ts` z-order now uses `fractional-indexing` (`compareZ`, `zAfter`, `nextZ`).
- **Editor (`src/editor/`)**
  - `EditorShell.tsx` builds the layout, the Editor API and the slots.
  - `EditorContext.tsx` holds `useEditor`, the commands and the slot types. `extensions.ts` is where Wave B registers features.
  - `useEditorKeyboard.ts` handles shortcuts and the clipboard.
  - `snap.ts`, `zorder.ts`, `clipboard.ts` and `placement.ts` hold the pure logic.
  - `ShortcutsDialog.tsx` and `shortcuts.ts` provide the shortcuts dialog. `editor.css` styles the editor, and `fixtures/perf60.ts` is the perf fixture.
- **Page**: `src/pages/EditorPage.tsx` covers the perf fixture, not-found and loading states, board rename (`renameBoard`), and a debounced `touchBoard` after each save.
- **Chrome tweak**: `TopBar` gains an optional `actions` prop that replaces the default buttons (used for the `topBarActions` slot). The Share, Export, Compare and Play callbacks are now optional. The existing `/chrome` page is unchanged.

## Tests added
- **Vitest**
  - `src/store/store.test.ts` (11): the diff writes only changed entities, skips structurally equal entities, handles deletes and generic keys, and keeps references stable. Also covers a Yjs update round-trip between two docs (persistence-equivalent), undo labels, one op as one step, and `mergeKey` merging.
  - `src/editor/snap.test.ts` (5), `zorder.test.ts` (5), `clipboard.test.ts` (8: serialize, parse, id remap, children, links, offset, target frame), `placement.test.ts` (3), `keyboard.test.ts` (3: select-all level, nudge).
- **Playwright**
  - `e2e/editor.spec.ts`: seed a board, add 3 screens with F, connect them with the arrow tool, undo and redo, reload, and check persistence. Also the not-found state.
  - `e2e/editor-keyboard.spec.ts`: keyboard only. Tool letters, F+1+Enter placement, nudge (1/10px, one undo step), duplicate, copy and paste, select all, delete plus undo, the `?` dialog, and Tab focus to nodes.
  - `e2e/editor-perf.spec.ts`: on `/b/perf-60` with all 60 screens visible, drags one screen over 30 pointer moves. A `PerformanceObserver('longtask')` must report no task over 200 ms, and the rAF median frame must be under 50 ms. Locally: no long tasks, 16.7 ms median frame.
- **Results:** `npx tsc -b` clean, `npm test` 354 passed, `npx playwright test e2e/editor` 5 passed, `npm run lint` 0 errors (warnings only).

## Risks
- **IndexedDB-only persistence.** Clearing site data deletes boards. Private windows lose them on close. If IndexedDB is unavailable, the top bar shows "error" while editing still works in memory.
- **Z-key format change.** z keys are now `fractional-indexing` strings. Older docs with legacy keys such as `z00000001` still sort correctly, and the first restack within a level renumbers that level. Anything that sorted z with `localeCompare` must switch to `compareZ`.
- **Paste across boards** relies on the system clipboard (`text/plain` with the `flowsketch/v1` marker). If the browser blocks clipboard access, an in-memory fallback covers the same tab only.
- **Perf thresholds** are deliberately loose for headless CI. Real-device profiling with more than 100 screens and edges hasn't been done.
- **Lint warnings** (`react/refs`) in `FlowCanvas.tsx` come from the render-time reconcile pattern (refs read during render). This is intentional, to avoid a frame of lag.

## Open questions
- The default device for the F tool is desktop, per the brief. Many flows are mobile. Should we remember the last-used device per board?
- Should **Delete** on a screen ask for confirmation, or offer an "Undo" toast? Right now it relies on ⌘Z plus an announcement.
- Should the snap threshold (6 screen px) and the Alt override be configurable or shown in the UI?

## Parking lot
- Resize handles with snapping for frames and shapes, plus distribution and spacing guides.
- Right-click context menu wiring (`ContextMenu` exists in chrome) for the arrange, copy and delete actions.
- Multi-tab live sync. Y.Doc supports it; it needs a BroadcastChannel provider.
- Remember the viewport per board.
- A minimap toggle (currently hidden in the editor).
- Paste images or plain text as elements.

## Requests to Orchestrator
- **Mount Wave B features** through `src/editor/extensions.ts` (append-only) or `EditorShell` `slots`. Neither needs a layout edit. `SharePopover` belongs in the `topBarActions` slot, e.g. `{ id: 'share', slot: 'topBarActions', render: () => <ShareSlot /> }` using `useEditor().boardId` and `store.getDoc`.
- **No changes needed** to `src/model/types.ts`, `App.tsx` or the configs.
- **Note for templates and export:** build docs with the `src/flow/ops.ts` ops so z keys are fractional. The `src/export/scope.ts` imports from `adapter.ts` (`LANE_PAD`, `absoluteRect`, `resolveAnchors`) are unchanged.
