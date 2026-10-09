// The "/" Insert palette catalogue: every wireframe component (grouped like the kit), diagram shape,
// device frame and icon, plus a hint for the Arrow tool (connectors are drawn, not inserted).
import type { ToolId } from '../../../chrome/tools';
import type { InsertItem } from '../../../chrome/insertSearch';
import { KIT_ICON_NAMES } from '../../../kit/icons';
import { diagramKit, kitRegistry, wireframeKit } from '../../../kit/registry';
import type { KitGroup } from '../../../kit/types';
import type { Device, ElementType } from '../../../model/types';

export const DRAG_MIME = 'application/x-flowsketch-insert';

export type PaletteTarget =
  | { kind: 'element'; type: ElementType; /** Initial props merged over the kit defaults (e.g. an icon preset). */ props?: Record<string, unknown> }
  | { kind: 'screen'; device: Device }
  | { kind: 'tool'; tool: ToolId };

export interface PaletteItem extends InsertItem { target: PaletteTarget }

const SHAPE_KEYS: Partial<Record<ElementType, string>> = { rect: 'R', diamond: 'D', ellipse: 'O', label: 'T', sticky: 'N' };

const DEVICES: { device: Device; label: string; keywords: string[] }[] = [
  { device: 'mobile', label: 'Mobile screen', keywords: ['phone', 'iphone', 'android', 'frame', 'device', 'artboard', 'page'] },
  { device: 'tablet', label: 'Tablet screen', keywords: ['ipad', 'frame', 'device', 'artboard', 'page'] },
  { device: 'desktop', label: 'Desktop screen', keywords: ['web', 'browser', 'laptop', 'frame', 'device', 'artboard', 'page'] },
];

/** Section order and headings for wireframe components (by `KitItemDef.group`). */
export const KIT_GROUP_LABELS: Record<KitGroup, string> = {
  text: 'Text',
  actions: 'Buttons & actions',
  inputs: 'Form inputs',
  navigation: 'Navigation',
  content: 'Content & layout',
  feedback: 'Feedback & overlays',
};
const GROUP_ORDER = Object.keys(KIT_GROUP_LABELS) as KitGroup[];
const groupRank = (g?: KitGroup) => (g ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);

/** Human label for an icon name: 'arrow-left' → 'Arrow left'. */
export const iconLabel = (name: string) => {
  const s = name.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** The Icon component's icon prop (the kit keeps `glyph` for old boards; read from its field so both stay in sync). */
const ICON_KEY = kitRegistry.get('icon')?.editableProps.find((f) => f.kind === 'icon')?.key ?? 'icon';

const components = wireframeKit
  .map((d, i) => ({ d, i }))
  .sort((a, b) => groupRank(a.d.group) - groupRank(b.d.group) || a.i - b.i)
  .map(({ d }) => d);

export const PALETTE_ITEMS: PaletteItem[] = [
  ...components.map((d) => ({
    id: `kit:${d.type}`, label: d.label, group: d.group ? KIT_GROUP_LABELS[d.group] : 'Components',
    keywords: [d.type, ...d.keywords],
    target: { kind: 'element' as const, type: d.type },
  })),
  ...diagramKit.map((d) => ({
    id: `kit:${d.type}`, label: d.label, group: 'Shapes', keywords: [d.type, ...d.keywords],
    hint: SHAPE_KEYS[d.type],
    target: { kind: 'element' as const, type: d.type },
  })),
  {
    id: 'tool:arrow', label: 'Arrow (connector)', group: 'Shapes', hint: 'A',
    keywords: ['arrow', 'connector', 'line', 'link', 'edge', 'flow'],
    target: { kind: 'tool', tool: 'arrow' },
  },
  ...DEVICES.map((d) => ({
    id: `screen:${d.device}`, label: d.label, group: 'Screens', keywords: ['screen', d.device, ...d.keywords],
    hint: 'F',
    target: { kind: 'screen' as const, device: d.device },
  })),
  ...KIT_ICON_NAMES.map((name) => ({
    id: `icon:${name}`, label: iconLabel(name), group: 'Icons', tile: true,
    keywords: ['icon', 'glyph', 'symbol', name, ...name.split('-')],
    target: { kind: 'element' as const, type: 'icon' as ElementType, props: { [ICON_KEY]: name } },
  })),
];

const byId = new Map(PALETTE_ITEMS.map((i) => [i.id, i]));
export const paletteItem = (id: string): PaletteItem | undefined => byId.get(id);
