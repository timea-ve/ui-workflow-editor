import type { KitItemDef } from '../types';
import { SketchLines, SketchRect } from '../../design/primitives';
import { At, IconAt, TextRow, iconForLabel, splitList, toBool, toInt } from './_helpers';

type SidebarProps = { title: string; items: string; active: number; collapsed: boolean; showIcons: boolean };

const ROW_H = 40;
const HEAD_H = 56;
const ICON = 18;

export const sidebar: KitItemDef<SidebarProps> = {
  type: 'sidebar',
  label: 'Sidebar',
  category: 'wireframe',
  group: 'navigation',
  keywords: ['sidebar', 'side nav', 'side navigation', 'drawer', 'vertical nav', 'menu', 'rail', 'navigation'],
  defaultSize: { w: 240, h: 400 },
  minSize: { w: 48, h: 96 },
  resize: 'both',
  defaultProps: { title: 'Workspace', items: 'Home, Projects, Tasks, Reports, Team, Settings', active: 0, collapsed: false, showIcons: true },
  textProp: 'title',
  editableProps: [
    { key: 'items', label: 'Items', kind: 'items', bar: 'inline' },
    { key: 'active', label: 'Active item', kind: 'number', itemsFrom: 'items', bar: 'inline' },
    { key: 'collapsed', label: 'Icons only', kind: 'boolean', bar: 'inline' },
    { key: 'title', label: 'Title', kind: 'text', bar: 'more' },
    { key: 'showIcons', label: 'Icons', kind: 'boolean', bar: 'more' },
  ],
  linkable: true,
  itemRects: (p, { w, h }) => {
    const collapsed = toBool(p.collapsed) || w < 96;
    const all = splitList(p.items);
    const headH = p.title || collapsed ? Math.min(HEAD_H, h / 4) : 8;
    const rowH = Math.min(ROW_H, Math.max(28, (h - headH - 8) / Math.max(1, all.length)));
    return all.slice(0, Math.max(0, Math.floor((h - headH - 8) / rowH)))
      .map((label, i) => ({ label, x: 8, y: headH + 8 + i * rowH, w: w - 16, h: rowH }));
  },
  render: (p, { w, h, style, seed }) => {
    const collapsed = toBool(p.collapsed) || w < 96;
    const icons = collapsed || toBool(p.showIcons);
    const all = splitList(p.items);
    const headH = p.title || collapsed ? Math.min(HEAD_H, h / 4) : 8;
    const rowH = Math.min(ROW_H, Math.max(28, (h - headH - 8) / Math.max(1, all.length)));
    const items = all.slice(0, Math.max(0, Math.floor((h - headH - 8) / rowH)));
    const active = toInt(p.active, 0, -1, Math.max(0, all.length - 1));
    const pad = 8;
    const logo = Math.min(24, headH - 16);
    return (
      <>
        <SketchRect w={w} h={h} style={style} seed={seed} fill="surface" />
        {logo >= 12 && (
          <At x={collapsed ? (w - logo) / 2 : 16} y={(headH - logo) / 2} w={logo} h={logo}>
            <SketchRect w={logo} h={logo} radius={6} style={style} seed={seed + 2} fill="faint" stroke="muted" />
          </At>
        )}
        {!collapsed && p.title && <TextRow x={16 + logo + 10} w={w - 16 - logo - 10 - 12} h={headH} weight={700}>{p.title}</TextRow>}
        {headH > 8 && <SketchLines w={w} h={h} lines={[[[12, headH], [w - 12, headH]]]} style={style} seed={seed + 3} stroke="faint" strokeWidth={1} />}
        {items.map((label, i) => {
          const y = headH + 8 + i * rowH;
          const on = i === active;
          const tone = on ? 'ink' : 'muted';
          const iconX = collapsed ? (w - ICON) / 2 : pad + 10;
          const tx = icons ? iconX + ICON + 10 : pad + 10;
          return (
            <div key={i}>
              {on && (
                <At x={pad} y={y + 2} w={w - pad * 2} h={rowH - 4}>
                  <SketchRect w={w - pad * 2} h={rowH - 4} radius={6} style={style} seed={seed + 20 + i} stroke="none" fill="faint" />
                </At>
              )}
              {icons && <IconAt name={iconForLabel(label, i)} x={iconX} y={y + (rowH - ICON) / 2} size={ICON} tone={tone} />}
              {!collapsed && <TextRow x={tx} y={y} w={w - tx - pad - 8} h={rowH} tone={tone} weight={on ? 700 : 400}>{label}</TextRow>}
            </div>
          );
        })}
      </>
    );
  },
  describe: (p) => {
    const items = splitList(p.items);
    const a = items[toInt(p.active, 0, -1, Math.max(0, items.length - 1))];
    return `Sidebar${p.title ? ` '${p.title}'` : ''}${toBool(p.collapsed) ? ' (icons only)' : ''} with ${items.length} item${items.length === 1 ? '' : 's'}: ${items.join(', ') || 'none'}${a ? `; '${a}' selected` : ''}`;
  },
};
