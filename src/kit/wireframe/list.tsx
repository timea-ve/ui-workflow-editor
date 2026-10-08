import type { KitItemDef } from '../types';
import { SketchEllipse, SketchRect } from '../../design/primitives';
import { Lines, At, IconGlyph, SkeletonLine, TextRow, splitList, toBool, toInt } from './_helpers';

type ListProps = { count: number; items: string; showAvatar: boolean; showChevron: boolean };

const ROW_H = 56;
const MAX_COUNT = 50;

function labels(p: ListProps): string[] {
  const named = splitList(p.items);
  const n = toInt(p.count, 4, 1, MAX_COUNT);
  return Array.from({ length: n }, (_, i) => named[i] ?? `Item ${i + 1}`);
}

export const list: KitItemDef<ListProps> = {
  type: 'list',
  label: 'List',
  category: 'wireframe',
  keywords: ['list', 'rows', 'items', 'feed', 'table view', 'contacts', 'settings'],
  defaultSize: { w: 327, h: 224 },
  minSize: { w: 80, h: 40 },
  resize: 'both',
  defaultProps: { count: 4, items: 'Inbox, Starred, Sent, Drafts', showAvatar: true, showChevron: true },
  textProp: 'items',
  editableProps: [
    { key: 'count', label: 'Number of rows', kind: 'number' },
    { key: 'items', label: 'Row titles (comma-separated)', kind: 'text' },
    { key: 'showAvatar', label: 'Show avatar', kind: 'boolean' },
    { key: 'showChevron', label: 'Show chevron', kind: 'boolean' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const all = labels(p);
    const rowH = Math.min(ROW_H, h);
    const rows = all.slice(0, Math.max(1, Math.floor(h / rowH)));
    const avatar = toBool(p.showAvatar) && w >= 140 ? Math.min(36, rowH - 16) : 0;
    const chevron = toBool(p.showChevron) && w >= 120 ? 16 : 0;
    const tx = 12 + (avatar ? avatar + 12 : 0);
    const tw = w - tx - 12 - (chevron ? chevron + 8 : 0);
    const twoLines = rowH >= 48;
    const dividers = rows.slice(0, -1).map((_, i): [number, number][] => [[12, (i + 1) * rowH], [w - 12, (i + 1) * rowH]]);
    return (
      <>
        <SketchRect w={w} h={rows.length * rowH} radius={8} style={style} seed={seed} fill="surface" />
        {dividers.length > 0 && <Lines w={w} h={h} lines={dividers} style={style} seed={seed + 1} stroke="faint" strokeWidth={1} />}
        {rows.map((label, i) => {
          const y = i * rowH;
          return (
            <div key={i}>
              {avatar > 0 && (
                <At x={12} y={y + (rowH - avatar) / 2} w={avatar} h={avatar}>
                  <SketchEllipse w={avatar} h={avatar} style={style} seed={seed + 10 + i} stroke="muted" fill="faint" />
                </At>
              )}
              <TextRow x={tx} y={twoLines ? y + 8 : y} w={tw} h={twoLines ? 22 : rowH}>{label}</TextRow>
              {twoLines && <SkeletonLine x={tx} y={y + rowH - 16} w={Math.min(tw, tw * 0.7)} style={style} seed={seed + 30 + i} />}
              {chevron > 0 && <IconGlyph glyph="chevron-right" x={w - 12 - chevron} y={y + (rowH - chevron) / 2} size={chevron} style={style} seed={seed + 50 + i} tone="muted" />}
            </div>
          );
        })}
      </>
    );
  },
  describe: (p) => {
    const all = labels(p);
    return `List with ${all.length} row${all.length === 1 ? '' : 's'}: ${all.join(', ')}`;
  },
};
