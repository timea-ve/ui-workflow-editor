# Save boards to GitHub

## In plain words

**Your boards are always saved on this device first.** Every change is kept in this browser straight
away, so editing stays fast and works offline. Signing in to GitHub adds a cloud copy.

**What signing in does.** Click **Sign in with GitHub** on the dashboard (top right). From then on,
each board is also copied to a private repository in your GitHub account called
**`ui-workflow-boards`**. A few seconds after you stop editing, the board is saved there in the
background. The editor's top bar shows how that's going:

| You see | It means |
|---|---|
| Saved to GitHub | The cloud copy is up to date. |
| Saving to GitHub… | A change is on its way. |
| Offline — saved on this device | No connection. Your work is safe here and goes up when you're back online. |
| Not saved to GitHub — sign in | You're signed out. Boards are still saved on this device. |

**The first time** you'll be asked to *choose where to save*. That takes two steps:

1. **Create the repository.** The link opens GitHub with the name `ui-workflow-boards` and *private*
   already filled in. Skip this if you already have it.
2. **Give access.** On GitHub, pick *Only select repositories* → `ui-workflow-boards`. The app can't
   see or touch any other repository.

Your boards then start saving.

**Using two devices (or two browsers).** Sign in on both. Boards made on one appear on the other's
dashboard. The newest version wins. If the *same* board was changed on both before either was saved,
nothing is thrown away. You'll get two boards: yours, and a copy named "*<title> (from another
device)*". Keep whichever you like and delete the other.

**Deleting.** Deleting a board (after the few seconds you have to undo) also removes it from GitHub.
If a board was deleted on another device, it disappears here too, unless you had unsaved changes to
it here, in which case it's kept and saved again.

**Signing out** (avatar menu → *Sign out*) only forgets your GitHub sign-in on this browser. Your
boards stay on this device and on GitHub. Sign in again any time to carry on. GitHub sign-ins last
about 8 hours and renew themselves automatically. If renewing ever fails, you'll see a calm
*"Sign in again"* and nothing is lost.

**Privacy.**
- Your GitHub sign-in is kept only in this browser. It's sent only to GitHub and to our small
  sign-in helper, never anywhere else.
- The app can only reach repositories you explicitly gave it access to.
- Each board is a readable file you own: `boards/<id>.json` in your repository, with full history.
- Share links aren't uploaded.

---

## Technical notes

### Pieces

| Piece | Where | What |
|---|---|---|
| GitHub App | github.com → Settings → Developer settings → GitHub Apps | Identity + permissions. User-to-server tokens (web flow). |
| Token worker | `worker/` (Cloudflare Worker `ui-workflow-editor-auth`) | Holds the client secret; swaps `code`/`refresh_token` for tokens. Stores nothing. |
| App code | `src/platform/github/` (lazy-loaded) | `config.ts`, `auth.ts`, `api.ts` (REST via `fetch`), `sync.ts` (pure engine), `runtime.ts` (browser wiring), `ui/`. Callback page: `src/pages/AuthCallbackPage.tsx`. |

The feature is **off unless all three build-time variables are set**. With them missing, the button,
the `/auth/callback` route, the editor status and the sync code are all absent, and the app works
exactly as before.

| Variable | Value |
|---|---|
| `VITE_GITHUB_CLIENT_ID` | GitHub App → *Client ID* (`Iv…`) |
| `VITE_GITHUB_APP_SLUG` | The app's URL name (`https://github.com/apps/<slug>`) |
| `VITE_AUTH_WORKER_URL` | The worker URL, e.g. `https://ui-workflow-editor-auth.<account>.workers.dev` |

These values are public: they ship in the page. Locally, put them in `.env.local` (see `.env.example`).
On Pages, add them as **repository variables** (Settings → Secrets and variables → Actions →
*Variables*). `.github/workflows/pages.yml` passes them to the build as `${{ vars.… }}`.

### 1. Create the GitHub App

GitHub → Settings → Developer settings → GitHub Apps → *New GitHub App*:

- **Callback URLs** (exact):
  - `https://timea-ve.github.io/ui-workflow-editor/auth/callback`
  - `http://localhost:5173/auth/callback` (local dev, optional)
  - GitHub sends people back to the **first** one after an installation, so keep Pages first.
- **Expire user authorization tokens:** on. This gives 8-hour tokens plus refresh tokens.
- **Request user authorization (OAuth) during installation:** on. After *Give access*, the user
  lands on the callback already signed in. The callback accepts `code` + `setup_action` without a
  `state` for this case.
- **Enable Device Flow:** off.
- **Webhook:** uncheck *Active*. None needed.
- **Repository permissions:**
  - **Contents: Read and write**
  - **Metadata: Read-only** (always required)
  - Nothing else. No account or organization permissions.
- **Where can this GitHub App be installed:** *Only on this account* is enough for one user; choose
  *Any account* to let others use it.

After creating it, note the **Client ID** and the **slug**, then *Generate a new client secret*. The
secret goes only into the worker (step 2), never into the app or the repo.

### 2. Deploy the worker

```sh
cd worker
# set GITHUB_CLIENT_ID (and ALLOWED_ORIGINS if needed) in wrangler.toml [vars]
npx wrangler login
npx wrangler deploy
npx wrangler secret put GITHUB_CLIENT_SECRET   # paste the client secret
```

- **Endpoints:**
  - `POST /token {code}` and `POST /refresh {refresh_token}` → forwards to
    `https://github.com/login/oauth/access_token` with the client id and secret. Returns GitHub's
    JSON (`access_token`, `refresh_token`, `expires_in`, `refresh_token_expires_in`, or `error`).
- **CORS:** only origins in `ALLOWED_ORIGINS` are allowed (default
  `https://timea-ve.github.io,http://localhost:5173,http://localhost:5180`). Others get 403.
- **Input:** bodies over 2 KB or with malformed values get 400.
- **Storage and logging:** nothing is stored or logged.
- **Tests:** `npx vitest run worker`.

### 3. Turn it on

- Set the three repository variables and re-run the *Deploy to GitHub Pages* workflow.
- Each user then needs a private `ui-workflow-boards` repository with the app installed on it. The
  dashboard walks them through this.

### How syncing works

- **Repository lookup:**
  - `GET /user/installations` → `GET /user/installations/{id}/repositories` → the repository named
    `ui-workflow-boards`, preferring one owned by the signed-in user.
  - Repository not found or not shared with the app → the "Choose where to save" panel. A user
    token can't tell a missing repository from one that isn't shared, so both steps are shown.
- **File format:**
  - File path: `boards/<boardId>.json`, written with the Contents API on the default branch.
  - Contents: `{ "format": "ui-workflow-editor/board", "version": 1, "board": <meta>, "doc": <BoardDoc> }`, pretty-printed (2 spaces).
  - Device-only fields (`shareId`, `thumbnail`) aren't uploaded.
- **Sync state:**
  - Kept in localStorage `fs:github-sync:v1`: per board, the last-synced blob `sha`, the local
    `updatedAt`, and a content fingerprint.
  - *Local changed* means `updatedAt` differs. *GitHub changed* means the listed `sha` differs.
  - Tokens are kept in `fs:github:v1`.
- **When it runs:**
  - **Push:** about 3 s after a board's metadata changes; immediately on tab hide or `pagehide`.
  - **Pull:** on sign-in, app load, opening the dashboard, window focus (at most every 30 s),
    coming back online, and *Sync now*.
  - **Limits:** one request chain per board, at most 2 boards at once.
  - **On failure:** retries back off from 5 s to 5 min.
- **Rules** (the table at the top of `src/platform/github/sync.ts` is the source of truth):
  - **Never synced** → upload. The first connection uploads every board.
  - **Only on GitHub** → download. A board that's missing locally *without* a delete record (for
    example, cleared browser storage) is downloaded again.
  - **One side changed:**
    - Only local changed → upload. If the content fingerprint is unchanged, only a timestamp moved
      and nothing is written. This stops two devices ping-ponging.
    - Only GitHub changed → replace the local copy. The local share link is kept.
  - **Both changed:**
    - Same content → mark as synced.
    - Different content → keep both. GitHub's version becomes a new board "*<title> (from another
      device)*". The local board keeps its id and is uploaded.
  - **Deletes:**
    - Deleted locally → once the undo window ends, the board gets a tombstone and its GitHub file is
      deleted. If the file changed on GitHub since our last sync, it's downloaded again instead of
      deleted.
    - GitHub file gone, no local changes → removed locally. GitHub file gone with local changes →
      uploaded again.
    - Boards still in the undo window are left alone.
  - **Write rejected (409/422/404 on PUT)** → re-read the file and apply the rules again, at most 3
    times.
- **Security:**
  - The token goes only in the `Authorization` header (api.github.com) or a POST body (worker).
  - It never appears in a URL or a log. Warnings contain only a path and an HTTP status.
  - `/auth/callback` checks the random `state` it stored in sessionStorage. It only returns to
    same-app paths.

### Known limits

- A local edit counts as "changed" about 1 s after it's saved, when the board's `updatedAt` moves. If
  a newer GitHub version of that same board is pulled inside that window, it can replace those last
  keystrokes on this device.
- Boards over about 1 MB use the Contents API raw download. Files over 100 MB can't be stored.
- There's one boards repository per user, named `ui-workflow-boards`.
