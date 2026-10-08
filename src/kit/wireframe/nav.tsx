import type { KitItemDef } from '../types';
import { SketchLines, SketchRect } from '../../design/primitives';
import { IconGlyph, TextRow, splitList, toBool, toInt, type IconGlyphName } from './_helpers';

type NavProps = { items: string; active: number; showIcons: boolean };

const MIN_ITEM_W = 48;
// Generic placeholder glyphs cycled across items.
const GLYPHS: IconGlyphName[] = ['home', 'search', 'plus', 'user', 'more', 'star'];

export const nav: KitItemDef<NavProps> = {
  type: 'nav',
  label: 'Navigation bar',
  category: 'wireframe',
  keywords: ['nav', 'navigation', 'tab bar', 'bottom bar', 'menu', 'links'],
  defaultSize: { w: 375, h: 64 },
  minSize: { w: 120, h: 36 },
  resize: 'horizontal',
  defaultProps: { items: 'Home, Search, Saved, Profile', active: 0, showIcons: true },
  textProp: 'items',
  editableProps: [
    { key: 'items', label: 'Items (comma-separated)', kind: 'text' },
    { key: 'active', label: 'Active item (0 = first)', kind: 'number' },
    { key: 'showIcons', label: 'Show icons', kind: 'boolean' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const all = splitList(p.items);
    const items = all.slice(0, Math.max(1, Math.floor(w / MIN_ITEM_W)));
    const active = toInt(p.active, 0, 0, Math.max(0, all.length - 1));
    const iw = w / Math.max(1, items.length);
    const withIcons = toBool(p.showIcons) && h >= 52;
    const icon = Math.min(22, h - 34);
    return (
      <>
        <SketchRect w={w} h={h} style={style} seed={seed} fill="surface" />
        {items.map((label, i) => {
          const on = i === active;
          const tone = on ? 'ink' : 'muted';
          return (
            <div key={i}>
              {withIcons && (
                <IconGlyph glyph={GLYPHS[i % GLYPHS.length]} x={i * iw + (iw - icon) / 2} y={8} size={icon} style={style} seed={seed + 10 + i} tone={tone} />
              )}
              <TextRow x={i * iw + 4} y={withIcons ? h - 24 : 0} w={iw - 8} h={withIcons ? 20 : h} size={withIcons ? 'sm' : 'md'} align="center" tone={tone} weight={on ? 700 : 400}>
                {label}
              </TextRow>
              {on && !withIcons && (
                <SketchLines w={w} h={h} lines={[[[i * iw + iw * 0.25, h - 6], [i * iw + iw * 0.75, h - 6]]]} style={style} seed={seed + 40} strokeWidth={2.5} />
              )}
            </div>
          );
        })}
      </>
    );
  },
  describe: (p) => {
    const items = splitList(p.items);
    const active = items[toInt(p.active, 0, 0, Math.max(0, items.length - 1))];
    return `Navigation with ${items.length} item${items.length === 1 ? '' : 's'}: ${items.join(', ') || 'none'}${active ? `; '${active}' selected` : ''}`;
  },
};
