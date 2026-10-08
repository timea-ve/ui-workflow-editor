# FlowSketch — Product Brief (shared with all agents)

## Vision
A web app similar in spirit to Whimsical: a fast, calm, infinite-canvas tool where product people sketch **low-fidelity wireframes** and connect them with **diagram elements** (flows, arrows, decision points, notes) to **explore and compare different UI workflows**.

**Target users:** PMs, designers, founders, engineers thinking through user flows before high-fidelity design.

**Job-to-be-done:** "When I'm exploring how a feature should work, I want to sketch screens and link them into a flow, so I can compare alternative paths and align my team before anyone designs pixels."

## Design principles (non-negotiable)
1. **Lo-fi by design** – grayscale, sketchy/intentionally unpolished.
2. **Speed over power** – every common action in 1–2 clicks or a shortcut. No mandatory setup.
3. **Wireframes + diagrams are one thing** – a screen is a node in a flow; arrows connect screens and parts of screens.
4. **Exploration is first-class** – branching, alternatives ("Option A vs B"), side-by-side comparison.
5. **Calm, accessible UI** – keyboard navigable, WCAG AA contrast, no clutter.

## MVP scope
- Infinite canvas: pan, zoom, select, multi-select, snap/align guides, undo/redo, copy/paste.
- Wireframe kit: device frames (desktop, tablet, mobile) + lo-fi components (header, nav, button, input, checkbox, toggle, dropdown, card, list, table, image placeholder, text/heading, modal, tabs, icon placeholder).
- Diagram kit: rectangle, diamond/decision, circle/start-end, sticky notes, text, smart connectors (stay attached, with labels).
- Flow linking: connect a button/element inside a wireframe to another screen frame.
- Workflow variants: duplicate a flow as "Option B", label variants, view side by side.
- Prototype/click-through mode.
- Boards: create, rename, list in a dashboard. Autosave.
- Export board/selection to PNG/PDF. Share read-only link.
- Templates: 3–5 starter flows (sign-up, onboarding, checkout, settings, search).

## Later (design for, don't build)
Real-time collaboration/cursors/comments; AI "describe a flow → generate screens"; version history, teams, permissions.

## Out of scope
High-fidelity design tools, code export, native mobile apps.

## Quality bar
- New user creates a 3-screen linked flow in < 3 minutes without help.
- Smooth with 50+ screens on one board.
- Nothing lost on refresh.
- All core actions keyboard-accessible; WCAG AA contrast.
- Core flows have automated tests.
- README: run the app in one command.

## Rules for all agents
- Return structured output: Summary, Artifacts, Open questions (for the Director, as multiple-choice with a recommendation), Risks, Parking lot (ideas beyond scope — never expand scope).
- The Director is non-technical: include a plain-language summary.
- Inspiration only — never copy proprietary assets or branding.
