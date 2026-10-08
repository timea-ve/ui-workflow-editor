# FlowSketch — Design system (Phase 2)

Owner: Design System Agent · Status: ready for Gate 2 · Preview: **`/chrome`** (toggle "Option 1 · Sketchy" / "Option 2 · Clean lo-fi", or open `/chrome?style=sketchy` / `/chrome?style=clean`)

## In plain language

- **One look, two flavours.** Everything is grey plus one violet. You choose whether the wireframes on the canvas look **hand-drawn** (Option 1) or **neat and straight** (Option 2). The app around the canvas (toolbars, panels) looks the same in both.
- **Violet means "you can act on this".** The single violet is used only for the selection outline, the focus ring, the main "Play" button and the small "clickable" marker on linked elements. It is never used as decoration.
- **Everything is readable.** Every text and line colour has been measured against its background and passes the WCAG AA accessibility standard (results below). This is checked by an automated test, so it can't quietly regress.
- **Keyboard-first, but not keyboard-only.** Each tool shows its one-letter shortcut in the corner (V, H, F, R, D, O, A, T, N, /, P), and every control also works with mouse, touch and screen reader.
- **Calm by default.** Motion is short and switches off completely when the device asks for reduced motion. There is no red: errors use plain words and an icon instead of an alarm colour.

## The two style options

| | Option 1 — "Sketchy" | Option 2 — "Clean lo-fi" |
|---|---|---|
| One line | Hand-drawn strokes (Rough.js) and the handwritten font **Kalam** on a warm-paper canvas — reads unmistakably as "draft". | Straight 1.5px grey lines, rounded corners and the neutral **Inter** font on a cool-grey canvas — reads as tidy, presentation-ready. |
| Canvas | `#f7f6f2` (warm paper) | `#f5f5f4` (neutral) |
| Wireframe font | Kalam 400/700 | Inter (variable) |
| Corners | Sketchy, drawn | 6px radius |
| Sketchiness | Calm: roughness scales with size (0.35–0.9), low bowing — wobbly, never chaotic | none |
| App chrome | Inter, same in both | Inter, same in both |

Switching is one attribute: `data-kit-style="sketchy" | "clean"` on any ancestor.

## Tokens (`src/design/tokens.css`)

Existing names (`--fs-ink`, `--fs-muted`, `--fs-faint`, `--fs-surface`, `--fs-canvas`, `--fs-accent`, `--fs-kit-font`, `--fs-kit-text-sm/md/lg/xl`, `--fs-ui-font`) all still work.

| Group | Tokens | Values |
|---|---|---|
| Grey ramp | `--fs-gray-0…9` | #ffffff, #f5f5f4, #ececea, #dddddb, #c6c6c2, #858582, #6b6b68, #545451, #343432, #1f1f1f |
| Accent (the only colour) | `--fs-accent` / `--fs-accent-weak` | #5b3fd1 / #eeeafb (Director, Gate 2) |
| Semantic | `--fs-ink`, `--fs-muted`, `--fs-subtle`, `--fs-line`, `--fs-hairline`, `--fs-hover`, `--fs-faint`, `--fs-surface`, `--fs-canvas`, `--fs-on-accent` | gray-9, gray-7, gray-6, gray-5, gray-3, gray-2, gray-4 (fills only, never text), white, per style, white |
| Selection / link | `--fs-selection`, `--fs-selection-fill`, `--fs-link-marker`, `--fs-link-marker-size` | accent, accent-weak, accent, 16px |
| Focus | `--fs-focus-ring`, `--fs-focus-width`, `--fs-focus-offset` | accent, 2px, 2px |
| Spacing (4px base) | `--fs-space-0…12` | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48 px (space-0…6, 8, 10, 12) |
| Radii | `--fs-radius-sm/md/lg/pill`, `--fs-kit-radius` | 4, 8, 12, 999px; kit: 0 (sketchy) / 6px (clean) |
| Strokes | `--fs-stroke-hair/1/2/3` | 1, 1.5, 2, 3px |
| Shadows (minimal) | `--fs-shadow-1/2` | floating toolbar / popovers only |
| Layers | `--fs-z-canvas, lanes, items, selection, chrome, popover, modal, toast` | ascending |
| Motion | `--fs-dur-fast/base/slow`, `--fs-ease-out` | 120 / 180 / 280ms; all 0ms under `prefers-reduced-motion` |
| UI text | `--fs-ui-text-xs/sm/md/lg/xl` | 12 / 13 / 14 / 16 / 20px |
| Kit text | `--fs-kit-text-sm/md/lg/xl` | 12 / 14 / 18 / 24px |

Fonts are self-hosted (OFL) via `@fontsource/kalam` and `@fontsource-variable/inter`, imported once in `src/design/fonts.ts` (loaded from `src/main.tsx`).

## Contrast check (WCAG 2.x, computed by `src/design/contrast.ts`, enforced by `contrast.test.ts`)

Text needs ≥ 4.5 : 1; UI strokes and the focus ring need ≥ 3 : 1.

| Foreground → background | White surface | Sketchy canvas #f7f6f2 | Clean canvas #f5f5f4 | Hover #ececea | Accent-weak #e8eefc | Use | Pass |
|---|---|---|---|---|---|---|---|
| ink #1f1f1f | 16.48 | 15.24 | 15.11 | 13.93 | 14.18 | body text, strokes | AA text ✅ |
| muted #545451 | 7.60 | 7.03 | 6.96 | 6.42 | 6.54 | secondary text | AA text ✅ |
| subtle #6b6b68 | 5.35 | 4.94 | 4.90 | 4.52 | 4.60 | hints, placeholders | AA text ✅ |
| accent #5b3fd1 (chosen at Gate 2) | 6.83 on white · 5.78 on its tint | | | | | selection, focus, links | AA text ✅ (verified by contrast.test.ts) |
| line #858582 | 3.70 | 3.42 | 3.39 | 3.13 | 3.18 | input borders, separators | AA UI (3:1) ✅ — not for text |

Other pairs: white on accent (Play button) **5.90** ✅ · ink on faint fill (#c6c6c2, e.g. primary wireframe button) **9.62** ✅ · link marker (accent) on faint fill **3.45** ✅ (UI). Faint #c6c6c2 is decorative fill only and is never used for text.

## Chrome inventory (`src/chrome/`, presentational: props in, callbacks out)

| Component | What it does | Built on |
|---|---|---|
| `Toolbar` | Vertical tools V H F R D O A T N with corner key hints, plus Insert (/) and Play (P) | Radix ToggleGroup + Tooltip |
| `TopBar` | Inline-editable board title, save status, Share, Export ▾, Compare, Play | Radix DropdownMenu |
| `InlineTitle`, `SaveStatusIndicator`, `ExportMenu`, `OfflineBanner` | Parts of the top bar; status = saved / saving / offline / error with words + icon | — |
| `InsertPalette` | "/" searchable list (items via props), ↑↓ Enter Esc, grouped when not searching, empty state | Radix Dialog, combobox + listbox |
| `Inspector`, `InspectorSection` | Side panel rendering `PropField`s (text, multiline, select, number, boolean); empty and multi-select states | — |
| `OptionChip` | "Option A" / "Option B" lane label, optional subtitle, selected state | — |
| `ContextMenu` | Right-click menu with shortcut hints | Radix ContextMenu |
| `Toasts`, `Announcer` | Toasts (auto-dismiss, pauses on hover/focus, optional action) + polite live region | — |
| `CoachMark` | Empty-board hint: "Press F to add a screen · / to insert · or use a template" | — |
| Helpers | `TOOLS`, `toolForKey`, `isTypingTarget`, `filterInsertItems`, `Kbd`, `Tip`, `ChromeProvider` | — |

New primitives in `src/design/primitives.tsx` (existing API unchanged): `SketchArrow`, `arrowHead`, `LinkMarker` (the "clickable" marker), `roundedRectPath`, `calmRoughness`; `SketchRect` now honours `radius` in sketchy mode; `KitText` accepts `lines` for multi-line clamping; `SketchLines` keys are unique.

## Open questions for the Director

1. **Which style for the wireframes?** a) Option 1 Sketchy **(recommended — it signals "this is a draft, comment on the flow, not the pixels", which fits the brief)** · b) Option 2 Clean lo-fi · c) Sketchy by default with a per-board switch (parking lot; more to test).
2. **Handwritten font (if Option 1)?** a) Kalam **(recommended — most legible at 12–14px, has a bold)** · b) Patrick Hand (rounder, no bold) · c) Architects Daughter (more character, harder to read small).
3. **The one accent colour?** a) Calm blue #2f5bd3 **(recommended — passes AA everywhere, reads as "interactive")** · b) Violet #5b3fd1 · c) Teal #0f766e.
4. **Toolbar position?** a) Floating on the left **(recommended — keeps the top free for the board title and Play)** · b) Floating at the bottom centre.
5. **Shortcut letters on tool buttons?** a) Always shown, small **(recommended — teaches shortcuts without a tour)** · b) Only in tooltips.

## Risks

- **Kalam at 12px** is legible on the preview but untested with real users and long labels; mitigated by the 12px floor and line clamping.
- **Rough.js performance** on large boards (50+ screens) — drawing is memoised per shape; may need to switch to clean strokes while zooming/panning.
- **Font loading**: a brief flash of fallback font on first load; local-only storage means no CDN dependency though.
- **Single accent** means errors are not red; we rely on words and icons. Watch for this in usability tests.

## Parking lot

- Dark mode (tokens are already semantic, so feasible later).
- `size-adjust` on the Kalam fallback to reduce layout shift.
- Full Compare (synced panes) UI — the button is in the top bar but disabled with an explanation for now.
- Per-board style switch / user-chosen accent.
- Lower roughness automatically during zoom/pan.
- Reduce inspector width on small screens / collapsible panel.
