# ⛳ Gate 1 — Positioning, MVP flows, UX model, tech plan

_Date: 2026-10-08 · Detail: [research](../phase-1/research.md) · [UX architecture](../phase-1/ux-architecture.md) · [tech architecture](../phase-1/tech-architecture.md)_

## 1. What was done
- **Studied 6 competitors** (Whimsical, Balsamiq, Excalidraw, FigJam, tldraw, Miro). **None of them has a built-in way to compare "Option A vs Option B" flows.** That is our opening.
- **Designed how the app works:** a screen is just a box on the canvas. You select a button, press **L**, and pick "New screen" to link it. A 3-screen flow takes about 11 clicks, roughly 90 seconds (the target is under 3 minutes).
- **Designed options and comparing:** "Duplicate as option" makes a labelled copy (Option B). **Compare** shows A and B side by side, and **Play** clicks through either one like a prototype.
- **Chose the technology:** a free, widely used drawing library. Boards save automatically in the browser, and share links put a read-only copy online. Hosting is about **$0 for a demo and $45–70/month at 1,000 users**, with no licence fees.

## 2. What you can see/try
Nothing clickable yet; this gate is about plans. Read the first section of each linked doc (about 5 bullets each). The first-run journey diagram is in the UX doc, §2 J1.

## 3. Decisions I need from you
Most of these overlap, so I've merged them. My recommendation is **in bold**. I'll ask them one at a time.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Positioning line | A) "Fastest way to sketch a screen and wire it into a flow" · B) "Whimsical for wireframes, but built to compare Option A vs Option B from day one" · C) "The lo-fi canvas where exploring alternative flows is as easy as drawing an arrow" | **B** for internal use (we may not want a competitor's name in public copy) |
| D2 | How options are represented | A) Labelled copies stacked as lanes on the same board · B) Toggle A/B on the same screens · C) Separate boards | **A** |
| D3 | How "flows" are defined | A) Detected automatically from links, renameable · B) User groups screens by hand · C) No flow concept | **A** |
| D4 | What Compare shows | A) Side-by-side panes that pan and zoom together · B) Just zoom the canvas to fit both · C) Overlay that highlights differences | **A** now, C later |
| D5 | Do links look like arrows? | A) Same arrow, with a small "clickable" marker on the source button · B) Dashed style for links · C) Links hidden until you hover | **A** |
| D6 | Accounts in MVP | A) No sign-in; boards are saved on your device, and share links need no account for anyone · B) Sign-in required (+~1 week) | **A** |
| D7 | Drawing library (affects cost and time) | A) React Flow: free, about 1–2 extra weeks · B) tldraw: fastest, but a paid licence (about $6k/yr, quote only) · C) tldraw's free hobby licence: non-commercial only, with a watermark | **A** |

_Moved to Gate 2:_ sketchy vs clean visual style (you'll see both side by side).
_Parking lot:_ free-tier and pricing model.

## 4. Risks and trade-offs
- **Boards live in your browser (if D6 = A).** Clearing browser data loses them. To offset this, the app says "Saved on this device", and you can export and import a board file. Accounts come later.
- **Nobody has built Compare before**, so we have no model to copy. Expect to adjust it after your hands-on test at Gate 3.
- **Options are independent copies.** Editing Option A doesn't update B. That's fine for exploring, and linked components are in the parking lot.
- **Canvases are hard to make accessible.** We'll add a text outline of the flows and screens, plus full keyboard control, from the start.
- **Speed with 50+ screens is a known weak spot for competitors.** We'll test with a 60-screen board on every change.

## 5. What happens next if you approve
Phase 2 starts in parallel with three agents:
- **Design System:** two style options for you to choose from.
- **Wireframe Kit:** the lo-fi building blocks (buttons, inputs and so on).
- **Diagram Kit:** shapes, arrows, links and options.

I'll also set up the project skeleton so `pnpm dev` runs. Then I'll come back for **Gate 2: the visual direction and component kits**.
