# Phase 3 — Build contracts (read before writing code)

Gate 2 outcomes that apply everywhere: **Clean lo-fi is the only product style** (`data-kit-style="clean"` on the app root; no Sketchy toggle in product UI). **Accent = violet** via existing tokens (never hard-code colours; use `var(--fs-*)`). Toolbar floats on the left; shortcut letters always shown. Paragraph text is linkable; table rows are not (v1); screen names sit above frames; "link to new screen" places it to the right; diagram shapes are not clickable in Play; option copies exclude links that leave the flow; copied screens keep names.

## Waves
- **Wave A (parallel now):** Canvas Core · Platform · Export/Share.
- **Wave B (after Canvas Core):** Wireframe-on-canvas (insert palette, inspector, inline text) · Connectors & Flows (link picker, flow names, Compare, Play).
- **Integration + Gate 3 demo** by the Orchestrator.

## Routes (`src/App.tsx` — Orchestrator owns)
| Route | Page file | Owner |
|---|---|---|
| `/` | `src/pages/DashboardPage.tsx` | Platform |
| `/b/:boardId` | `src/pages/EditorPage.tsx` | Canvas Core |
| `/s/:shareId` | `src/pages/SharePage.tsx` | Export/Share |
| `/dev`, `/gallery`, `/sandbox`, `/chrome` | existing dev previews | leave alone |

## File ownership (Wave A)
| Agent | Owns (create/edit freely) | May read only |
|---|---|---|
| Canvas Core | `src/store/**`, `src/editor/**`, `src/pages/EditorPage.tsx`, `src/flow/**` (FlowCanvas, adapter, nodes, edges, ops perf changes), `src/chrome/**` (wiring tweaks only), `e2e/editor*.spec.ts`, `docs/phase-3/canvas-core.md`, `docs/phase-3/editor-api.md` | everything else |
| Platform | `src/platform/**`, `src/pages/DashboardPage.tsx`, `src/dashboard/**`, `e2e/dashboard*.spec.ts`, `docs/phase-3/platform.md` | everything else |
| Export/Share | `src/export/**`, `src/share/**`, `src/pages/SharePage.tsx`, `server/**`, `vite.config.ts`, `e2e/share*.spec.ts`, `e2e/export*.spec.ts`, `docs/phase-3/export-share.md` | everything else |

Orchestrator-only: `package.json`/lockfile (no `npm install` by agents — needed packages are pre-installed: `fractional-indexing`, `html-to-image`, `jspdf`, `hono`, `@hono/node-server`, plus everything from Phase 2), `src/App.tsx`, `src/model/types.ts`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `docs/DECISION-LOG.md`, `docs/PROJECT-STATUS.md`. **Need a change there? Write it under "Requests to Orchestrator" in your doc.** Agents never `git commit`.

## Shared interfaces (fixed signatures)

### Data model — `src/model/types.ts`
`BoardDoc = { frames, elements, connectors, links, variants, flowNames }` (flat maps by id). `flowNames[flowId]` = user-given flow name (flow id = start screen id). `Board` metadata has `id, title, createdAt, updatedAt, templateId?` (+ `shareId?` — see below). All edits are pure functions `(doc) => doc` in `src/flow/ops.ts`; start from `emptyDoc()`.

### Board list — `src/platform/boardIndex.ts` (exists; Platform may extend, not break)
`listBoards() · getBoard(id) · createBoardMeta({title?, templateId?}) · updateBoardMeta(id, patch) · renameBoard(id, title) · touchBoard(id) · deleteBoardMeta(id) · subscribeBoards(cb)`. localStorage, synchronous.

### Board content — `src/store/persistence.ts` (stub exists; Canvas Core implements)
- `writeInitialDoc(boardId, doc): Promise<void>` — seed a new board (templates, duplicate).
- `readBoardDoc(boardId): Promise<BoardDoc>` — read without opening the editor (export, share, duplicate). Empty board → `emptyDoc()`.
- `deleteBoardData(boardId): Promise<void>`.
Content is a Yjs doc persisted with `y-indexeddb` (room name `fs-board-<id>`). Persistence must be generic over every top-level key of `BoardDoc` so new keys "just work".

### Read-only canvas (Canvas Core keeps this working)
`src/flow/FlowCanvas.tsx` keeps exporting `FlowCanvas` with props `{ doc, setDoc?, view, onSelectionChange?, readOnly? }`. With `readOnly` (or no `setDoc`) nothing is editable but pan/zoom/select still work. Export/Share uses this for the share view.

### Export — `src/export/exportBoard.ts` (Export/Share)
```ts
exportBoard(opts: {
  doc: BoardDoc; title: string;
  scope: 'board' | 'selection' | 'option'; selectionIds?: ID[]; variantId?: ID;
  format: 'png' | 'pdf'; background: 'white' | 'transparent';
}): Promise<Blob>
downloadBlob(blob: Blob, fileName: string): void
```
Renders from the **doc** (offscreen), not the live viewport, so it works from editor, dashboard and share view. UI: `src/export/ExportDialog.tsx` — props `{ open, onOpenChange, doc, title, selectionIds?, currentVariantId? }`.

### Share — Export/Share
- API (Hono app in `server/shareApi.ts`, mounted in Vite dev/preview via plugin in `vite.config.ts`; store = JSON files in `.data/shares/` (gitignored); swappable for Postgres later):
  - `POST /api/shares {title, doc}` → `{id, editToken}` (id: 22-char unguessable)
  - `PUT /api/shares/:id` (header `x-edit-token`) → update snapshot (re-share keeps same link)
  - `DELETE /api/shares/:id` (token) → revoke
  - `GET /api/shares/:id` → `{title, doc, updatedAt}` or 404/410
  - Limits: 5 MB body, basic per-IP rate limit, `X-Robots-Tag: noindex`.
- Client `src/share/client.ts`: `publishShare(boardId, title, doc) → {url}` (creates or updates; remembers id+token per board in localStorage `fs:shares:v1`), `revokeShare(boardId)`, `getShareState(boardId)`, `fetchShare(id)`.
- UI `src/share/SharePopover.tsx` — props `{ boardId, title, getDoc: () => BoardDoc }`; toggle "Anyone with the link can view" → Copy link (toast). Orchestrator mounts it in the editor top bar.

### Templates — `src/platform/templates/` (Platform)
`TEMPLATES: TemplateDef[]` with `{ id, name, description, screenCount, build(): BoardDoc }`; ids `signup, onboarding, checkout, settings, search`. Built only with `src/flow/ops.ts` + real kit types, using linked buttons so Play works. Template boards create via `createBoardMeta` + `writeInitialDoc`.

### Editor API — `src/editor/` (Canvas Core) for Wave B
Canvas Core documents in `docs/phase-3/editor-api.md` a `useEditor()` hook that Wave B builds on: current `doc`, `apply(op, {label})` (undoable), `undo/redo`, `selection` + `setSelection`, `tool` + `setTool`, viewport helpers (`screenToFlow`, `viewportCenter`, `zoomToFit`, `zoomToNodes`), `announce(msg)` for screen readers, and named layout slots (left panel, right panel/inspector, top-bar actions, overlays) so Wave B can mount UI without editing the editor layout.

## Testing
- Unit: Vitest (`npm test`) — `src/**/*.test.ts(x)` and `server/**/*.test.ts` (use `// @vitest-environment node` there).
- E2E: Playwright (`npm run e2e`, port 5180, dev server auto-started/reused). Name files per ownership above. Chromium is installed.
- Before finishing: `npx tsc -b`, `npm test`, your own e2e specs, `npm run lint` — all green (warnings OK). Another agent may be editing in parallel: if a failure is clearly in their files, report it, don't fix it.

## Output (every agent)
`docs/phase-3/<agent>.md`: summary (plain language, ≤5 bullets), what's built + how to try it, tests added, open questions, risks, Parking lot, Requests to Orchestrator.
