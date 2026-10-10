---
description: Map real TwinScape app workflows into accurate desktop flow files for UI Workflow Editor
---

# Goal
Create **new, accurate** lo-fi desktop flows of the live **TwinScape** app (https://service.twinscape.bruker.com/) as flow files in `flows/`, so they open as boards in UI Workflow Editor. Accuracy matters more than quantity: every screen, label, nav item, column and branch must match what the real app shows.

# Access (read-only)
1. Open https://service.twinscape.bruker.com/ in the **browser canvas** and ask the Director (ask_user) to sign in there. Never ask for, type, store or log her password, tokens or cookies.
2. **Read-only exploration.** Navigate, open tabs, expand panels, hover. Do **not** submit forms, save settings, accept/decline invitations, create/delete/revoke anything (API keys, users, labs), start procedures, or change thresholds. If a screen is only reachable through a state-changing action, describe it from what is visible (button label, dialog title if it shows without confirming) and mark it in a sticky note: "Not exercised: …".
3. Don't copy customer data into files: replace real lab names, instrument serials, people, emails and values with realistic placeholders (e.g. "Lab A", "timsTOF #1", "user@lab.org"). Keep the UI labels, nav names, column headers, button text and status names exactly as in the app.

# What already exists (don't duplicate)
`flows/twinscape-01-entry.json` … `twinscape-06-service.json` cover: sign-in → Your Labs → Lab view → MS/LC overview; MS QC review (Lab QC, Proteomics QC runs, thresholds); LC overview (procedures, telemetry, LC settings); notifications + invitations; user settings (interface, lab memberships, API keys); service (readbacks, hardware diagnostics, installed software). Read them first to match style. You may correct them if the live app differs — list every correction.

# Steps
1. **Inventory**: walk every top-level nav item, sidebar section, tab and secondary page. Write a screen inventory (name, URL path, how you get there, key components) to the session workspace before writing flows.
2. **Pick flows**: propose 4–8 new user-task flows not yet covered (e.g. adding/inviting lab members, instrument detail tabs, alerts/thresholds drill-down, data/report export, search/filtering, lab admin, help/support, empty or error states you can see). Ask the Director (ask_user, one question, choices, recommendation marked) to confirm the list before building.
3. **Build** each flow as `flows/twinscape-NN-<slug>.json` (continue numbering from 07), following `.github/agents/flow-designer.agent.md`:
   - `device: "desktop"`; shared header `{ "type": "header", "title": "TwinScape", "links": "Home, Notifications", "search": false, "right": "avatar" }` (adjust only if the live header differs).
   - Page title band, left `sidebar` with the real items and `active` set, then content using the closest components (table with real column headers, list, tabs, chart, card, toggle, input, button, modal, toast…).
   - Link the actual clicked element with `goTo` and a short `linkLabel`; use yes/no decisions for real branches; sticky notes for remarks, unverified or not-exercised paths.
4. **Double-check (mandatory)**: for every screen, go back to the live page and compare it side by side with your JSON — nav items, tab names, column headers, button labels, order of sections, where each link goes. Fix mismatches. Then run `npm run flow -- flows/<file>.json` for each file: zero errors, zero warnings. Open each `--local` or live link and screenshot the board to confirm the layout reads correctly.
5. **Verify** `npm test` passes, commit (with the Co-authored-by trailer) and push to `main`.

# Deliver to the Director (≤100 words + links)
- One line per flow: name, screens count, live link (`npm run flow` URL).
- Corrections made to flows 01–06, if any.
- Anything you couldn't see or verify, and why.
Log the import in `docs/DECISION-LOG.md` and `docs/PROJECT-STATUS.md`.
