# Wireframe kit set A: text, actions, inputs (phase 3, wave C)

## Summary
- **9 new components** are registered in `src/kit/wireframe/setA.ts`: Label / caption, Link, Icon button, Floating action button, Text area, Search field, Radio buttons, Slider and Date picker.
- **7 existing components were extended**: Heading, Paragraph, Button, Text input, Checkbox, Toggle and Icon.
- Every component I own sets a palette `group` (`text`, `actions`, `inputs` or `content`). Each one marks 1–3 props as `bar: 'inline'` for the context bar.
- Everything draws through the shared primitives and tokens, so the Clean and Sketchy styles both work. Nothing uses the accent colour.
- **Back-compat:** the existing templates and boards render unchanged.
  - `icon.glyph` values all map to the curated icon set. If a board sets `icon`, that value is used first.
  - Old Button and Input props keep their meaning. Any new prop that is missing falls back to `default` (or empty).

## Components and props (`bar: inline` props marked ★)
| Type | Group | Props | Notes |
|---|---|---|---|
| `heading` | text | text, level ★, align ★ | unchanged apart from the group |
| `text` (Paragraph) | text | text, **mode ★ (`text` \| `blocks`)**, size ★, align, tone | `blocks` draws one rounded `--fs-faint` bar per line that fits. The bars vary in length and the last one is shorter. They follow the alignment. The default is still `text`. |
| `caption` | text | text, size ★ (`sm` \| `xs`), align ★ | small, muted, single line. Not linkable. |
| `link` | text | text, size ★, align | underlined **ink** text (no accent), linkable |
| `button` | actions | label, variant ★, **state ★** (`default` \| `hover` \| `pressed` \| `disabled`) | **hover:** a light ink wash. **pressed:** a stronger wash, an inner top shadow, and the label moves down 1px. **disabled:** faint stroke, washed-out fill and muted label. |
| `icon-button` | actions | icon ★ (`icon` kind), state ★, shape (`circle` \| `square`), variant, name | A circle stays round when you stretch the box. A square fills the box. |
| `fab` | actions | icon ★ (default `plus`), label ★ (extended), state | Round, with a faint offset "float" shadow. With a label, it becomes an extended pill once the box is at least 2× as wide as it is tall. |
| `input` | inputs | label, placeholder ★, **state ★** (`default` \| `focused` \| `error` \| `disabled`), **helper**, showLabel | **focused:** thick stroke and a caret. **error:** thick stroke, alert icon and bold helper text. **disabled:** faint stroke. Helper text shows when the box is tall enough (84px with a label). Resize changed from horizontal to **both** so you can make room for the helper text. |
| `textarea` | inputs | label, placeholder ★ (multiline), showLabel | placeholder wraps; resize grip in the corner |
| `search` | inputs | placeholder ★, value | Pill shape with a search icon. A typed `value` shows in ink with a clear (×) icon. |
| `checkbox` / `toggle` | inputs | unchanged (checked ★ / on ★) | group only |
| `radio` | inputs | items ★ (`items` kind), selected ★ (0-based, like Tabs `active`) | 28px rows. Rows that don't fit are hidden. Not linkable. |
| `slider` | inputs | label, value ★ (0–100, clamped), minLabel, maxLabel | The label row shows the value. The min/max row is hidden when both are empty or the box is short. |
| `datepicker` | inputs | label, value ★ (free text), open ★ | Field with a calendar icon. `open` draws a compact Monday-first month grid *inside* the box when there's room (≥ 96px under the field). The month comes from the value, e.g. `12 Oct 2026`, `Oct 12, 2026` or `2026-10-12`. It is self-contained: it shares no code with Kit B's Calendar. |
| `icon` | content | glyph ★ (`icon` kind, label "Icon"), name | Uses `KIT_ICONS` through `KitIconAt`. The stroke scales with size, so a 24px or an 80px icon both read well. Unknown names fall back to `circle`. |

## Design choices
- **Icon prop key stays `glyph`.** `KitItemView` merges `defaultProps` under the saved props. If `icon` had a default, it would hide the legacy `glyph` on old boards. So the editable key is `glyph` (kind `icon`), `icon` has no default, and render reads `icon ?? glyph`.
- **Button states use washes, not new colours.** An ink layer at 8% or 18% opacity sits over the existing faint or surface fill, which keeps contrast at AA and stays on tokens. The same `ButtonFace` helper draws Button, Icon button and FAB.
- **Date picker popover is drawn inside the element's box**, the same way Dropdown does it, so selection, hit-testing and export bounds stay right. Toggling `open` in a 64px box changes nothing until you make the box taller. The gallery shows the closed state.
- **Option strings are lowercase**, to match the existing components (`primary`, `left`).

## Helpers (appended to `_helpers.tsx` in the "Kit set A helpers" block)
- `BUTTON_STATES`, `toButtonState` and `stateSuffix`
- `ButtonFace`: rect or circle face in four states
- `KitIconAt`: a curated icon in a token colour, with the stroke scaled to its size
- `PlaceholderBars`: greeked copy bars

The block reuses the `KitIcon` import that Kit B's block declares.

## Tests
- `src/kit/wireframe/setA.test.tsx`: 106 tests, all passing.
  - For each of the 16 owned components: metadata, group, inline-prop count, select defaults among the options, rendering in both styles at default and minimum size, and junk props.
  - Behaviour: Paragraph blocks, Button state rendering and descriptions, every curated icon plus the legacy glyphs, radio selection and overflow, slider clamping, the date-picker month grid (Feb 2027 has no 29th), the search query, input helper text, and the extended FAB.
- `tsc -b` is clean. `npm run lint` shows no new warnings in my files.

## Screenshots
- `docs/phase-3/wave-c-kit-a.png`: the Kit A rows in `/gallery` (Sketchy on the left, Clean on the right).
- `docs/phase-3/wave-c-kit-a-states.png`: every state and the small-size cases, in both styles.

## For the Orchestrator
- **`kit.test.tsx` needs two changes.**
  - Add `'caption'` and `'link'` to `TEXT_ONLY`. They are text-only and draw no SVG, so the "renders … size" tests fail without this.
  - Update the "registers all" list as planned.
- **`paletteItems.test.ts` currently fails** on the count and on `phone` → icon ranking. Both come from the palette and context-bar work, not from this set.
- **Gallery `STATES`:** consider adding Button hover/pressed/disabled, Input error with helper, Paragraph blocks and Date picker open (h ≈ 290).
