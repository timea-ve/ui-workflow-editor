# UI Workflow Editor (formerly FlowSketch) — Project Status

_Last updated: 2026-10-09_

| | |
|---|---|
| **Current phase** | ✅ MVP launched (all 4 gates approved) |
| **Next gate** | None — next steps come from the parking lot |

## Done
- Phase 1 discovery; ⛳ Gate 1 approved
- Phase 2 kits; ⛳ Gate 2 approved (Clean lo-fi, violet accent, all other recommendations)
- Phase 3 build; ⛳ Gate 3 approved (round 3: Miro-style lines for all boards)
- Phase 3 setup: build contracts ([phase-3/CONTRACTS.md](phase-3/CONTRACTS.md)), app routes (`/`, `/b/:id`, `/s/:id`), board list, test setup

- Wave A ✅: real editor (autosave, undo/redo, snapping, copy/paste, shortcuts; 60 screens smooth), dashboard + 5 templates, PNG/PDF export, share links + share page. 354 unit + 25 end-to-end tests passing.

- Wave B ✅: components on canvas (insert /, properties panel, text editing, resizing), linking (L), flows panel, Option A/B (⇧D), Compare (⇧C), Play (P). 401 unit + 38 end-to-end tests passing, including a robot run of the Gate 3 task.

- Wave C ✅ (Director's Gate 3 changes): 40 wireframe components + 70 icons in 6 palette sections, context bar replaces the properties panel, grid + neighbour + equal-gap snapping, muted grey components. 926 unit + 43 end-to-end tests passing.

- Gate 3 round 3 changes ✅: labels over lines, ⌘Y and undo/redo buttons, Miro-style line routing (Onboarding Skip fixed). 938 unit + 44 end-to-end tests passing.

- Phase 4 ✅: keyboard + WCAG AA + 3-browser checks, 4× faster lines, dashboard code halved, copy pass, first-run tour. 947 unit + 66 end-to-end tests passing.

- Ask Copilot for a flow ✅: describe a flow to Copilot (github.com or the Copilot app) and get a link that opens it as a new editable board — see [AGENT-FLOWS.md](AGENT-FLOWS.md). 997 unit + 67 end-to-end tests passing.

## In progress
- ⛳ Gate 4 approved — see [gates/GATE-4.md](gates/GATE-4.md). Live: https://timea-ve.github.io/ui-workflow-editor/ · Code: https://github.com/timea-ve/ui-workflow-editor (CI green) — see [gates/GATE-3.md](gates/GATE-3.md)

## Blocked
- Nothing

## Up next
- ⛳ Gate 4: quality checklist + deploy plan
