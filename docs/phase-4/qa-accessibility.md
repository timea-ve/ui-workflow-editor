# Phase 4 – Quality & Accessibility report

_Owner: QA & Accessibility agent · Audience: Director_

## Summary

FlowSketch now has automated tests proving it can be used **with a keyboard alone**. It passes an automated **WCAG 2.1 AA** accessibility scan, including colour contrast, on every main screen and dialog. It also works in **Chrome, Firefox and Safari's engine (WebKit)** for the core path: open, play, autosave.

The keyboard walkthrough surfaced five real accessibility bugs: missing focus rings and "lost" keyboard focus after closing popups. All five are fixed. No visible wording and no product behaviour was changed.

**Test totals at sign-off**

| Suite | Result |
|---|---|
| Unit tests (Vitest) | **951 passed** (33 files) |
| End-to-end tests (Playwright, Chromium full suite + Firefox/WebKit smoke) | **68 passed**, 0 failed |
| Type check (`tsc -b`) | clean |
| Lint (`oxlint`) on `src/` and `e2e/` | 0 errors (warnings only, pre-existing) |

19 of those e2e tests are new in this phase:
- Keyboard walkthrough: 1
- Accessibility scans: 7
- Cross-browser smoke: 1 test × 3 browsers
- Core-flow gap tests: 8

## Quality checklist (Definition of Done)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Whole core flow is possible with keyboard only | ✅ Pass | `e2e/a11y-keyboard.spec.ts`. The flow, with no mouse: dashboard → new board → 3 screens → insert button → link button→screen 2 and screen 2→screen 3 → duplicate as Option B → Compare → Play through → Export dialog → undo/redo. |
| 2 | Visible focus ring on everything you can Tab to | ✅ Pass (after fix) | The keyboard spec checks for a visible outline or halo at every step, including canvas screens and links. |
| 3 | Focus never gets "lost" after closing a dialog or popup | ✅ Pass (after fix) | The keyboard spec checks that focus never drops to the page body after Insert, Export, Shortcuts, link picker, Play and Compare. |
| 4 | WCAG 2.1 AA automated scan, no violations | ✅ Pass | `e2e/a11y-axe.spec.ts` (7 tests). Covers: dashboard (empty and with boards); editor (empty, and template with a selection); Insert, Export and Shortcuts dialogs; link picker, Play, Compare; share page with its Export and Play; Share popover. |
| 5 | Colour contrast AA (accent stays violet #5b3fd1) | ✅ Pass | Axe colour-contrast rule is on in all scans. Design-token pairs are unit-tested in `src/design/contrast.test.ts`. Violet unchanged. |
| 6 | Works in Chrome, Firefox, Safari engine | ✅ Pass | `e2e/smoke.spec.ts` runs in all three browsers: open dashboard → open template → play a link → add a screen → reload → work is still there. |
| 7 | Create board / add screens | ✅ Covered | `dashboard.spec.ts`, `editor.spec.ts`, keyboard spec |
| 8 | Link button → screen | ✅ Covered | `flows.spec.ts`, keyboard spec |
| 9 | Option A/B variants | ✅ Covered | `flows.spec.ts`, keyboard spec |
| 10 | Compare | ✅ Covered | `flows.spec.ts`, keyboard spec, axe spec |
| 11 | Play (click-through) | ✅ Covered | `flows.spec.ts`, keyboard spec, `core-flows.spec.ts` (all templates), smoke |
| 12 | Export PNG / PDF | ✅ Covered (gap filled) | **New:** `core-flows.spec.ts` exports PNG and PDF from the editor and checks the real file bytes. Share-page export was already covered. |
| 13 | Share read-only link | ✅ Covered (gap filled) | **New:** `core-flows.spec.ts` turns sharing on in the editor, opens the link and checks it shows the same screens, can't be edited and is hidden from search engines. |
| 14 | Autosave | ✅ Covered | `editor.spec.ts`, smoke (all 3 browsers) |
| 15 | 5 templates | ✅ Covered (gap filled) | **New:** `core-flows.spec.ts` opens each template, checks it has screens and links, and plays one link. |
| 16 | Undo / redo | ✅ Covered (gap filled) | Keyboard shortcuts already tested. **New:** the on-screen Undo/Redo buttons are now tested. |

## What I fixed

1. **No focus ring on canvas screens and links.** React Flow's built-in styles switched the outline off. Keyboard users couldn't see which screen or link they were on. They now get the standard violet focus ring. (`src/flow/flow.css`)
2. **Enter acted on the wrong screen.** After Tabbing to a new screen, Enter renamed the _previously_ selected screen. Enter now selects the focused one first. (`CanvasLayer.tsx`, `FlowsRoot.tsx`)
3. **Focus was lost after choosing a link target.** Focus now returns to the screen or button you were linking from. (`FlowsRoot.tsx`)
4. **Focus was lost after closing any dialog** (Insert, Export, Shortcuts). Keyboard and screen-reader users were dropped back at the top of the page. Focus now returns to where they were. (new `src/chrome/returnFocus.ts`, wired into the three dialogs)
5. **Low-contrast "React Flow" credit link** (2.7:1, needs 4.5:1). Recoloured to our muted text colour. (`flow.css`)
6. **Undo/redo panel had a label but no role**, so screen readers ignored the label. Marked it as a group. (`UndoRedo.tsx`)
7. **A test that broke in Firefox and Safari** (rename Option B) relied on screen order. Off-screen lanes aren't drawn, so the order changes after zooming. The test now finds the lane by name. Not an app bug. (`e2e/flows.spec.ts`)

## Known exclusions (with justification)

- **Mini-map** (`.react-flow__minimap`) is excluded from scans. It's a decorative, mouse-only overview made by the React Flow library, and it repeats what's already on the canvas.
- **Wireframe content on the canvas:** axe can't measure contrast for text drawn over SVG, so it reports these as "needs review", not failures. Our sketch colours are covered by the contrast unit tests instead.
- **React Flow zoom controls:** axe flags a label on a box with no role as "needs review". The library doesn't let us set the role. Low impact, because the buttons inside have their own labels.

## Open questions (Director decision)

1. **React Flow credit link.** It's a small "React Flow" link in the canvas corner, shown by default. Keyboard users Tab onto it after the canvas. Hiding it is allowed under React Flow's MIT licence, but the library authors ask that you only do so if you sponsor them or have a Pro subscription. **Keep or hide?** Keeping it is fine for accessibility now that its contrast is fixed.
2. **Safari keyboard default.** Out of the box, Safari's Tab key skips buttons; users need Option+Tab or a Safari setting. This affects every website, not just us, so we left it as-is. Should we mention it in Help or Shortcuts? (A wording change, for the Copy agent.)

## Risks

- **Canvas contrast is checked by unit tests, not by the scanner** (see exclusions). New sketch colours must be added to `contrast.test.ts`.
- **Parallel editing.** Several agents changed the code at the same time this phase. All suites pass at sign-off, but a test can occasionally fail while another agent's edit is reloading. Re-run once before treating it as a real failure.
- **`npm run lint` exits with errors** only because it also scans the Performance agent's temporary build folders (`dist-perf-before/`, `dist-perf-after/`). Our source code has 0 lint errors. Those folders should be deleted or ignored before merge.
- **Firefox and WebKit run only the smoke test** by design. Some other specs depend on Chrome's Tab behaviour; under WebKit's default, the Play keyboard test needs Option+Tab. They aren't app bugs, but non-Chromium keyboard coverage is lighter.

## Notes for other agents

- **Copy & Onboarding:** no visible text changed. The board title button's accessible name says "Press Enter to rename". Fine for now; check it still matches if the wording changes. Please keep new dialogs and the first-run tour returning focus on close: use `useReturnFocus(open)` from `src/chrome/returnFocus.ts`.
- **Performance:** no edits to your files. Please delete or lint-ignore `dist-perf-*` folders.

## Parking lot (ideas, not done – out of scope)

- After placing a new screen with the keyboard, focus stays on the page rather than moving to the new screen. Shortcuts still work, but a screen-reader user isn't told where they are.
- A "Skip to canvas" link would save keyboard users about 10 Tab presses past the top bar and toolbar.
- Esc steps back one level at a time (tool → parent → clear selection). It's logical, but it can take 2–3 presses to fully clear, which some users may find surprising.
- Use a `role="application"` description or an on-canvas hint to tell screen-reader users that arrow keys move screens.
