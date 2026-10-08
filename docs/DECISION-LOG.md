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
