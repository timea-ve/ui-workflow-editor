# FlowSketch — Decision Log

Technical decisions are made by the Orchestrator; product/design decisions by the Director. Each entry: what, why (plain language), who.

| # | Date | Decision | Why (plain language) | Owner | Status |
|---|------|----------|----------------------|-------|--------|
| 1 | 2026-10-08 | All planning docs live in `docs/` in the repo | One place you can read everything, versioned with the code. | Orchestrator | ✅ |
| 2 | 2026-10-08 | TypeScript + React + Vite web app | The most common, best-supported way to build web apps today. | Orchestrator | ✅ |
| 3 | 2026-10-08 | Board data stored with Yjs (autosave to browser via IndexedDB) | Saves every change instantly and lets us add live collaboration and history later without rebuilding. | Orchestrator | ✅ |
| 4 | 2026-10-08 | Share links via a small API on Vercel + Supabase Postgres | Cheapest, simplest way to put a read-only copy online. | Orchestrator | ✅ |
| 5 | 2026-10-08 | PNG/PDF export made in the browser (html-to-image + jsPDF) | No extra server to run or pay for. | Orchestrator | ✅ |
| 6 | 2026-10-08 | Tests: Vitest (logic), Playwright (real browser), axe (accessibility) | Automatically checks features and accessibility on every change. | Orchestrator | ✅ |
| 7 | 2026-10-08 | Radix UI + CSS variables (design tokens) for app chrome | Accessible menus and dialogs out of the box; tokens make the two style options a single switch. | Orchestrator | ✅ |
| 8 | 2026-10-08 | Canvas library: React Flow | Free and fits "buttons link to screens" exactly. | Director (Gate 1 D7) | ✅ |
| 9 | 2026-10-08 | Positioning (internal): "Whimsical for wireframes, but built to compare Option A vs Option B from day one" | Leads with our unique gap. | Director (Gate 1 D1) | ✅ |
| 10 | 2026-10-08 | Options = labelled copies stacked as lanes on the same board | Visible, simple, works with Compare and export. | Director (Gate 1 D2) | ✅ |
| 11 | 2026-10-08 | Flows auto-detected from links, renameable | Zero setup. | Director (Gate 1 D3) | ✅ |
| 12 | 2026-10-08 | Compare = synced side-by-side panes (diff overlay later) | Matches MVP wording; cheap to build. | Director (Gate 1 D4) | ✅ |
| 13 | 2026-10-08 | Links use the same arrow + a "clickable" marker on the source | Wireframes and diagrams are one thing. | Director (Gate 1 D5) | ✅ |
| 14 | 2026-10-08 | No accounts in MVP; boards on device; share links account-free | Fastest path to first value. | Director (Gate 1 D6) | ✅ |
| 15 | 2026-10-08 | npm (bundled with Node) instead of pnpm; single app folder | Nothing extra to install; simpler for one-command run. Share-link API added in Phase 3. | Orchestrator | ✅ |
| 16 | 2026-10-08 | Self-hosted open-licence fonts (Kalam, Inter) and lucide icons (ISC) | No dependence on outside servers; free to use commercially. | Orchestrator | ✅ |
| 17 | 2026-10-08 | Both styles drawn through one set of shared drawing primitives | Switching style is one setting, never per-component work. | Orchestrator | ✅ |
| 18 | 2026-10-08 | Visual style: **Clean lo-fi** (straight grey lines, Inter) as the default | Tidier and more presentable. Sketchy code stays dormant (possible per-board switch later — parking lot). | Director (Gate 2 V1) | ✅ |
| 19 | 2026-10-08 | Accent colour: **Violet #5b3fd1** (6.83:1 on white) | More distinctive; passes AA. | Director (Gate 2 V3) | ✅ |
| 20 | 2026-10-08 | Handwritten font question dropped | Not needed with Clean style. | Director (Gate 2 V2) | ✅ |
| 21 | 2026-10-08 | Toolbar floating left; shortcut letters always shown | Keeps top bar free; teaches shortcuts. | Director (Gate 2 V4, V5) | ✅ |
| 22 | 2026-10-08 | Paragraph text linkable; no auto-dim behind modals; table rows not linkable in v1; screen name above frame | Recommendations accepted. | Director (Gate 2 K1–K4) | ✅ |
| 23 | 2026-10-08 | New linked screen goes to the right; diagram shapes not clickable in Play; option copies exclude links leaving the flow; copied screens keep names | Recommendations accepted. | Director (Gate 2 F1–F4) | ✅ |
| 24 | 2026-10-08 | Phase 3 runs in two waves: editor core, dashboard and export/share in parallel first; canvas components and flows second | Dashboard and export don't depend on the editor, so this saves time without collisions. | Orchestrator (tech) | ✅ |
| 25 | 2026-10-08 | Share links served by a tiny built-in server during development (files on disk), same code deploys to Vercel later | Keeps "one command to run" with no accounts or secrets. | Orchestrator (tech) | ✅ |
| 26 | 2026-10-08 | Exports render from the saved board, not the screen you see | Exports look the same no matter where you're zoomed. | Orchestrator (tech) | ✅ |
| 27 | 2026-10-08 | Screens resize in height only; width follows the device | Keeps screens true to device size; taller screens act as scrolling pages. | Orchestrator (UX detail within Gate 2 kit) | ✅ |
| 28 | 2026-10-08 | Shortcuts: ⇧D duplicate as option, ⇧C compare, P play, L link, / insert | One key each for the core loop; all listed in the ? dialog. | Orchestrator | ✅ |
| 29 | 2026-10-08 | After "link to new screen", the view glides to show both screens | You always see what you just made. | Orchestrator | ✅ |
| 30 | 2026-10-08 | Arrows from a button leave its screen on the side facing the target | Avoids lines doubling back across the screen. | Orchestrator | ✅ |
| 31 | 2026-10-08 | Option labels sit inside the lane's top-left corner | Always visible after "fit to screen". | Orchestrator | ✅ |
| 32 | 2026-10-08 | Kit expanded to the Director's full list (~45 components): text, actions, inputs, navigation, content and layout incl. charts, feedback and overlays | Covers the screens product teams actually sketch. | Director (Gate 3 feedback) | ✅ |
| 33 | 2026-10-08 | A small context bar on the selection replaces the right-hand properties panel | Calmer; options sit next to what you're editing. | Director (Gate 3 feedback) | ✅ |
| 34 | 2026-10-08 | Muted grey palette for all components; snap to an 8px grid and to neighbours | Screens read as "thinking", and things line up without effort. | Director (Gate 3 feedback) | ✅ |
| 35 | 2026-10-08 | Real icon set (curated open-licence lucide icons) usable on its own or inside components | Wireframes, shapes, arrows and icons on one canvas. | Director (Gate 3 feedback) / Orchestrator (icon source) | ✅ |
| 36 | 2026-10-08 | Context bar shows up to 3 options inline; selects open as small menus; the rest go under ⋯. ⌘. focuses the bar | Stays small and readable; keyboard reachable. | Orchestrator | ✅ |
| 37 | 2026-10-08 | "Active / selected item" options pick by name from the item list (not a number) | Nobody should have to count from 0. | Orchestrator | ✅ |
| 38 | 2026-10-08 | Snap order: neighbours → equal gaps → 8px grid; dot grid every 24px, hidden when zoomed far out; Alt turns snapping off | Lines up without effort; calm background. | Orchestrator | ✅ |
| 39 | 2026-10-08 | Kit components never use the violet accent (selected states use dark grey fills) | Accent stays reserved for the app itself (selection, links, Play). | Orchestrator | ✅ |
| 40 | 2026-10-09 | Line labels sit above the lines | Labels stay readable. | Director (Gate 3 round 3) | ✅ |
| 41 | 2026-10-09 | ⌘Y redo (⌘⇧Z kept) plus Undo/Redo buttons on the board | Familiar shortcut, and undo is visible to people who don't use shortcuts. | Director (Gate 3 round 3) | ✅ |
| 42 | 2026-10-09 | Miro-style line routing: lines go around screens, choose sides automatically, have rounded corners, hop over crossings and keep separate lanes. Lines sharing a side get separate, ordered attachment points. Straight and curved line styles are unchanged | Flows are readable at a glance; Skip no longer merges with Next. | Director (Gate 3 round 3) — approved, applies to all lines | ✅ |
| 43 | 2026-10-09 | Routing runs once per board change and is cached; while you drag, lines use the simple path and switch to the routed path when you let go | Keeps big boards smooth. | Orchestrator (tech) | ✅ |
