# Wireframe on canvas: phase 3, wave B

> **Wave C update:** the Inspector panel described below has been replaced by a floating context bar. See [context-bar.md](context-bar.md).

## Summary
- **Insert palette (`/` or the toolbar "+").** You can search all 16 wireframe components, 5 shapes and 3 screen sizes. Each item has a small lo-fi preview, and the palette works fully from the keyboard: type to filter, ↑/↓ to move, Enter to insert, Esc to close.
  - If a screen (or something inside one) is selected, the new item is stacked below that screen's lowest element with a 16px gap. Otherwise it goes to the centre of the view.
  - You can also **drag** an item onto the canvas or into a screen.
  - Every insert selects the new item, announces it ("Button added to Screen 1") and is one undo step.
- **Moving items in and out of screens.** Drop an element on empty canvas and it becomes a canvas element. Drop it on another screen and it moves to that screen. The element's centre decides which. Elements that stay inside their screen are clamped back within its edges.
- **Inspector (right panel, only while something is selected).**
  - A screen shows its name, device (desktop/tablet/mobile; the top-left corner stays put) and a "Start screen" toggle.
  - An element shows the props from its kit definition (`editableProps`), plus W/H and "Link to…", which runs `runCommand('link', { elementId })`.
  - Several selected items show align (6) and distribute (2) buttons.
  - A typing burst is one undo step. Esc returns focus to the selected node on the canvas.
- **Inline text editing.** Double-click, Enter or F2 edits an element's text (the kit's `textProp`) or a screen's name in place. Enter or blur commits, Shift+Enter adds a new line in multiline fields, and Esc cancels. Each edit is one undo step. The Text (T) and Sticky (N) tools open the editor as soon as you place the item.
- **Resizing.** Corner handles resize elements and screens. Sizes snap to the 8px grid (hold Alt to resize freely), respect the kit's minimum sizes, and keep elements inside their screen. Each resize is one undo step; from the keyboard, use Alt+Shift+Arrow (8px steps). Screens can only grow taller (see below).

## How to try it
1. `npm run dev`, then create a board on `/` and open it.
2. Press **F** and click to place a screen. Press **/**, type `button`, then press **Enter**. The button appears inside the screen and is selected.
3. Double-click the button (or press **Enter**), type a new label, then press **Enter**. Press **⌘Z** to undo the edit in one step.
4. In the Inspector, change the **Style**, set **W** to 240, select the screen, switch **Device** to tablet, and tick **Start screen**.
5. Drag the bottom-right handle of the button: it snaps to 8px. Then drag the screen's bottom handle to make a taller page.
6. Press **/** and drag "Toggle" from the palette into the screen. Drag an element out of the screen onto empty canvas: it becomes a canvas element.
7. Press **T** and click on the canvas: you are typing right away. Press **N** to do the same with a sticky note.
8. Shift-click 3 or more items: the Inspector shows align and distribute.

## Design choices
- **Screens:** you can resize the height only. The width stays locked to the device width, and the device itself never changes (no "custom" device).
  - The minimum height is `max(min(device height, current height), bottom of the content + 16 + bottom inset)`, so a page can never hide its content.
  - Use the Inspector's Device field to change the width.
- **Changing device** keeps the top-left corner and the elements' positions. Elements that would stick out are squeezed or clamped in, and the height grows if the content needs it.
- **Enter on a selected screen** renames it. (The editor's own Enter only acts for placement and arrow tools.)
- **Start screen** keeps one start per flow. When you move the start to another screen, the flow's name and variants follow it.
- **"Link to…" is enabled.** If no one claims the `link` command yet, the editor shows its usual "coming soon" toast.
- **Inspector headings name the kind** ("Screen / Mobile screen", "Component / Button") rather than repeating your text, so they never duplicate text on the canvas.

## Architecture (all in `src/editor/features/components/`)
- `ops.ts`: pure ops.
  - Placement: `insertIntoFrame`, `insertAtPoint`, `targetFrameFor`, `frameAtPoint`.
  - `reparentAfterMove`.
  - Resizing: `resizeBox`, `resizeRules`, `setNodeBox`, `setNodeSize`, `nudgeSize`, `frameMinHeight`.
  - Props and screens: `setElementProps`, `setElementText`, `textPropOf`, `setFrameDevice`, `setStartScreen`.
  - Layout: `alignNodes`, `distributeNodes`.
- `paletteItems.ts`: the 24 palette entries and the drag MIME type. `insert.ts` runs an insert: one `apply`, then select, announce and focus.
- `InsertPaletteSlot.tsx` (overlay slot) claims the `insert` command. `InspectorPanel.tsx` fills the rightPanel slot. `CanvasLayer.tsx` (canvas slot) handles the inline editor, double-click and Enter/F2, T/N auto-edit, Alt+Shift+Arrow resize and palette drops.
- `bridge.ts` is a tiny external store. It lets memoised `KitNode` and `ScreenNode` reach `apply` without subscribing every node to editor context. Nodes only render `ResizeHandles` while selected, so the 60-screen board is unaffected (`editor-perf` passes).

## Tests
- **Vitest:**
  - `ops.test.ts` (22): placement, clamping, re-parenting, resize, snap, min size, device change, start screen, align/distribute, prop and text edits.
  - `paletteItems.test.ts` (4): items and groups, search ranking, hints.
  - All 400 unit tests pass.
- **Playwright `e2e/components.spec.ts` (8, stable with `--repeat-each 3`):**
  - F → `/` "button" → Enter inside the screen → double-click rename → undo/redo → reload persists.
  - Esc cancels editing, and screen rename.
  - Inspector: device, start screen, props, W, one undo step, Esc focus, hidden when nothing is selected.
  - Corner resize with snap and one undo step.
  - Drag from the palette into a screen.
  - Keyboard-only insert, edit and resize.
  - Dragging out of a screen re-parents.
  - T/N auto-edit.
- **Full run:** `npx tsc -b` is clean. `npm run lint` has 0 errors. `npx playwright test` gives 35 passed and 2 failed; both failures are in the Connectors & Flows agent's in-progress files:
  - `editor-keyboard.spec.ts:64`: `getByRole('button', { name: 'Play' })` now matches 2 buttons, because a header Play was added in `features/flows/TopBarActions.tsx`.
  - `share.spec.ts`: the "← Back" button in `PlayView.tsx` was changed.

## Risks
- Elements no longer have React Flow's `extent: 'parent'`, so you can drag them out of screens. While dragging, an element over a screen with a higher z-order can render behind it until you drop it.
- The Inspector's live screen-name field accepts an empty string while you type. The canvas inline editor ignores empty names.
- HTML5 drag from the palette has no touch support. Keyboard and click insert work everywhere.
- Lint warnings (not errors) remain for the "latest ref" pattern and for resetting a draft in an effect. Canvas Core uses the same patterns.

## Open questions
- Should dropping an element onto a screen's z-order above it also lift its z (to fix the render-behind-during-drag case)?
- Should screens offer a "custom" width later (for example, responsive breakpoints)? For now the width is locked to the device.

## Parking lot
- Rich previews of each variant in the palette (for example, every button style).
- Snap-to-sibling guides while resizing (moving already has guides).
- Multi-select resize and group scaling.
- Inline editing of list items and tabs one by one (today the whole multiline text is edited at once).

## Edits outside my files
- `src/flow/FlowCanvas.tsx`: imports `reparentAfterMove`. The drag-stop commit is now `reparentAfterMove(<existing moveNode reduce>, movedIds)`, still one `apply` and so one undo step.
- `src/flow/adapter.ts` (`toKit`): removed `extent: 'parent'` so elements can leave screens, and added a comment explaining why.
- `src/flow/ops.test.ts`: one expectation updated to `expect(child?.extent).toBeUndefined()`.
- `src/editor/extensions.tsx`: added 3 entries (`insert-palette` overlay, `inspector` rightPanel, `components-canvas` canvas) and their import.

## Requests to Orchestrator
- Ask the Connectors & Flows agent to:
  - Disambiguate the two "Play" buttons in `editor-keyboard.spec.ts`, or rename one.
  - Update `share.spec.ts` for the new PlayView "Back" button.
  - Claim the `link` command. The Inspector's "Link to…" already sends `{ elementId }`.
