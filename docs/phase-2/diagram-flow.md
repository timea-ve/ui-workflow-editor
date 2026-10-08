# Phase 2 — Diagram Kit & Flow logic

_Owner: Diagram & Flow agent · Try it: `npm run dev` → **/sandbox**_

## Plain-language summary
- **Five diagram shapes are ready** — process box, decision, start/end, sticky note, free text — and each one works in both the Sketchy and Clean styles.
- **Arrows stay attached.** Move a screen or a button and its arrows follow. Arrows use elbow routing and can carry labels like "yes" or "submit".
- **Linking works with one gesture.** Drag from a button onto another screen. The arrow becomes a clickable link, and a small blue marker shows on the button.
- **"Duplicate as option" works.** It copies a flow into a labelled lane below the original ("Option B", then "Option C"…). Links inside the copy point to the copied screens.
- **Play is working at a basic level.** It opens an option's first screen at full size. Click the highlighted button to go to the next screen. Press Esc to return to the board.

## Shapes

| Shape | Type id | Default size | Main text | Notes |
|---|---|---|---|---|
| Process box | `rect` | 160×72 | `label` (wraps, centred) | Light rounded corners in Clean style |
| Decision | `diamond` | 140×100 | `label` | Text sits in the inner half of the diamond so it never crosses the edges |
| Start / end | `ellipse` | 140×56 | `label` | `shape`: **pill** (default) or oval |
| Sticky note | `sticky` | 180×140 | `text` (multi-line) | Light grey paper with a folded corner |
| Text | `label` | 140×32 | `text` (multi-line) | `size`: sm / md / lg / xl; no outline |

All shapes are drawn with the shared primitives and colour tokens only. The pill outline is a local helper in `src/kit/diagram/_helpers.tsx`. Diagram shapes are **not** link sources (`linkable: false`). Only wireframe components link to screens.

## How it works

- **Connectors** (`Connector`) are arrows between any two items. Each end has an anchor (`top/right/bottom/left/auto`). `auto` picks the side facing the other item and is recalculated every time something moves. Elbow (`step`) routing is the default; straight and curved are also supported. Labels sit on a white pill.
- **Links** (`ScreenLink`): drawing from a component **inside a screen** onto **another screen** creates a link plus its arrow (`connectNodes`). Each component can link to only one screen; re-linking replaces the old link. Deleting the arrow deletes the link, because the arrow *is* the link.
- **Flows** are detected from links and from arrows that join two screens (`detectFlows`). Arrows that pass through diagram shapes don't join flows. The start screen is the one marked `isStart`. Otherwise it's the screen with no incoming links, or else the left-most screen.
- **Options**: `duplicateAsOption` copies the screens, their components, and the links and arrows *inside* the selection. Links that leave the selection aren't copied. The copy lands 200 px below the lowest lane of that flow. The original becomes "Option A" and the copy gets the next free letter. All options share one `flowId`. On the canvas, each option has a dashed lane outline and a label chip with a ▶ Play button.
- **Play** (proof only): opens the start screen of the selected option at 1:1, or the first option if nothing is selected. Linked components are real buttons you can reach with Tab. Keys: Esc exits, Backspace or ← goes back, → follows the screen's only link, R restarts.
- **Deleting cascades**: deleting a screen also removes its components, links into and out of it, and every arrow touching any of them. An option with no screens left disappears.

Code map: `src/flow/ops.ts` (pure model operations, 100% unit-tested), `adapter.ts` (BoardDoc → React Flow), `FlowCanvas.tsx`, `ScreenNode/KitNode/LaneNode/SketchEdge.tsx`, `PlayView.tsx`, `seed.ts` (sandbox board).

## Open questions for the Director
1. **Where should a new screen go when you pick "link to new screen"?** A) **To the right of the current screen, skipping occupied spots (built)** · B) Below the current screen when it already has an outgoing link (a branch) · C) Ask each time. _Recommendation: **A** now, add B in Phase 3 if branches feel cramped._
2. **Can a diagram shape (e.g. a process box) be clickable in Play?** A) **No, only components inside screens (built)** · B) Yes, any item can link to a screen. _Recommendation: **A**, because it keeps Play predictable._
3. **What happens to links that leave the copied flow?** For example, a "Help" button that links to a screen outside the flow. A) **Leave them out of the copy (built)** · B) Copy them so they still point at the original outside screen. _Recommendation: **A**, so each option stays self-contained. Revisit after the Gate 3 test._
4. **Should screen names in a copy change?** A) **Keep the same names; the lane chip shows the option (built)** · B) Add a suffix, e.g. "Sign up (B)". _Recommendation: **A**, because matching names make the steps line up in Compare._

## Risks
- **The real Compare and Play views are Phase 3 work.** What's here only proves that the data operations work.
- **Every move redraws all of the board's items.** That's fine at sandbox size. Before the 60-screen performance check, we need to switch to granular updates (Yjs).
- **Arrows don't route around obstacles.** An elbow arrow can cross another screen, as Whimsical's do, until we add smarter routing.
- **Flow names aren't saved yet.** A flow's name comes from its start screen ("Welcome flow"), so renaming needs a model change (below).
- **The link-dot marker and `SketchArrow` come from the Design System agent's in-progress primitives.** If their APIs change, `KitNode`/`SketchEdge` must be updated.

## Model / contract change requests (not made — for the Tech Architect)
- Add `flows?: Record<ID, { id; name; startFrameId? }>` (or a `name` on `VariantGroup`) so auto-detected flows can be **renamed** (Gate 1 D3).
- Consider replacing the simple padded-number `z` strings with real fractional indexes (e.g. `fractional-indexing`) when collaboration lands.

## Parking lot
- Adding a label by double-clicking an arrow; dragging an arrow end to a new item; resize handles.
- "New screen here" menu when a connection is dropped on empty canvas.
- Smart arrow routing around screens; auto-layout of option lanes.
- Simplified screens below ~40% zoom (performance plan §7).
- Synced side-by-side Compare panes (Phase 3).
