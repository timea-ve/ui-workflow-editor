# Phase 2 — Wireframe Kit

Owner: Wireframe Kit agent · Code: `src/kit/wireframe/**` · Review page: `/gallery`

## In plain language

- All 16 lo-fi building blocks from the brief now exist: header, navigation bar, tabs, heading, paragraph, button, text input, checkbox, toggle, dropdown, card, list, table, image, icon and modal.
- Every block draws itself in both candidate styles (Sketchy and Clean lo-fi) using only the shared drawing primitives and colour/font tokens, so the Gate 2 style choice is a single switch.
- Default sizes fit a 375 px mobile screen with 24 px side margins (327 px wide). When a block is made smaller it degrades calmly: text ends with "…", rows/tabs/items that don't fit are hidden, and nothing spills outside its box.
- Device frames (mobile, tablet, desktop) give each screen lo-fi chrome (status bar + notch, rounded bezel, or browser bar) with the screen name shown above it.
- The gallery now also shows a "States & resizing" section and a mini sign-up screen on all three devices, in both styles.

## Components

Sizes are w × h in px. "Resizes" is the `resize` axis in the KitItemDef contract. Text prop = edited inline on double-click / Enter.

| Component | Default | Min | Resizes | Text prop | Editable props | Linkable |
|---|---|---|---|---|---|---|
| Header | 375 × 56 | 120 × 40 | horizontal | title | title, leading (back/menu/none), action (none/search/user/more) | ✅ |
| Navigation bar | 375 × 64 | 120 × 36 | horizontal | items | items (comma-sep.), active index, showIcons | ✅ |
| Tabs | 327 × 44 | 64 × 32 | horizontal | tabs | tabs (comma-sep.), active index | ✅ |
| Heading | 327 × 36 | 24 × 20 | both | text | text, level (H1/H2/H3), align | — |
| Paragraph (`text`) | 327 × 60 | 24 × 16 | both | text | text (multiline), size (sm/md), align, tone (ink/muted) | ✅ |
| Button | 140 × 40 | 48 × 28 | both | label | label, variant (primary/secondary) | ✅ |
| Text input | 327 × 64 | 64 × 32 | horizontal | label | label, placeholder, showLabel | ✅ |
| Checkbox | 240 × 24 | 24 × 20 | horizontal | label | label, checked | — |
| Toggle | 327 × 32 | 44 × 24 | horizontal | label | label, on | — |
| Dropdown | 327 × 64 | 64 × 32 | both | label | label, value, options (comma-sep.), open | ✅ |
| Card | 327 × 240 | 80 × 48 | both | title | title, body (multiline), hasImage | ✅ |
| List | 327 × 224 | 80 × 40 | both | items | count, items (comma-sep. titles), showAvatar, showChevron | ✅ |
| Table | 327 × 160 | 80 × 40 | both | columns | columns (comma-sep.), rows, showHeader | — |
| Image | 327 × 180 | 16 × 16 | both | alt | alt (description), shape (rectangle/circle) | ✅ |
| Icon | 24 × 24 | 12 × 12 | both | — | glyph (13 generic shapes), name (accessible name) | ✅ |
| Modal | 311 × 220 | 120 × 72 | both | title | title, body, primary, secondary (empty = hidden), showClose | ✅ |

Icon glyphs (drawn from simple lines/shapes, no third-party icon set): circle, square, star, menu, search, user, close, plus, chevron-left, chevron-right, check, home, more.

**Linkable rule:** an item is linkable if, in a real app, a person would tap it to go somewhere. Checkbox, toggle and heading change state or are static → not linkable. Table → not linkable as a whole (row-level links are parked). Input is linkable for the common "tap search field → search screen" pattern. A link on a **modal** means "its primary button goes to…"; a link on a **header** means "its back/menu button goes to…".

**Screen-reader text:** every item has `describe()`, e.g. "Checkbox 'Remember me', not checked", "Tabs: Overview, Details, Reviews; 'Overview' selected". Device frames render as `role="group"` labelled "Sign up (mobile screen)".

## Sizing & resizing rules

1. **Defaults fit mobile.** Default widths are 327 px (375 − 2 × 24 margin) for content blocks, full 375 px for header/nav, intrinsic for button/icon. All defaults ≤ 375 px wide (tested).
2. **Fixed-height controls resize horizontally only** (header, nav, tabs, input, checkbox, toggle) so they keep a believable control height. Content blocks resize both ways.
3. **Never overflow the box.** Single-line text ellipsises; multiline text is clamped to the lines that fit with "…" on the last line.
4. **Hide, don't squash.** Repeating parts have a minimum size; parts that don't fit are hidden, not shrunk: list rows (56 px), table rows (32 px) and columns (48 px), nav items (48 px), tabs (56 px), dropdown options (32 px).
5. **Optional decorations drop first** when space runs out: field labels (input/dropdown), card image (< 140 px tall), list avatar/chevron (narrow), nav icons (< 52 px tall), header icons, modal buttons and close button.
6. **Dropdown "open"** draws the option list inside the item's own box — make the dropdown taller to see options (the gallery shows it at 180 px).
7. **Device frames** fill the `DEVICE_SIZES` box; the screen name sits 24 px above it (`DEVICE_TITLE_H`), outside the box. `deviceContentInset(device)` returns the content offsets: mobile `{top 44, bottom 24}`, tablet `{top 28, bottom 20}`, desktop `{top 44}` (left/right 0). Children are clipped to the content area.
8. All props are coerced defensively (numbers clamped, booleans accept `true`/`"true"`, unknown glyphs fall back to circle), so a bad value in a saved doc never crashes a screen.

## Requests to the Design System agent (not changed by me)

- **`SketchLines` duplicate React keys:** with more than one polyline in sketchy mode, paths reuse keys `0…n`, which logs React warnings. I work around it with a local `Lines` helper (one `SketchLines` per polyline). Fix: prefix keys with the line index.
- **Rounded corners in sketchy mode:** `SketchRect` ignores `radius` when sketchy, so phones/pills look square. I added a local `RoundedRect` helper (Rough.js `path` with arcs, calmer roughness on small shapes) used by device frames, the notch, url pill and toggle. Would be cleaner as a shared primitive (e.g. `radius` support in `SketchRect`).
- **Multiline `KitText`:** an official `lines` prop (clamped multiline) would replace my `MultilineText` helper.
- Text-size → px mapping is duplicated in `_helpers.tsx` (`TEXT_PX`) to estimate how many lines fit; please keep tokens `--fs-kit-text-*` near 12/14/18/24 or expose the numbers.

## Contract (KitItemDef) observations — no change made

- No contract change required. Two optional ideas for later: (a) `aspect?: 'lock'` for icon/avatar-style images, (b) a per-item `linkHint` ("primary button", "back button") so the Link picker can explain what a link on a modal/header means.

## Open questions for the Director

1. **Should text links be linkable** (e.g. "Already have an account? Log in")?
   - A) Yes, the whole paragraph is linkable ← **recommended** (cheap, common in flows)
   - B) No, use a secondary button instead
   - C) Later: link a span inside the text
2. **Modal placement:** should dropping a modal on a screen also dim the screen behind it?
   - A) No, modal is just a box ← **recommended for v1** (calm, simple)
   - B) Yes, add a scrim automatically
3. **Table rows as link sources** (row → detail screen)?
   - A) Not in v1 ← **recommended**
   - B) Yes, each row becomes a link hotspot (needs a contract extension for sub-element links)
4. **Device frame title** — should the screen name sit above the frame (current) or inside the chrome (e.g. browser tab)?
   - A) Above, in app-chrome font ← **recommended** (readable at all zoom levels, editable like Whimsical)
   - B) Inside the device chrome

## Risks

- Lots of small Rough.js shapes (icons, skeleton lines, table grids) on big boards may cost render time in sketchy mode; mitigated by `useMemo` in primitives, but needs a perf check with 100+ elements.
- Line-count estimation uses approximate px sizes; if the Design System changes text tokens a lot, multiline clamping may cut one line early/late.
- Comma-separated props (nav, tabs, options, table columns) can't contain commas in labels.
- Sketchy text in tiny thumbnails (35 % scale) is unreadable; fine for overviews but templates should not rely on it.

## Parking lot

- Row-level links inside list/table; per-tab links in tabs/nav.
- More states: input error/disabled/filled, button disabled/loading, list selected row.
- Additional components: radio group, slider, search bar, avatar, badge, progress, date picker, bottom sheet, toast.
- Landscape device orientations and custom frame sizes.
- Auto-layout / stacking helpers (e.g. "place below previous with 16 px gap") for faster screen building.
- Split `_helpers.tsx` constants into a non-component module to silence oxlint `only-export-components` warnings (harmless today).
