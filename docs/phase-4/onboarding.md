# Phase 4 — Onboarding: first-run tour and empty states

Owner: Copy & Onboarding agent. Goal: **a new user can create a 3-screen linked flow in under 3 minutes without help.**

## 1. First-run tour

![First-run tour, tip 1 of 4, next to the screen tool](tour.png)

Four small tips, each pointing at the real control:

| Tip | Points at | Says | Moves on when… |
|---|---|---|---|
| 1 Add a screen | Screen tool (F) in the left toolbar | Press **F**, then click the board to place a screen. | a screen is added |
| 2 Insert a component | Insert button (/) | Select a screen and press **/** to add a button, input, text and more. | a component is added inside a screen |
| 3 Link to the next screen | Flows panel | Select a button and press **L**, then pick “New screen”. Linked screens make a flow. | a link is made |
| 4 Play your flow | Play button | Press **P** to click through your screens like a prototype. | Play opens (tour ends) |

How it behaves:

- **Shows once**, by itself, on the first board a person opens. "Seen" is stored in this browser (`localStorage` key `fs:tour:v1`). It doesn't show on shared (view-only) boards.
- **Never blocks the canvas.** It's a small card beside the toolbar, not a modal. All shortcuts keep working while it's open, and it doesn't take focus when it appears by itself.
- **Follows you.** When you do what a tip says, it moves to the next one. You can also press **Next**.
- **Easy to leave.** "Skip tour", the close (×) button, or **Esc** close it. Esc is ignored while you're typing or another menu or dialog is open, so it never steals Esc from them.
- **Re-open it any time:** press **?** (or the keyboard button in the top bar), then **Show quick tour**. When opened this way it takes focus, so it can be read and stepped through with the keyboard (Enter = Next).
- **Accessible:** a labelled region ("tip"), each tip is announced to screen readers, keys are shown as key caps, AA contrast, no animation when reduced motion is on.
- **Stays out of automated tests.** Automated browsers (`navigator.webdriver`) don't get the tour unless a test opts in with `fs:tour:e2e = on`. The e2e helper `openSeededBoard` also marks it seen.

Code: `src/editor/tour/` (`tourState.ts`, `FirstRunTour.tsx`, `tour.css`), wired in `src/editor/EditorShell.tsx`; button in `src/editor/ShortcutsDialog.tsx`.

## 2. Empty, error and loading states

![Empty board: Start your flow, with F, / and L](empty-board.png)

| State | What people see | Where |
|---|---|---|
| Empty dashboard | "Sketch your first flow" — Sketch rough screens, link them into a flow, and click through it. Start blank or from a template. + New board + templates | Dashboard |
| Dashboard loading | "Loading your boards…" | Dashboard |
| Dashboard can't read storage | "Couldn't read your boards. Your browser may be blocking storage, for example in a private window." [Try again] | Dashboard |
| Can't create a board (storage full) | Toast: "Couldn't create the board. Your browser's storage may be full — try again, or delete a board you don't need." | Dashboard |
| Opening a board | "Opening {name}…" | Editor |
| Empty board | **Start your flow** — F Add a screen · / Insert a component · L Link a button to a screen · "Press ? for all shortcuts and the quick tour." | Editor canvas |
| No flows yet | Flows panel shows count 0; the tour's tip 3 points here | Editor |
| Nothing to play | Toast: "Nothing to play yet. Add a screen with F, then press P." | Play |
| First screen has no links | "No links on this screen yet. Link a button to another screen to click through." | Play |
| Nothing to compare | Tooltip on disabled Compare and toast: "Nothing to compare yet…" with ⇧D | Compare |
| Export: nothing to export | "Nothing to export here yet. Add a screen, or choose Whole board." | Export dialog |
| Export failed | In dialog: "Export didn’t work this time. Try again…" + [Try again]; toast "Export didn’t work" | Export dialog |
| Share offline | "You’re offline. Connect to the internet to share — your board is still saved on this device." | Share popover |
| Share failed (server / too large / rate limit) | Specific message from the share service, e.g. "This board is too large to share (max 5 MB)." | Share popover |
| Storage full / unavailable while editing | Status "Not saved yet – retrying" + after 3 s a banner: "Changes aren't being saved. Your browser's storage may be full or turned off (for example, in a private window). Keep this tab open while we try again, and use Export to keep a copy." | Editor |
| Board not found | "Board not found — It may have been deleted. Boards are saved in the browser where you made them…" [Back to your boards] | Editor route |
| Unknown address | "Page not found — This address doesn’t match a board or page…" [Back to your boards] | Any other URL |
| Shared link off / missing / loading | "This link is no longer active." · "Couldn’t load this board" [Try again] · "Loading board…" | Shared page |

All strings are in the [copy deck](copy-deck.md).

## 3. The 3-minute bar

`e2e/onboarding.spec.ts` → "first-time user builds a 3-screen linked flow from the on-screen hints" starts from empty storage with the tour on, and only does what the empty-board hint and tour say:

1. **New board** (dashboard)
2. Press **F** (tip 1)
3. **Click** the board → screen 1. *Tour moves to tip 2.*
4. Press **/**, type "button", **Enter** → a button on screen 1. *Tour moves to tip 3.*
5. Press **L**, **Enter** ("New screen") → screen 2, linked. *Tour moves to tip 4.*
6. Press **/**, type "button", **Enter** → a button on screen 2
7. Press **L**, **Enter** → screen 3, linked
8. Press **P** → Play opens on "Screen 1 of 3" and clicks through to "Screen 3 of 3". *Tour ends.*

**8 steps** (about 20 keystrokes or clicks). The automated run takes ~3 s. At a deliberate human pace of 10–15 s per step, including reading each tip, that's **about 1.5–2 minutes**, inside the 3-minute bar. The test fails if the path ever needs more than 10 steps.

The tour test ("first-run tour: shows once, Esc dismisses, reopens from Keyboard shortcuts") checks that the tour shows on the first board, Esc closes it, it doesn't come back after a reload or on another new board, and that it re-opens from Keyboard shortcuts → Show quick tour and can be stepped through with Enter.

Screenshots are regenerated with `SHOTS=1 npx playwright test e2e/onboarding.spec.ts`.
