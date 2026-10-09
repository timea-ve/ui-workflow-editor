# Phase 3 — Export & Share

Owner: Export/Share agent. Scope per `CONTRACTS.md` (Export, Share, Read-only canvas).

> **Update (Phase 4, Decision Log #49):** share links no longer use a server. The link itself carries the board:
> `{title, doc}` as JSON → `CompressionStream('deflate-raw')` → base64url, in the URL fragment:
> `<origin><base>s/v1#<data>` (`v1` is the format version). The fragment is never sent to any server.
> The share page decodes it (`src/share/link.ts`), checks it with the same shape validation as before
> (moved to `src/share/validate.ts`) and shows the usual read-only board, Play and Export. A cut-off or
> garbled link shows "This link is incomplete."; old `/s/<id>` server links show "This link is no longer active."
> In the popover, "Update link" makes a new link with the latest changes, and turning sharing off only
> forgets the link on this device — links already sent keep working. A 60-screen board (stress fixture)
> makes a ~40k-character link. The app is hosted on GitHub Pages (#48); `server/` is kept but no longer
> mounted in `vite.config.ts`. "How to try" steps 2–4 and the API, Deploy and Security sections below describe that legacy server.
>
> **Flow links (Decision Log #52–53):** `<base>new/v1#<data>` uses the same compression (`compressJson` in
> `src/share/link.ts`) but carries a flow spec (`flows/*.json`), not a board. Opening it builds the board
> (`src/platform/flowSpecBoard.ts`), saves it as a **new editable** board and opens the editor. See `docs/AGENT-FLOWS.md`.

## In plain words

- **Export:** you can save the whole board, just the selected screens, or one option (A/B) as a crisp PNG (2× resolution) or a PDF. Margins, screen names, arrows and labels are included.
- **Share:** turning on "Anyone with the link can view" uploads a **read-only copy** of the board and gives you a link. "Update link" sends your latest changes. Turning it off kills the link for everyone.
- **The link page** (`/s/…`) shows the board in view-only mode. Viewers can pan, zoom, click **Play** to tap through the prototype, and export a PNG. Search engines are asked not to index it.
- **It runs with one command** (`npm run dev`): the small share server runs inside the dev server, and nothing needs signing up for. The same server code can be deployed to Vercel later.
- **Tests:** 38 unit tests and 9 browser tests cover this; all pass.

## How to try

1. `npm run dev` and open the app.
2. **Share view, no editor needed:**
   ```sh
   curl -s localhost:5173/api/shares -H 'content-type: application/json' \
     -d '{"title":"Demo","doc":{"frames":{"a":{"id":"a","kind":"frame","name":"Home","device":"mobile","x":0,"y":0,"w":375,"h":812,"z":"a0"}},"elements":{},"connectors":{},"links":{},"variants":{},"flowNames":{}}}'
   # → {"id":"…","editToken":"…"}  then open http://localhost:5173/s/<id>
   ```
3. In the share view: **Play**, **Zoom to fit** (⇧1), **Export PNG**. In dev, `/s/<id>?formats=png,pdf` also offers PDF (this is the test harness for the export dialog).
4. Turn a link off: `curl -X DELETE localhost:5173/api/shares/<id> -H 'x-edit-token: <token>'`, then reload. You'll see "This link is no longer active."
5. In the editor: once the Orchestrator mounts `SharePopover` and `ExportDialog` (see Requests), use **Share** in the top bar and **⌘/Ctrl+Shift+E**.

## What's where

| File | What |
|---|---|
| `src/export/scope.ts` | Pure helpers: `scopeDoc` (board / selection / option), `contentBounds` (includes screen-name labels and lanes), `capPixelRatio`, `pdfPageSize`, `exportFileName`, connector geometry |
| `src/export/StaticBoard.tsx` | A static, non-interactive board renderer (frames via `DeviceFrame`, elements via `ElementView`, lanes, link badges, connectors with labels) in the Clean style |
| `src/export/exportBoard.ts` | `exportBoard(opts) → Blob` and `downloadBlob(blob, name)` (CONTRACTS signatures) |
| `src/export/ExportDialog.tsx` | Radix dialog; `useExportShortcut(open)`; remembers the last choice in `localStorage['fs:export:v1']` |
| `src/share/client.ts` | `publishShare` (builds the link), `revokeShare` (forgets it), `getShareState`; stores `{id, url, publishedAt}` per board in `localStorage['fs:shares:v2']`; keeps `Board.shareId` in sync |
| `src/share/link.ts` | `encodeShare` / `decodeShare` (deflate-raw + base64url, 20 MB decompressed cap, validation), `sharePath` |
| `src/share/SharePopover.tsx` | `SharePopover({boardId, title, getDoc})` with a Share button and a non-modal popover (`SharePanel` can be embedded on its own) |
| `src/share/ReadOnlyBoard.tsx` | Read-only React Flow board (same node/edge components as `FlowCanvas`) |
| `src/pages/SharePage.tsx` | `/s/v1#<data>` |
| `server/shareApi.ts` | Hono app `createShareApi({store, rateLimit?})` |
| `server/store.ts` | `ShareStore` interface, `FileShareStore` (`.data/shares/<id>.json`, gitignored), `MemoryShareStore` (tests) |
| `src/share/validate.ts` | BoardDoc shape validation (`server/validate.ts` re-exports it) |
| `server/vitePlugin.ts` | Mounted the API in `vite` dev and `vite preview` (no longer used) |
| `server/vercel.ts` | Vercel Functions entry (not deployed) |

### How export works

1. Take the in-scope part of the doc (`scopeDoc`) and measure its bounds.
2. Mount `StaticBoard` in a hidden, fixed-size container off-screen (`createRoot` + `flushSync`). This uses the **doc**, not the live canvas, so it works for any zoom or scroll position and has no virtualisation gaps.
3. Wait for `document.fonts.ready` and one animation frame.
4. Render with `html-to-image` `toCanvas`. The embedded font CSS is cached; if fonts can't be embedded, the export still runs without them.
5. Produce the file:
   - **PNG:** `canvas.toBlob`.
   - **PDF:** jsPDF with one page sized to the content (px × 0.75 = pt, capped at 14,400 pt per side), orientation picked automatically, always on a white background.
6. **Pixel ratio:** 2×, reduced as needed so the image stays within 16,000 px per side and 64 MP in total, keeping the aspect ratio.
7. **File name:** `"<board title> – <Whole board|Selection|Option label>.png|pdf"`. Characters that are illegal on any OS are stripped, and an empty title becomes "FlowSketch board".

The dialog lazy-loads html-to-image and jsPDF, so they cost nothing until someone exports.

## API reference

Base: `/api/shares`. JSON in and out. Every response includes:

- `X-Robots-Tag: noindex, nofollow`
- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`

| Method | Path | Body / headers | Success | Errors |
|---|---|---|---|---|
| POST | `/api/shares` | `{title?, doc}` | **201** `{id, editToken}` | 400 invalid, 413 > 5 MB, 429 |
| PUT | `/api/shares/:id` | `x-edit-token`, `{title?, doc}` | 200 `{id, updatedAt}` | 400, 403 bad/missing token, 404, 410 revoked, 413, 429 |
| DELETE | `/api/shares/:id` | `x-edit-token` | 200 `{id, revoked: true}` | 403, 404, 410, 429 |
| GET | `/api/shares/:id` | — | 200 `{title, doc, updatedAt}` | 404, 410 |

Details:

- **ids:** 22-char nanoid (~131 bits). Malformed ids return 404 without touching storage.
- **`editToken`:** 32 random bytes (base64url, 43 chars). It is returned once, and only its SHA-256 is stored.
- **`title`:** optional; trimmed and limited to 200 chars.
- **`doc` validation:** must be an object. Each of `frames`, `elements`, `connectors`, `links`, `variants`, `flowNames` must be a map of records with the right field types, and each record's `id` must equal its key. Missing collections become `{}`. At most 50k records.
- **Revoke:** the snapshot is deleted and a tombstone remains, so the link answers **410** from then on.
- **Client extras (additive to CONTRACTS):**
  - `publishShare` returns `{url, id, created}`. If the old link is gone (403/404/410), it silently creates a new one.
  - `revokeShare` treats an already-gone link as success.
  - `ShareError.kind` is one of: `not-found | revoked | too-large | rate-limited | network | server`.
  - `ExportDialog` has optional props `formats` (default both) and `notify` (use the host's toasts).

## Deploy notes (not deployed)

- **Vercel:** add `api/shares/[[...path]].ts` containing
  `export { GET, POST, PUT, DELETE } from '../../server/vercel';`
  The static app deploys as usual (`vite build`). Add an SPA rewrite so `/s/*` serves `index.html`.
- **Storage:** Vercel's filesystem is read-only, so `FileShareStore` is for local and preview use only. Before going live, implement `ShareStore` (just `get` and `put`) on Supabase Postgres:
  - table `shares(id text pk, title text, doc jsonb, token_hash text, created_at, updated_at, revoked_at)`
  - wire it in `server/vercel.ts` (it currently uses `MemoryShareStore` as a placeholder)
  - secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Vercel env vars, never in the client
- **Rate limit on Vercel:** the in-memory limiter works per warm instance. For real abuse protection, move it to Upstash Redis or Vercel's firewall rules.
- **Estimated cost:**

  | Usage | Hosting | Supabase | Total |
  |---|---|---|---|
  | Demo | Vercel Hobby, free | free tier | **≈ $0/mo** |
  | ~100 active users | Vercel Pro $20 | free–$25 | **≈ $20–45/mo** |
  | ~1k active users | Vercel Pro $20 + usage | Supabase Pro $25 | **≈ $45–70/mo** |

  Snapshots are about 50–500 KB each, so storage is negligible.

## Security notes

- **Unguessable links:** 22-char random ids (~131 bits). Links are not listed anywhere, and `noindex` is set both as a header and as `<meta name="robots">` on `/s/:id`.
- **Ownership = edit token:** it lives only in the owner's browser (`localStorage`). The server stores just its SHA-256 and compares with `crypto.timingSafeEqual`. Losing the browser data means you can no longer update or turn off that link (see Open questions).
- **Limits:** request body over 5 MB → 413 (checked before parsing), at most 50k records, title ≤ 200 chars, strict shape validation. Unknown extra top-level keys are kept (forward compatibility), but the viewer only renders known collections.
- **Rate limit:** 30 writes per minute per IP (POST/PUT/DELETE), fixed window, 429 with `Retry-After`. The IP comes from `x-forwarded-for`, which is reliable behind Vercel but spoofable when the server is exposed directly. It is in-memory per process.
- **Revoked links:** the doc is deleted, not just hidden. A tombstone keeps answering 410.
- **File store:** the id is re-validated before building a path (no path traversal), and writes go through a temp file plus rename.
- **XSS:** the viewer renders data through React (no `dangerouslySetInnerHTML`). Snapshots are `no-store` with `nosniff`.
- **Out of scope:** no accounts and no analytics. Links don't expire (see Parking lot).

## Tests

| Suite | Count | Covers |
|---|---|---|
| `server/shareApi.test.ts` (node env, in-memory store) | 10 | create/get; update with token; wrong/missing token 403; revoke → GET/PUT 410 and doc dropped; unknown/malformed (path-traversal) id 404; > 5 MB 413; invalid payloads 400; writes over the limit 429 with Retry-After (other IPs and reads unaffected); exact token match; validation defaults |
| `src/export/scope.test.ts` | 21 | scope selection (board / selection / lane / option; children; connectors between kept nodes; orphan elements made absolute), bounds incl. title labels / lanes / loose elements, pixel cap (16k side, 64 MP), PDF page size and orientation, file naming and sanitising, prefs round-trip, `effectiveScope`, Mod+Shift+E |
| `src/share/client.test.ts` (mocked fetch) | 7 | first publish POST and storage and `shareId`, republish PUT with token, 410 → new link, error kinds (413/429/offline), revoke clears state and `shareId`, network error keeps state, `fetchShare` kinds |
| `e2e/share.spec.ts` | 6 | renders 2 screens + 3 elements + 1 arrow; banner; noindex meta; can't drag; Zoom to fit; Play → hotspot → Details → Back → Esc; revoked and unknown links show "no longer active"; updated link shows the new title; empty board; server down → Try again |
| `e2e/export.spec.ts` | 3 | PNG download (correct name, PNG signature, > 10 KB, 2× width); PDF download via the dev harness (`%PDF-`, > 10 KB); selection-only export is narrower |

Final run:

- `npx tsc -b`: clean.
- `npm test`: 348/348 across 17 files, including other agents' tests.
- `npx playwright test e2e/share e2e/export`: 9/9.
- `npm run lint`: exit 0, warnings only.

## Risks

- **Fonts in exports:** html-to-image embeds the web fonts it finds. If that fails (CORS, offline), the export falls back to system fonts rather than failing.
- **Very large boards:** the pixel cap keeps the canvas valid, but a 64 MP capture can take seconds and lots of memory on low-end devices. The dialog shows progress, and its error copy suggests exporting a selection.
- **Read-only canvas is a thin copy:** `ReadOnlyBoard` reuses Canvas Core's node and edge components and adapter but has its own `<ReactFlow>`. If `FlowCanvas` gains canvas-level behaviour (e.g. new context values), the share view could drift. The fix is to swap to `FlowCanvas readOnly` (see Requests).
- **Static export renderer vs canvas:** `StaticBoard` mirrors the canvas look (same `DeviceFrame`, `ElementView` and edge path maths). Visual changes to lanes or edges in `src/flow` may need a matching tweak there.
- **Rate limit and store are per process:** fine locally. Production needs Supabase plus a shared limiter.

## Open questions

1. **Lost edit token:** if the owner clears browser data, they can no longer turn off the link. Options: a "report/remove" contact path, or link expiry (Parking lot).
2. **Selected or remembered option on the share view:** should viewers get an "Export current option" choice? For now the share view offers Whole board and Selection only.
3. **Should the share view expose PDF to viewers?** The brief says PNG only. The PDF path is fully built (dev flag), so enabling it is a one-line change.

## Parking lot

Accounts and "my links" list · live sync / live-updating links · view analytics · password-protected links · link expiry · server-side (headless) export for huge boards · SVG export · multi-page PDF (one page per flow) · embed code.

## Requests to Orchestrator

1. **tsconfig:** add `{ "path": "./server/tsconfig.json" }` to the root `tsconfig.json` `references`, so `tsc -b` also checks `server/**`.
   - Today the server is type-checked transitively via `tsconfig.node.json` (through `vite.config.ts`) and directly with `npx tsc -p server/tsconfig.json --noEmit`; both are clean.
2. **Editor top bar:** replace TopBar's placeholder Share button with
   `<SharePopover boardId={id} title={title} getDoc={() => doc} />` (from `src/share/SharePopover`).
3. **Editor export:**
   - Mount `<ExportDialog open onOpenChange doc title selectionIds currentVariantId />` (pass the editor's toast `notify` if desired).
   - Call `useExportShortcut(() => setExportOpen(true))` for ⌘/Ctrl+Shift+E.
   - Wire the TopBar "Export" menu item to the same state.
4. **FlowCanvas `readOnly`:** when Canvas Core ships it, swap `ReadOnlyBoard`'s body for `<FlowCanvas doc view readOnly onSelectionChange />`. The share view must keep:
   - no drag, connect or delete;
   - selection allowed (used for "Export selection");
   - `ConnectionMode.Loose`, since edges target "source" handles;
   - handles kept in layout but invisible (`.fs-readonly .fs-handle { visibility: hidden }`; `display: none` breaks edge routing).
5. **Dashboard share/export:** exporting or sharing from the dashboard needs a doc loader (`readBoardDoc(id)` in `src/store/persistence.ts`).
6. **SPA rewrite** for `/s/*` when deploying (see Deploy notes).
