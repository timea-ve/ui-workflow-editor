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
| 7 | 2026-10-08 | Radix UI + Tailwind for app chrome | Accessible menus and dialogs out of the box, consistent calm styling. | Orchestrator | ✅ |
| 8 | 2026-10-08 | Canvas library: React Flow (proposed) | Free and fits "buttons link to screens" exactly; pending Director call (cost/timeline). | Director (Gate 1 D7) | ⏳ |
