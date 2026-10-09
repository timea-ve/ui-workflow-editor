import type { KitItemDef } from '../types';
import { SketchEllipse, SketchRect } from '../../design/primitives';
import { At, IconAt, TextRow, toInt } from './_helpers';

type CalendarProps = { month: string; selected: number; rangeEnd: number; weekStart: 'monday' | 'sunday' };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const HEAD_H = 40;
const DOW_H = 24;

/** First weekday offset (0 = first column) and length of the month named in `label`, e.g. "October 2026". */
export function monthLayout(label: unknown, weekStart: 'monday' | 'sunday'): { offset: number; days: number; prevDays: number } {
  const s = String(label ?? '').toLowerCase();
  const m = MONTHS.findIndex((k) => s.includes(k));
  const y = Number(/(\d{4})/.exec(s)?.[1] ?? NaN);
  const month = m >= 0 ? m : 9;
  const year = Number.isFinite(y) ? y : 2026;
  const dow = new Date(year, month, 1).getDay(); // 0 = Sunday
  const offset = weekStart === 'sunday' ? dow : (dow + 6) % 7;
  return { offset, days: new Date(year, month + 1, 0).getDate(), prevDays: new Date(year, month, 0).getDate() };
}

export const calendar: KitItemDef<CalendarProps> = {
  type: 'calendar',
  label: 'Calendar',
  category: 'wireframe',
  group: 'content',
  keywords: ['calendar', 'month', 'date', 'date picker', 'schedule', 'day', 'range', 'booking'],
  defaultSize: { w: 327, h: 320 },
  minSize: { w: 154, h: 160 },
  resize: 'both',
  defaultProps: { month: 'October 2026', selected: 14, rangeEnd: 0, weekStart: 'monday' },
  textProp: 'month',
  editableProps: [
    { key: 'month', label: 'Month', kind: 'text', bar: 'inline' },
    { key: 'selected', label: 'Selected day', kind: 'number', bar: 'inline' },
    { key: 'rangeEnd', label: 'Range end day (0 = none)', kind: 'number', bar: 'more' },
    { key: 'weekStart', label: 'Week starts', kind: 'select', options: ['monday', 'sunday'], bar: 'more' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const weekStart = p.weekStart === 'sunday' ? 'sunday' : 'monday';
    const { offset, days, prevDays } = monthLayout(p.month, weekStart);
    const sel = toInt(p.selected, 0, 0, days);
    const end = toInt(p.rangeEnd, 0, 0, days);
    const [a, b] = sel && end && end !== sel ? [Math.min(sel, end), Math.max(sel, end)] : [sel, sel];
    const cw = w / 7;
    const gy = HEAD_H + DOW_H;
    const ch = (h - gy) / 6;
    const d = Math.max(14, Math.min(cw, ch) - 6);
    const dow = weekStart === 'sunday' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const cells = Array.from({ length: 42 }, (_, i) => {
      const n = i - offset + 1;
      if (n < 1) return { n: prevDays + n, inMonth: false };
      if (n > days) return { n: n - days, inMonth: false };
      return { n, inMonth: true };
    });
    const textSize = d >= 28 ? 'md' : 'sm';
    // Range band: one rectangle per week row.
    const bands: { x: number; y: number; w: number }[] = [];
    if (a !== b) {
      for (let r = 0; r < 6; r++) {
        const idx = cells.map((c, i) => ({ c, i })).filter(({ c, i }) => c.inMonth && c.n >= a && c.n <= b && Math.floor(i / 7) === r).map(({ i }) => i % 7);
        if (!idx.length) continue;
        const c0 = Math.min(...idx);
        const c1 = Math.max(...idx);
        bands.push({ x: c0 * cw + cw / 2, y: gy + r * ch + (ch - d) / 2, w: (c1 - c0) * cw });
      }
    }
    return (
      <>
        <SketchRect w={w} h={h} radius={8} style={style} seed={seed} fill="surface" />
        <TextRow x={14} w={w - 14 - 64} h={HEAD_H} weight={700}>{p.month}</TextRow>
        <IconAt name="chevron-left" x={w - 60} y={(HEAD_H - 18) / 2} size={18} tone="muted" />
        <IconAt name="chevron-right" x={w - 32} y={(HEAD_H - 18) / 2} size={18} tone="ink" />
        {dow.map((l, i) => <TextRow key={i} x={i * cw} y={HEAD_H} w={cw} h={DOW_H} size="sm" tone="muted" align="center" weight={600}>{l}</TextRow>)}
        {bands.map((bd, i) => bd.w > 0 && (
          <At key={`b${i}`} x={bd.x} y={bd.y} w={bd.w} h={d}>
            <SketchRect w={bd.w} h={d} style={style} seed={seed + 70 + i} stroke="none" fill="faint" />
          </At>
        ))}
        {cells.map((c, i) => {
          const x = (i % 7) * cw;
          const y = gy + Math.floor(i / 7) * ch;
          const on = c.inMonth && sel > 0 && (c.n === a || c.n === b);
          return (
            <div key={i}>
              {on && (
                <At x={x + (cw - d) / 2} y={y + (ch - d) / 2} w={d} h={d}>
                  <SketchEllipse w={d} h={d} style={style} seed={seed + 100 + i} fill="ink" />
                </At>
              )}
              <TextRow x={x} y={y} w={cw} h={ch} size={textSize} align="center" tone={on ? 'surface' : c.inMonth ? 'ink' : 'muted'} weight={on ? 700 : 400}>
                {c.n}
              </TextRow>
            </div>
          );
        })}
      </>
    );
  },
  describe: (p) => {
    const sel = toInt(p.selected, 0, 0, 31);
    const end = toInt(p.rangeEnd, 0, 0, 31);
    const pick = sel ? (end && end !== sel ? `; days ${Math.min(sel, end)}–${Math.max(sel, end)} selected` : `; day ${sel} selected`) : '';
    return `Calendar for ${p.month || 'a month'}${pick}`;
  },
};
