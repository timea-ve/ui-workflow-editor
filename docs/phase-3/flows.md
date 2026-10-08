# Phase 3 · Wave B — Connectors & Flows

## Summary
- **Link in ≤2 actions**: select a component inside a screen → **L** (or Inspector "Link to…", or drag from its handle to a screen) → click a highlighted screen, pick from the keyboard list, or "New screen →" (placed right). The same picker retargets or removes a link. Diagram shapes, headings and table rows are rejected with a calm toast.
- **Connector polish**: double-click a connector (or select it + **Enter**) to edit its label inline (one undo step); a small edge toolbar toggles straight / step / curved and the arrowhead. Routing picks anchors that leave the source screen on the side facing the target, so edges no longer cut through their own screen (the Sign-up "Try again" link is fixed in routing, not in the template). Labels are 14px at 100%.
- **Flows panel** (left, collapsed by default): auto-detected flows, inline rename (`doc.flowNames`), click to zoom, options per flow with rename / play / delete, "+ Option" and Compare.
- **Options & Compare**: **⇧D** duplicates the selected flow as the next option lane below (A, B, C…). Lane chips can be renamed inline, and an option can be deleted with Undo. **⇧C** (or the top-bar Compare) opens two read-only panes with option pickers. Pan and zoom stay in sync, aligned on each option's start screen.
- **Play** (**P** / primary top-bar button): starts at the selected flow's start screen and shows one screen fitted to the window, with link hotspots only. Clicking elsewhere flashes a hint. Also: back, restart, option switcher, "Screen x of y". Esc returns to the editor with the current screen selected.

## How to try
`npm run dev` → `/` → create a board from the **Sign-up** template.
1. Select a button in a screen → **L** → click another screen (or type to filter and press Enter).
2. Select a screen → **⇧D**. Double-click the "Option B" lane chip to rename it, then **⇧C** to compare.
3. **P** to play, and click the violet hotspots. Use ← to go back, R to restart, 1–9 to switch option and Esc to exit.
4. Double-click a connector to label it. Use the edge toolbar to switch its style.

## Shortcuts added
| Key | Action |
|---|---|
| L | Link the selected component (opens the picker) |
| ⇧D (also ⌘⇧D) | Duplicate the selected flow as a new option |
| ⇧C | Compare options of the selected flow |
| Enter on a selected connector / double-click | Edit the connector label |
| P | Play (already claimed via `runCommand('play')`) |
| Play: ← / Backspace, →, R, 1–9, Esc | Back, follow the only link, restart, switch option, exit |
| Picker: ↑ ↓ Enter, type to filter, Esc | Choose a target, or cancel |

No conflicts with the Canvas Core tool keys (V H F R D O A T N / P).

## Architecture
- `src/flow/ops.ts` (pure ops, all undoable through `apply`): `renameFlow`, `deleteOption`, `duplicateFlowAsOption`, `linkOf`, `unlinkElement`, `retargetLink`, `canLinkElement` and `updateConnectorStyle`.
- `src/flow/adapter.ts`: `escapeAnchors` and `resolveConnectorAnchors` choose the source and target sides for `auto` anchors.
- `src/editor/features/flows/` contains:
  - `FlowsRoot`: overlay host for commands and shortcuts (`link`, `play`, `compare`, `duplicate-option`, `delete-option`, `rename-option`, `rename-flow`)
  - `LinkPicker`, `CompareView`, `FlowsPanel`, `TopBarActions` and `EdgeControls`
  - `flowIndex`: `detectFlows`, memoised per doc in a WeakMap, so it runs once per doc change rather than once per node
  - `playModel`: pure Play history and navigation
- `PlayView` stays backward compatible with the share page and sandbox (the old props still work).

## Tests
- Vitest: `src/flow/ops.flows.test.ts` and `src/editor/features/flows/playModel.test.ts` have 20 tests covering flow rename, delete option, link retarget/unlink/canLink, routing anchor choice and Play navigation. Full `npm test`: **400/400 pass**.
- Playwright: `e2e/flows.spec.ts` has 4 tests:
  - 3 screens linked via L + click, then Play forward, back, restart and Esc
  - duplicate as Option B, rename to "Option B – short form", Compare panes with synced pan
  - keyboard-only link + play
  - geometry check that the Sign-up "Try again" edge doesn't intersect its source frame

  Full `npx playwright test`: **37/37 pass**, including `editor-perf.spec.ts`. They are stable with `--repeat-each=3`.
- `npx tsc -b`: clean. `npm run lint`: 0 errors. In my files the only warnings are `only-export-components`.

## Risks
- Routing is side-choice + step routing, not full obstacle avoidance. An edge can still cross a *third* screen in dense layouts.
- Keyboard shortcuts are window-capture listeners in `FlowsRoot`, so they run before the editor's. If Canvas Core later adds L / ⇧C / ⇧D, there will be a conflict.
- The editor's `selection` lands one render after React Flow's. The L shortcut reads React Flow's DOM selection to avoid acting on a stale selection.

## Open questions
- Should ⇧D on a selected *element* (not a screen) duplicate the element instead? Today it duplicates the flow containing it.
- Should Compare offer more than 2 panes, or a diff overlay (decided later in GATE-1)?

## Parking lot
- An element-to-element drag into another screen stays a connector. It isn't converted to a link to that screen.
- There's no ⋯ menu on lane chips; delete lives in the Flows panel.
- Compare diff overlay.
- Play transitions and hotspot hints on hover.

## Edits outside my files
- `src/editor/extensions.tsx`: added 4 entries (`compare`, `play`, `flows-root`, `flows-panel`) and one import.
- `e2e/editor-keyboard.spec.ts` ("Tab reaches the toolbar…"):
  - "Play" now matches both the rail tool and the new top-bar button, so the test scopes to the `Tools` group.
  - The test also expects one extra Tab stop: the collapsed Flows panel sits between the toolbar and the canvas.
- Note: the other Wave B agent also edited `src/flow/adapter.ts` (removed `extent: 'parent'` for re-parenting on drop). I kept their change.

## Requests to Orchestrator
- Switch the export `scope.ts` connector geometry to `resolveConnectorAnchors`, so exported edges route like the canvas.
- Add L, ⇧D, ⇧C and Enter-to-label to the `ShortcutsDialog`.
- Expose React Flow's live selection (or flush `selection` synchronously) in `EditorApi`, so extensions don't need the DOM fallback.
