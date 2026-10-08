# Phase 3: Platform (Dashboard, boards, templates)

Owner: Platform Agent · Status: done, ready for review

## In plain language
- The home page (`/`) lists your boards. Each card shows when you last edited the board, and you can search boards by name. Every board has a menu with Open, Rename, Duplicate, Copy share link and Delete.
- Five starter templates (Sign-up, Onboarding, Checkout, Settings, Search) create a board of real linked screens. You can click through it in Play mode right away.
- New users see a short welcome with **New board** and the templates up front. One click gets you a linked 4-screen flow, well inside the "< 3 minutes" goal.
- Delete is safe. The board disappears right away, and an **Undo** toast keeps it recoverable for about 8 seconds.
- Storage errors show a calm message. Nothing is left half-created.

## How to try it
1. Run `npm run dev` and open `/`.
2. Pick a template, or press **New board** (shortcut `N`). You land on `/b/:id`. Use Back to return.
3. On a board card, use the `…` menu or keyboard shortcuts: Tab moves to a card, Enter opens it, F2 renames it, Enter/Escape commits or cancels a rename. Delete a board, then press **Undo**.

## Templates (`src/platform/templates/`)
Each template is built only from `src/flow/ops.ts` and kit defaults. Screens run left to right, the leftmost is the start screen, and buttons/list rows link forward.

| id | Device | Screens | What it shows |
|---|---|---|---|
| `signup` | mobile | Welcome → Sign up → Account created, plus Email taken | Form with an "Email available?" decision diamond and an error path that links back. |
| `onboarding` | mobile | Intro → How it works → Your interests → Ready | Intro slides, interest picker, and a "Skip" shortcut to the end. |
| `checkout` | desktop | Cart → Shipping → Payment → Confirmation | Classic linear purchase. |
| `settings` | mobile | Settings → Account / Notifications / Log out? | Hub and spoke. Every sub-screen links back to the hub. |
| `search` | desktop | Search home → Results → Article, plus Filters | Results open a Filters panel; Apply links back to Results. |

## Board operations (`src/platform/boards.ts`)
- `createBoard({ title?, templateId? })` creates the board's index entry, then writes its initial content. If the write fails, the index entry is rolled back and a `BoardOpError` is thrown. A template board is titled after the template.
- `duplicateBoard(id)` reads the board's content and creates "Copy of …".
- `deleteBoard(id, { undoWindowMs? })` returns `{ board, undo(), commit() }`.
  - **Undo design:** the index entry is removed immediately. The board content (IndexedDB) is deleted only on `commit()`.
  - The dashboard commits when the Undo toast closes, which happens after about 8s and pauses while the toast is hovered or focused.
  - Pending ids are also stored in localStorage (`fs:pendingDeletes:v1`). If the tab closes during the undo window, `flushPendingDeletes()` cleans up the content on the next dashboard visit.
- Addition to `boardIndex.ts`: `restoreBoardMeta(board)`, used by undo. Existing signatures are unchanged.

## Tests
- Vitest (`npm test`): **14 files, 328 tests, all passing**.
  - Platform and dashboard tests: `templates.test.ts` (36), `boards.test.ts`, `dashboard.test.tsx` (9).
  - What they check: every template builds; links and connectors resolve; only registered types are used; elements stay inside their frame; `detectFlows` finds exactly 1 flow that includes every screen and starts at the leftmost; create/duplicate/delete/undo/rollback; the dashboard's empty state, list, search, rename, delete + undo, and error toast.
- Playwright (`npx playwright test e2e/dashboard`): **11 passing**. They cover:
  - the empty state shows the templates
  - New board leads to `/b/:id`, and the board is listed after going back (content verified in IndexedDB)
  - the `N` shortcut
  - creating from a template
  - search
  - keyboard-only rename
  - delete, then undo (the board survives a reload)
  - duplicate
  - keyboard open
  - no horizontal overflow at 768px
  - **axe WCAG A/AA: 0 violations** in both empty and list states
- `npx tsc -b`: clean. `npm run lint`: 0 errors. The only warnings are in other agents' files.

## Risks
- The editor at `/b/:id` is still a placeholder, so e2e only checks the URL and the stored content.
- Deleting a shared board does not revoke its share link (`/s/:shareId`).
- Template previews are tiny (about 6% scale). They show shape, not readable text.
- Board cards use a neutral illustration, not a real thumbnail.

## Open questions
1. **Copy share link when a board has no share:** the brief asked for a tooltip; I used a visible hint under the disabled item instead, because tooltips on disabled menu items are hard to reach by keyboard.
   - **(a) Keep the inline hint (recommended)**
   - (b) Tooltip
   - (c) Hide the item
2. **Template board names:**
   - **(a) Name it after the template, e.g. "Checkout" (recommended)**
   - (b) "Untitled board"
3. **Order for returning users:** templates are currently shown above "Your boards".
   - (a) Keep the current order
   - **(b) Show boards first and collapse templates to one row (recommended once a user has more than 6 boards)**

## Parking lot
Real board thumbnails · sort options (name / created) · folders · revoke share link on delete · right-click context menu on cards · drag to reorder · a 6th "Blank mobile / Blank desktop" starter.

## Requests to Orchestrator
- Put `data-kit-style="clean"` on the app root (`App.tsx`) so every page has it by default. The dashboard sets it on its own root today.
- Export `ICON_STROKE` from `src/chrome/index.ts`. The dashboard imports it from `src/chrome/shared` for now.
- Remind Canvas Core: when a board is opened, call `touchBoard` / `updateBoardMeta` so "Edited …" stays accurate, and set `shareId` so the dashboard can enable **Copy share link**.
