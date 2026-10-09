import type { KitItemDef } from '../types';
import { Box, SketchLines } from '../../design/primitives';
import { CHART_SHAPES, Lines, SkeletonLine, TextRow, chartSeries, splitList, toInt, type ChartShape } from './_helpers';

type StackedChartProps = { title: string; series: string; shape: ChartShape; points: number };

const TITLE_H = 24;
const LEGEND_H = 20;
// Grayscale fills, darkest at the bottom of the stack. Decorative tokens only — labels live in the legend.
const FILLS = ['var(--fs-line)', 'var(--fs-faint)', 'var(--fs-hairline)', 'var(--fs-hover)'];

function names(p: StackedChartProps): string[] {
  const s = splitList(p.series).slice(0, 4);
  while (s.length < 2) s.push(`Series ${s.length + 1}`);
  return s;
}

export const stackedChart: KitItemDef<StackedChartProps> = {
  type: 'stacked-chart',
  label: 'Stacked chart',
  category: 'wireframe',
  group: 'content',
  keywords: ['chart', 'stacked', 'area chart', 'stacked line', 'graph', 'analytics', 'data', 'series', 'dashboard'],
  defaultSize: { w: 327, h: 220 },
  minSize: { w: 96, h: 64 },
  resize: 'both',
  defaultProps: { title: 'Sessions by platform', series: 'Web, iOS, Android', shape: 'rising', points: 8 },
  textProp: 'title',
  editableProps: [
    { key: 'series', label: 'Series (2–4)', kind: 'items', bar: 'inline' },
    { key: 'shape', label: 'Trend', kind: 'select', options: [...CHART_SHAPES], bar: 'inline' },
    { key: 'title', label: 'Title', kind: 'text', bar: 'more' },
    { key: 'points', label: 'Points', kind: 'number', bar: 'more' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const labels = names(p);
    const k = labels.length;
    const head = p.title && h >= 120 ? TITLE_H + 4 : 0;
    const legend = h >= 100 && w >= 160 ? LEGEND_H + 6 : 0;
    const axisL = w >= 160 ? 32 : 6;
    const px0 = axisL;
    const px1 = w - 6;
    const py0 = head + 4;
    const py1 = h - legend - (legend ? 8 : 6);
    const n = toInt(p.points, 8, 2, 40);
    const per = labels.map((_, s) => chartSeries(p.shape, n, s + 1).map((v) => (0.35 + v * 0.65) * (0.92 / k)));
    const cum: number[][] = [];
    per.forEach((vals, s) => cum.push(vals.map((v, i) => v + (s ? cum[s - 1][i] : 0))));
    const X = (i: number) => px0 + ((px1 - px0) * i) / (n - 1);
    const Y = (v: number) => py1 - (py1 - py0) * v;
    const tops = cum.map((vals) => vals.map((v, i): [number, number] => [X(i), Y(v)]));
    const areas = tops.map((top, s) => {
      const bottom = s ? [...tops[s - 1]].reverse() : [[X(n - 1), py1], [X(0), py1]];
      return [...top, ...bottom].map((pt) => pt.join(',')).join(' ');
    });
    const grid: [number, number][][] = [0, 1, 2].map((g) => [[px0, py0 + ((py1 - py0) * g) / 3], [px1, py0 + ((py1 - py0) * g) / 3]]);
    const slot = legend ? (w - 8) / k : 0;
    return (
      <>
        {head > 0 && <TextRow w={w} h={TITLE_H} weight={700}>{p.title}</TextRow>}
        <Lines w={w} h={h} lines={grid} style={style} seed={seed + 1} stroke="faint" strokeWidth={1} />
        <svg width={w} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
          {areas.map((pts, s) => <polygon key={s} points={pts} fill={FILLS[s]} stroke="none" />)}
        </svg>
        <Lines w={w} h={h} lines={tops} style={style} seed={seed + 10} stroke="muted" strokeWidth={1.5} />
        <SketchLines w={w} h={h} lines={[[[px0, py0], [px0, py1], [px1, py1]]]} style={style} seed={seed + 2} stroke="muted" strokeWidth={1.25} />
        {axisL > 6 && [0, 1, 2].map((g) => <SkeletonLine key={g} x={4} y={py0 + ((py1 - py0) * g) / 3} w={axisL - 12} style={style} seed={seed + 20 + g} />)}
        {legend > 0 && labels.map((l, s) => (
          <Box key={s} x={4 + s * slot} y={h - LEGEND_H} w={slot - 8} h={LEGEND_H} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 'none', width: 12, height: 12, borderRadius: 3, background: FILLS[s], border: '1.25px solid var(--fs-muted)' }} />
            <TextRow x={18} w={slot - 26} h={LEGEND_H} size="sm" tone="muted">{l}</TextRow>
          </Box>
        ))}
      </>
    );
  },
  describe: (p) => `Stacked chart${p.title ? ` '${p.title}'` : ''} with series ${names(p).join(', ')}`,
};
