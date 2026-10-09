import type { KitItemDef } from '../types';
import { SketchRect } from '../../design/primitives';
import { At, IconAt, TextRow, toBool, toInt } from './_helpers';

type PaginationProps = { current: number; total: number; showLabels: boolean };

const SLOT = 32;
const GAP = 4;

/** Page numbers that fit in `slots` positions, with null for "…". Always includes first, last and current. */
export function pageList(current: number, total: number, slots: number): (number | null)[] {
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);
  if (slots < 5) {
    // Too narrow for first/last + ellipses: a window of consecutive pages around the current one.
    const start = Math.max(1, Math.min(current - Math.floor((slots - 1) / 2), total - slots + 1));
    return Array.from({ length: slots }, (_, i) => start + i);
  }
  const inner = slots - 2; // between first and last
  let start = current - Math.floor((inner - 1) / 2);
  start = Math.max(2, Math.min(start, total - inner));
  const out: (number | null)[] = [1];
  for (let n = start; n < start + inner; n++) out.push(n);
  out.push(total);
  if ((out[1] as number) > 2) out[1] = null;
  if ((out[out.length - 2] as number) < total - 1) out[out.length - 2] = null;
  return out;
}

export const pagination: KitItemDef<PaginationProps> = {
  type: 'pagination',
  label: 'Pagination',
  category: 'wireframe',
  group: 'navigation',
  keywords: ['pagination', 'pager', 'pages', 'page numbers', 'next', 'previous', 'navigation'],
  defaultSize: { w: 327, h: 36 },
  minSize: { w: 96, h: 28 },
  resize: 'horizontal',
  defaultProps: { current: 3, total: 12, showLabels: false },
  editableProps: [
    { key: 'current', label: 'Current page', kind: 'number', bar: 'inline' },
    { key: 'total', label: 'Pages', kind: 'number', bar: 'inline' },
    { key: 'showLabels', label: 'Prev / Next labels', kind: 'boolean', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const total = toInt(p.total, 12, 1, 9999);
    const current = toInt(p.current, 1, 1, total);
    const s = Math.min(SLOT, h);
    const labels = toBool(p.showLabels) && w >= 280;
    const navW = labels ? 64 : s;
    const slots = Math.max(1, Math.floor((w - 2 * (navW + GAP) + GAP) / (s + GAP)));
    const pages = pageList(current, total, Math.min(slots, 9));
    const rowW = pages.length * (s + GAP) - GAP;
    const x0 = navW + GAP + Math.max(0, (w - 2 * (navW + GAP) - rowW) / 2);
    const y = (h - s) / 2;
    const nav = (dir: 'prev' | 'next', x: number, disabled: boolean) => (
      <At x={x} y={y} w={navW} h={s}>
        <SketchRect w={navW} h={s} radius={6} style={style} seed={seed + (dir === 'prev' ? 1 : 2)} stroke={disabled ? 'faint' : 'muted'} />
        {labels ? (
          <TextRow x={0} w={navW} h={s} size="sm" align="center" tone={disabled ? 'muted' : 'ink'}>{dir === 'prev' ? '‹ Prev' : 'Next ›'}</TextRow>
        ) : (
          <IconAt name={dir === 'prev' ? 'chevron-left' : 'chevron-right'} x={(navW - 16) / 2} y={(s - 16) / 2} size={16} tone={disabled ? 'faint' : 'ink'} />
        )}
      </At>
    );
    return (
      <>
        {nav('prev', 0, current === 1)}
        {pages.map((n, i) => {
          const x = x0 + i * (s + GAP);
          const on = n === current;
          return (
            <At key={i} x={x} y={y} w={s} h={s}>
              {on && <SketchRect w={s} h={s} radius={6} style={style} seed={seed + 10 + i} fill="faint" />}
              <TextRow x={0} w={s} h={s} size="sm" align="center" tone={on ? 'ink' : 'muted'} weight={on ? 700 : 400}>{n === null ? '…' : n}</TextRow>
            </At>
          );
        })}
        {nav('next', w - navW, current === total)}
      </>
    );
  },
  describe: (p) => {
    const total = toInt(p.total, 12, 1, 9999);
    return `Pagination, page ${toInt(p.current, 1, 1, total)} of ${total}`;
  },
};
