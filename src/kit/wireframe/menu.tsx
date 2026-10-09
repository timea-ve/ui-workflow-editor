import type { KitItemDef } from '../types';
import { SketchLines, SketchRect } from '../../design/primitives';
import { At, IconAt, TextRow, iconForLabel, splitList, toBool, toInt } from './_helpers';

type MenuProps = { items: string; highlight: number; showIcons: boolean; divider: boolean };

const ROW_H = 36;
const PAD = 6;
const DIV_H = 9;
const ICON = 16;

export const menu: KitItemDef<MenuProps> = {
  type: 'menu',
  label: 'Menu',
  category: 'wireframe',
  group: 'navigation',
  keywords: ['menu', 'dropdown menu', 'popover', 'context menu', 'options', 'actions', 'overflow', 'list'],
  defaultSize: { w: 200, h: 165 },
  minSize: { w: 64, h: 48 },
  resize: 'both',
  defaultProps: { items: 'Profile, Settings, Help, Log out', highlight: 0, showIcons: true, divider: true },
  textProp: 'items',
  editableProps: [
    { key: 'items', label: 'Options', kind: 'items', bar: 'inline' },
    { key: 'highlight', label: 'Highlighted', kind: 'number', itemsFrom: 'items', bar: 'inline' },
    { key: 'showIcons', label: 'Icons', kind: 'boolean', bar: 'more' },
    { key: 'divider', label: 'Divider before last', kind: 'boolean', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const all = splitList(p.items);
    const withDivider = toBool(p.divider) && all.length > 1;
    const icons = toBool(p.showIcons) && w >= 100;
    const hi = toInt(p.highlight, 0, -1, Math.max(0, all.length - 1));
    // Rows that fit; the divider only shows if the last item fits too.
    let room = h - PAD * 2;
    const rows: { label: string; i: number; y: number }[] = [];
    let y = PAD;
    for (let i = 0; i < all.length && room >= ROW_H; i++) {
      if (withDivider && i === all.length - 1) {
        if (room < ROW_H + DIV_H) break;
        y += DIV_H;
        room -= DIV_H;
      }
      rows.push({ label: all[i], i, y });
      y += ROW_H;
      room -= ROW_H;
    }
    const showDiv = withDivider && rows.length === all.length;
    const divY = showDiv ? rows[rows.length - 1].y - DIV_H / 2 - 0.5 : 0;
    return (
      <>
        <SketchRect w={w} h={h} radius={8} style={style} seed={seed} fill="surface" />
        {showDiv && <SketchLines w={w} h={h} lines={[[[1, divY], [w - 1, divY]]]} style={style} seed={seed + 2} stroke="faint" strokeWidth={1} />}
        {rows.map(({ label, i, y: ry }) => {
          const on = i === hi;
          const tx = icons ? 12 + ICON + 10 : 12;
          return (
            <div key={i}>
              {on && (
                <At x={PAD} y={ry} w={w - PAD * 2} h={ROW_H}>
                  <SketchRect w={w - PAD * 2} h={ROW_H} radius={4} style={style} seed={seed + 10 + i} stroke="none" fill="faint" />
                </At>
              )}
              {icons && <IconAt name={iconForLabel(label, i)} x={12} y={ry + (ROW_H - ICON) / 2} size={ICON} tone={on ? 'ink' : 'muted'} />}
              <TextRow x={tx} y={ry} w={w - tx - 12} h={ROW_H} weight={on ? 600 : 400}>{label}</TextRow>
            </div>
          );
        })}
      </>
    );
  },
  describe: (p) => {
    const items = splitList(p.items);
    const a = items[toInt(p.highlight, 0, -1, Math.max(0, items.length - 1))];
    return `Menu with ${items.length} option${items.length === 1 ? '' : 's'}: ${items.join(', ') || 'none'}${a ? `; '${a}' highlighted` : ''}`;
  },
};
