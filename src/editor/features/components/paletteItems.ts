// The "/" Insert palette catalogue: every wireframe component, diagram shape and device frame.
import type { InsertItem } from '../../../chrome/insertSearch';
import { diagramKit, wireframeKit } from '../../../kit/registry';
import type { Device, ElementType } from '../../../model/types';

export const DRAG_MIME = 'application/x-flowsketch-insert';

export type PaletteTarget = { kind: 'element'; type: ElementType } | { kind: 'screen'; device: Device };

export interface PaletteItem extends InsertItem { target: PaletteTarget }

const SHAPE_KEYS: Partial<Record<ElementType, string>> = { rect: 'R', diamond: 'D', ellipse: 'O', label: 'T', sticky: 'N' };

const DEVICES: { device: Device; label: string; keywords: string[] }[] = [
  { device: 'mobile', label: 'Mobile screen', keywords: ['phone', 'iphone', 'android', 'frame', 'device', 'artboard', 'page'] },
  { device: 'tablet', label: 'Tablet screen', keywords: ['ipad', 'frame', 'device', 'artboard', 'page'] },
  { device: 'desktop', label: 'Desktop screen', keywords: ['web', 'browser', 'laptop', 'frame', 'device', 'artboard', 'page'] },
];

export const PALETTE_ITEMS: PaletteItem[] = [
  ...wireframeKit.map((d) => ({
    id: `kit:${d.type}`, label: d.label, group: 'Components', keywords: [d.type, ...d.keywords],
    target: { kind: 'element' as const, type: d.type },
  })),
  ...diagramKit.map((d) => ({
    id: `kit:${d.type}`, label: d.label, group: 'Shapes', keywords: [d.type, ...d.keywords],
    hint: SHAPE_KEYS[d.type],
    target: { kind: 'element' as const, type: d.type },
  })),
  ...DEVICES.map((d) => ({
    id: `screen:${d.device}`, label: d.label, group: 'Screens', keywords: ['screen', d.device, ...d.keywords],
    hint: 'F',
    target: { kind: 'screen' as const, device: d.device },
  })),
];

const byId = new Map(PALETTE_ITEMS.map((i) => [i.id, i]));
export const paletteItem = (id: string): PaletteItem | undefined => byId.get(id);
