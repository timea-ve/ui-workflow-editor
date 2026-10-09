import type { KitItemDef } from '../types';
import { KIT_ICONS } from '../icons';
import { KitIconAt } from './_helpers';

// The icon name lives in `glyph` (kept from the first kit so existing boards and templates
// still render); `icon` is honoured too if a board sets it. Values are KIT_ICON_NAMES.
type IconProps = { glyph: string; name: string; icon?: string };

const iconName = (p: Partial<IconProps>): string => {
  const n = p.icon ?? p.glyph;
  return typeof n === 'string' && n in KIT_ICONS ? n : 'circle';
};

export const icon: KitItemDef<IconProps> = {
  type: 'icon',
  label: 'Icon',
  category: 'wireframe',
  group: 'content',
  keywords: ['icon', 'glyph', 'symbol', 'pictogram', 'star', 'menu', 'search', 'user', 'close', 'home', 'heart', 'settings'],
  defaultSize: { w: 24, h: 24 },
  minSize: { w: 12, h: 12 },
  resize: 'both',
  defaultProps: { glyph: 'star', name: '' },
  editableProps: [
    { key: 'glyph', label: 'Icon', kind: 'icon', bar: 'inline' },
    { key: 'name', label: 'Accessible name', kind: 'text', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h }) => {
    const s = Math.min(w, h);
    return <KitIconAt name={iconName(p)} x={(w - s) / 2} y={(h - s) / 2} size={s} />;
  },
  describe: (p) => `Icon${p.name ? ` '${p.name}'` : ''} (${iconName(p)})`,
};
