# Phase 3 — Wave C (Gate 3 changes)

Requested by the Director at Gate 3. Three agents work in parallel with no overlapping files.

| Agent | Owns | Delivers |
|---|---|---|
| **Kit A**: text, actions, inputs | `src/kit/wireframe/setA.ts` and its new component files; edits `text.tsx`, `button.tsx`, `icon.tsx`, `input.tsx`, `checkbox.tsx`, `toggle.tsx`, `heading.tsx` | Paragraph that switches between lorem text and grey blocks; Label/caption; Link; Button states (default/hover/pressed/disabled); Icon button; FAB; Text area; Search field; Radio; Slider; Date picker; Icon uses the real icon set |
| **Kit B**: navigation, content, feedback | `src/kit/wireframe/setB.ts` and its new component files; edits `header.tsx`, `nav.tsx`, `tabs.tsx`, `dropdown.tsx`, `list.tsx`, `table.tsx`, `card.tsx`, `image.tsx`, `modal.tsx` | Top nav (web header variant); Sidebar; Tabs with editable names; Menu list with editable options; Breadcrumbs; Pagination; Mobile tab bar; Video; Avatar; Calendar; Line chart; Stacked line chart; Divider; Tooltip; Toast/alert; Badge/tag; Progress bar; Spinner |
| **Context bar & canvas feel** | `src/editor/features/components/**` (incl. replacing `InspectorPanel`), `src/editor/snap.ts`, `src/flow/FlowCanvas.tsx` (drag snapping and grid only), `src/design/tokens.css`, `src/kit/KitItemView.tsx`, `src/chrome/InsertPalette.tsx`, `src/chrome/insertSearch.ts`, `src/chrome/Inspector.tsx` | Floating context bar (per-component options: state, text style, items, icon); grid and neighbour snapping with a subtle dot grid; muted grey component palette (text still WCAG AA); palette grouped by section |

**Fixed by the Orchestrator (do not change without asking):**
- `ElementType` names in `src/model/types.ts`.
- `PropField.kind` adds `items` (comma-separated string edited as a list) and `icon` (name from `KIT_ICON_NAMES`). Optional `PropField.bar: 'inline' | 'more'`.
- `KitItemDef.group`: `text | actions | inputs | navigation | content | feedback`.
- `src/kit/icons.tsx` provides `KIT_ICONS`, `KIT_ICON_NAMES` and `<KitIcon name size />`.

## Result (integrated by the Orchestrator)
- Reports: [kit-a.md](kit-a.md), [kit-b.md](kit-b.md), [context-bar.md](context-bar.md).
- Integration added `PropField.itemsFrom`. A `number` prop that is an index into an `items` prop is shown on the bar as a menu of item names (Tabs, Mobile tab bar, Radio, Menu, Sidebar).
- 926 unit tests, 43 e2e tests, tsc and lint all clean.

### Parking lot (from agents, for the Director)
- An icon per item in the list editor; editable chart data; date ranges across months; an optional animated spinner (respecting reduced motion); tooltips and menus attached to another element.
- "Play from this screen"; text-style controls on the bar; equal-gap snapping while resizing.
- Switching Header to "web" could also widen it to desktop width.
