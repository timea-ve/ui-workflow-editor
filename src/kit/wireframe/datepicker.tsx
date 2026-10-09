import type { KitItemDef } from '../types';
import { Box, KitText, SketchEllipse, SketchRect } from '../../design/primitives';
import { At, KitIconAt, TextRow, toBool } from './_helpers';

// Self-contained compact picker: a field plus an optional month popover drawn inside the box.
// (The full Calendar component is separate and owned by the Kit B set.)

type DatePickerProps = { label: string; value: string; open: boolean };

const LABEL_H = 20;
const FIELD_H = 40;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Best-effort, locale-free parse of "12 Oct 2026", "Oct 12, 2026" or "2026-10-12". Falls back to 12 Oct 2026. */
function parseLooseDate(v: unknown): { day: number; month: number; year: number } {
  const s = String(v ?? '');
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return clampDate(+iso[3], +iso[2] - 1, +iso[1]);
  const m = MONTHS.findIndex((name) => s.toLowerCase().includes(name.toLowerCase()));
  const year = /\b(\d{4})\b/.exec(s);
  const day = /\b(\d{1,2})\b/.exec(s.replace(/\b\d{4}\b/, ''));
  return clampDate(day ? +day[1] : 12, m >= 0 ? m : 9, year ? +year[1] : 2026);
}

function clampDate(day: number, month: number, year: number) {
  const mo = Math.min(11, Math.max(0, month));
  const dim = new Date(year, mo + 1, 0).getDate();
  return { day: Math.min(dim, Math.max(1, day)), month: mo, year };
}

export const datepicker: KitItemDef<DatePickerProps> = {
  type: 'datepicker',
  label: 'Date picker',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['date', 'date picker', 'datepicker', 'calendar', 'birthday', 'day', 'schedule', 'booking', 'form'],
  defaultSize: { w: 327, h: 64 },
  minSize: { w: 64, h: 32 },
  resize: 'both',
  defaultProps: { label: 'Date', value: '12 Oct 2026', open: false },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'value', label: 'Date', kind: 'text', bar: 'inline' },
    { key: 'open', label: 'Show open', kind: 'boolean', bar: 'inline' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const withLabel = !!p.label && h >= LABEL_H + 4 + 32;
    const fy = withLabel ? LABEL_H + 4 : 0;
    const fh = Math.min(FIELD_H, h - fy);
    const icon = Math.min(18, fh - 12);
    const showIcon = w >= 96 && icon >= 10;
    const open = toBool(p.open);
    const py = fy + fh + 4;
    const pw = Math.min(w, 280);
    const ph = h - py;
    return (
      <>
        {withLabel && <TextRow w={w} h={LABEL_H} size="sm" tone="muted" weight={600}>{p.label}</TextRow>}
        <At x={0} y={fy} w={w} h={fh}>
          <SketchRect w={w} h={fh} radius={6} style={style} seed={seed} fill="surface" strokeWidth={open ? 2.5 : 1.5} />
          <TextRow x={12} w={w - 24 - (showIcon ? icon + 6 : 0)} h={fh}>{p.value}</TextRow>
          {showIcon && <KitIconAt name="calendar" x={w - 12 - icon} y={(fh - icon) / 2} size={icon} tone="muted" />}
        </At>
        {open && ph >= 96 && pw >= 120 && (
          <At x={0} y={py} w={pw} h={ph}>
            {monthPopover({ w: pw, h: ph, value: p.value, style, seed: seed + 7 })}
          </At>
        )}
      </>
    );
  },
  describe: (p) => `Date picker${p.label ? ` '${p.label}'` : ''}, ${p.value}${toBool(p.open) ? ', calendar open' : ''}`,
};

/** Plain render helper (not a component) so this file only exports the kit def. */
function monthPopover({ w, h, value, style, seed }: { w: number; h: number; value: unknown; style: 'sketchy' | 'clean'; seed: number }) {
  const { day, month, year } = parseLooseDate(value);
  const first = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const dim = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((first + dim) / 7);
  const pad = 8;
  const headH = 24;
  const dowH = 16;
  const cw = (w - 2 * pad) / 7;
  const ch = Math.min(26, (h - 2 * pad - headH - dowH) / weeks);
  if (ch < 10) return null;
  const nav = Math.min(14, headH - 8);
  const dot = Math.min(cw, ch) - 2;
  const cells = Array.from({ length: weeks * 7 }, (_, i) => i - first + 1);
  return (
    <>
      <SketchRect w={w} h={Math.min(h, 2 * pad + headH + dowH + weeks * ch)} radius={8} style={style} seed={seed} fill="surface" />
      <TextRow x={pad + 4} y={pad} w={w - 2 * pad - 2 * nav - 16} h={headH} size="sm" weight={700}>{MONTH_NAMES[month]} {year}</TextRow>
      <KitIconAt name="chevron-left" x={w - pad - 2 * nav - 8} y={pad + (headH - nav) / 2} size={nav} tone="muted" />
      <KitIconAt name="chevron-right" x={w - pad - nav} y={pad + (headH - nav) / 2} size={nav} tone="muted" />
      {WEEKDAYS.map((d, i) => (
        <Box key={`d${i}`} x={pad + i * cw} y={pad + headH} w={cw} h={dowH} style={{ display: 'grid', placeItems: 'center' }}>
          <KitText size="sm" tone="muted" align="center" style={{ fontSize: 'calc(var(--fs-kit-text-sm) - 2px)' }}>{d}</KitText>
        </Box>
      ))}
      {cells.map((n, i) => {
        if (n < 1 || n > dim) return null;
        const x = pad + (i % 7) * cw;
        const y = pad + headH + dowH + Math.floor(i / 7) * ch;
        const sel = n === day;
        return (
          <Box key={i} x={x} y={y} w={cw} h={ch} style={{ display: 'grid', placeItems: 'center' }}>
            {sel && dot > 6 && (
              <At x={(cw - dot) / 2} y={(ch - dot) / 2} w={dot} h={dot}>
                <SketchEllipse w={dot} h={dot} style={style} seed={seed + 3} fill="faint" strokeWidth={1.25} />
              </At>
            )}
            <KitText size="sm" align="center" weight={sel ? 700 : undefined} style={{ position: 'relative', fontSize: ch < 18 ? 'calc(var(--fs-kit-text-sm) - 2px)' : undefined }}>{n}</KitText>
          </Box>
        );
      })}
    </>
  );
}
