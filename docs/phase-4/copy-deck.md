# Phase 4 — Copy deck

Owner: Copy & Onboarding agent. Status: applied in code.

## Voice in one line

**Plain, short, calm.** Say what happened and what to do next. Sentence case. Verbs on buttons. Name keys with key caps (F, /, L, P). No blame, no jargon ("scope", "variant", "frame" never appear in the UI). We say *screen*, *flow*, *option*, *link*, *board*.

Rules we applied:

1. **Empty state = next step.** Lead with "Nothing to … yet." and then give the action and its key.
2. **Errors = what happened, why (if we know), what to do.** Always mention that the board is safe when it is.
3. **Buttons are verbs.** "Try again", not "Retry"; "Back to your boards", not "Go to…".
4. **Tooltips describe the outcome**, not the mechanism ("Click through your flow", not "Play the selected flow").
5. **No exclamation marks, no "Oops".** Calm beats cute.

The existing copy was already in good shape (sentence case, curly quotes, en dash in "Compare options – Name"), so most changes are targeted rewrites of empty and error states.

## Changes

| Where | Before | After | Why |
|---|---|---|---|
| Editor · empty board hint (title) | This board is empty | Start your flow | Tells people what to do, not what's missing. |
| Editor · empty board hint (body) | Press F to add a screen · / to insert · or use a template | A numbered list: **F** Add a screen · **/** Insert a component · **L** Link a button to a screen, then "Press ? for all shortcuts and the quick tour." | Shows the three first actions in order, with keys. Adds the link step, which was missing. "Use a template" pointed to something that isn't in the editor. |
| Editor · storage failure banner (new) | — (only the status chip "Not saved – retrying") | Changes aren't being saved. Your browser's storage may be full or turned off (for example, in a private window). Keep this tab open while we try again, and use Export to keep a copy. | Storage full or blocked was silent apart from a small chip. Appears only after 3 s of failure, so a brief hiccup doesn't alarm anyone. |
| Top bar · save status (error) | Not saved – retrying | Not saved yet – retrying | "Yet" makes it sound temporary, which it is. |
| Top bar · Play tooltip | Play the selected flow | Click through your flow | Outcome-first; "selected" was confusing when nothing was selected (Play still works). |
| Top bar · Compare tooltip (disabled) | Compare needs 2 options. Duplicate a flow as an option (⇧D) first. | Nothing to compare yet. Add a second option with ⇧D. | Shorter, follows the empty-state pattern. |
| Toast · Play with no screens | Add a screen first — Play walks through your screens. | Nothing to play yet. Add a screen with F, then press P. | Empty-state pattern, with keys. |
| Toast · Compare with one option | This flow has one option. Duplicate it as an option (⇧D) to compare. | Nothing to compare yet. Press ⇧D to copy this flow as a second option. | "Copy" is plainer than "duplicate as an option". |
| Toast · ⇧D with no screens | Add a screen first, then duplicate its flow as an option. | Add a screen first, then press ⇧D to copy its flow as an option. | Same verb as above; gives the key. |
| Link picker · invalid target | Pick a screen — diagram shapes can’t be link targets. | Pick a screen. Links can only go to screens. | Removes "link targets" jargon. |
| Play · first screen has no links (new) | End of this path — press R to restart or ← to go back. | No links on this screen yet. Link a button to another screen to click through. | "End of this path" on screen 1 made a new user think Play was broken. Other screens still say "End of this path…". |
| Play · broken link | A link here points to a screen that was removed. | A link here goes to a screen that was deleted. | Plainer verbs. |
| Export · nothing in scope | There is nothing to export in this scope. | Nothing to export here yet. Add a screen, or choose Whole board. | Removes "scope"; gives the way out. |
| Export · failure toast | Export failed | Export didn’t work | Softer; the dialog already shows the reason and a "Try again" button. |
| Share · offline (new) | Couldn't reach FlowSketch. Check your connection and try again. | You’re offline. Connect to the internet to share — your board is still saved on this device. | When the browser knows it's offline, say so and reassure. The old message stays for other network errors. |
| Board not found · body | This board may have been deleted, or it lives in another browser. | It may have been deleted. Boards are saved in the browser where you made them, so it may be on another device or browser. | Explains the "saved on this device" model, which is the usual cause. |
| Board not found · button | Go to your boards | Back to your boards | Consistent with the new Page not found page. |
| Page not found (new route) | (blank page) | **Page not found** — This address doesn’t match a board or page. Check the link, or go back to your boards. [Back to your boards] | Unknown URLs used to render nothing. |
| Shared page · loading title | Loading… | Loading board… | Says what is loading. |
| Dashboard · first-run body | Draw rough screens, link them together, and click through the flow. Start blank or from a ready-made flow. | Sketch rough screens, link them into a flow, and click through it. Start blank or from a template. | Matches the product verb ("sketch") and the "Start from a template" heading below. |
| Dashboard · load error | Couldn't load your boards. | Couldn't read your boards. Your browser may be blocking storage, for example in a private window. | Gives the likely cause. |
| Dashboard · load error button | Retry | Try again | Plain verb, same as Export and Share page. |
| Dashboard · create failed toast | Couldn't create the board. Nothing was saved — please try again. | Couldn't create the board. Your browser's storage may be full — try again, or delete a board you don't need. | The real cause is storage full; gives a way out. |
| Shortcuts dialog · header button (new) | — | Show quick tour | Re-opens the first-run tour. |
| Template · Sign-up | Welcome, form, success, plus an “email taken” error path. | Welcome, sign-up form and success, with an “email taken” branch. | "Branch" hints at Option A/B; reads more naturally. |
| Template · Onboarding | Intro slides, pick interests, and a skip shortcut. | Two intro slides, pick interests, and a Skip path. | "Shortcut" clashes with keyboard shortcuts. |
| Template · Settings | Settings menu, account, notifications and log out. | Settings list, account details, notifications and log out. | Clearer screen names. |
| Template · Search | Search home, results, article and a filters panel. | Search, results, an article and a filters panel. | "Search home" is jargon. |

## New strings — first-run tour

| Tip | Title | Body |
|---|---|---|
| 1 of 4 | Add a screen | Press **F**, then click the board to place a screen. |
| 2 of 4 | Insert a component | Select a screen and press **/** to add a button, input, text and more. |
| 3 of 4 | Link to the next screen | Select a button and press **L**, then pick “New screen”. Linked screens make a flow. |
| 4 of 4 | Play your flow | Press **P** to click through your screens like a prototype. |

Controls: "Skip tour" · "Next" (last tip: "Done") · close button "Close tour" · counter "Tip n of 4".

## Reviewed and kept

These already meet the voice rules, so they're unchanged:

- **Dashboard:** "Sketch your first flow", "Start from a template", "Linked screens you can click through right away.", "Search boards", "Edited just now", "“Keep me” deleted" + Undo, "Couldn't duplicate the board. Your original is safe.", "Too late to undo — the board was already removed."
- **Top bar:** "Saved on this device", "Saving…", "Share", "Export", "Compare", "Play", "Keyboard shortcuts".
- **Insert palette:** "Search components and shapes", "Nothing matches “…”. Try “button” or “screen”."
- **Linking (ops):** "Select a component inside the screen to link it.", "Diagram shapes can’t link to screens. Use the arrow tool (A) to connect them.", "Put the component inside a screen to link it.", "{Component} can’t be a link. Try a button, text or list instead."
- **Announcer messages:** "Screen n added", "Button added to Screen 1", "Pasted 1 item", "Deleted 3 items" (asserted by e2e).
- **Play:** "Screen n of m", "Click a highlighted item…", "End of this path — press R to restart or ← to go back." (non-first screens).
- **Compare:** "Compare options – {flow}".
- **Export dialog:** "Export PNG", "Document (PDF)", "Whole board", "Try again", "Export didn’t work this time. Try again, or export a selection if the board is very large."
- **Share:** "Link is on", "Link copied", "Link turned off", "Link updated with your latest changes", "This link has been turned off.", "This board is too large to share (max 5 MB).", "Too many changes in a short time. Try again in a minute."
- **Shared page:** "This link is no longer active.", "Ask the owner for a new link.", "Couldn’t load this board", "Try again", "Nothing here yet", "View only · made with FlowSketch".
- **Template names:** Sign-up, Onboarding, Checkout, Settings, Search — short and familiar. "Checkout" description kept.
