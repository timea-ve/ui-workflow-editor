import type { KitItemDef } from '../types';
import { ICON_GLYPHS, IconGlyph, isGlyph, type IconGlyphName } from './_helpers';

type IconProps = { glyph: IconGlyphName; name: string };

export const icon: KitItemDef<IconProps> = {
  type: 'icon',
  label: 'Icon',
  category: 'wireframe',
  keywords: ['icon', 'glyph', 'symbol', 'star', 'menu', 'search', 'user', 'close', 'home'],
  defaultSize: { w: 24, h: 24 },
  minSize: { w: 12, h: 12 },
  resize: 'both',
  defaultProps: { glyph: 'star', name: '' },
  editableProps: [
    { key: 'glyph', label: 'Shape', kind: 'select', options: [...ICON_GLYPHS] },
    { key: 'name', label: 'Accessible name', kind: 'text' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const s = Math.min(w, h);
    return <IconGlyph glyph={isGlyph(p.glyph) ? p.glyph : 'circle'} x={(w - s) / 2} y={(h - s) / 2} size={s} style={style} seed={seed} />;
  },
  describe: (p) => `Icon${p.name ? ` '${p.name}'` : ''} (${isGlyph(p.glyph) ? p.glyph : 'circle'} placeholder)`,
};
