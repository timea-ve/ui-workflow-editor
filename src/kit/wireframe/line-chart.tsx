import type { KitItemDef } from '../types';
import { SketchEllipse, SketchLines } from '../../design/primitives';
import { At, CHART_SHAPES, Lines, SkeletonLine, TextRow, chartSeries, toBool, toInt, type ChartShape } from './_helpers';

type LineChartProps = { title: string; shape: ChartShape; points: number; legend: string; showDots: boolean };

const TITLE_H = 24;
const AXIS_L = 32;
const AXIS_B = 20;

export const lineChart: KitItemDef<LineChartProps> = {
  type: 'line-chart',
  label: 'Line chart',
  category: 'wireframe',
  group: 'content',
  keywords: ['chart', 'line chart', 'graph', 'trend', 'analytics', 'data', 'plot', 'metrics', 'dashboard'],
  defaultSize: { w: 327, h: 200 },
  minSize: { w: 96, h: 64 },
  resize: 'both',
  defaultProps: { title: 'Revenue', shape: 'rising', points: 8, legend: 'This year', showDots: true },
  textProp: 'title',
  editableProps: [
    { key: 'title', label: 'Title', kind: 'text', bar: 'more' },
    { key: 'shape', label: 'Trend', kind: 'select', options: [...CHART_SHAPES], bar: 'inline' },
    { key: 'points', label: 'Points', kind: 'number', bar: 'inline' },
    { key: 'legend', label: 'Legend (empty = hide)', kind: 'text', bar: 'more' },
    { key: 'showDots', label: 'Dots', kind: 'boolean', bar: 'more' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const head = (p.title || p.legend) && h >= 100 ? TITLE_H + 8 : 0;
    const axisL = w >= 160 ? AXIS_L : 6;
    const axisB = h >= 100 ? AXIS_B : 6;
    const px0 = axisL;
    const px1 = w - 6;
    const py0 = head + 4;
    const py1 = h - axisB;
    const n = toInt(p.points, 8, 2, 40);
    const vals = chartSeries(p.shape, n);
    const pts: [number, number][] = vals.map((v, i) => [px0 + ((px1 - px0) * i) / (n - 1), py1 - (py1 - py0) * (0.08 + v * 0.84)]);
    const grid: [number, number][][] = [1, 2, 3].map((k) => [[px0, py0 + ((py1 - py0) * (k - 1)) / 3], [px1, py0 + ((py1 - py0) * (k - 1)) / 3]]);
    const dots = toBool(p.showDots) && n <= 16 && (px1 - px0) / n >= 10;
    const legendW = p.legend && w >= 200 ? Math.min(w / 2, p.legend.length * 7 + 28) : 0;
    return (
      <>
        {head > 0 && p.title && <TextRow w={w - legendW - 8} h={TITLE_H} weight={700}>{p.title}</TextRow>}
        {head > 0 && legendW > 0 && (
          <>
            <SketchLines w={w} h={h} lines={[[[w - legendW, TITLE_H / 2], [w - legendW + 14, TITLE_H / 2]]]} style={style} seed={seed + 9} strokeWidth={2} />
            <TextRow x={w - legendW + 20} w={legendW - 20} h={TITLE_H} size="sm" tone="muted">{p.legend}</TextRow>
          </>
        )}
        <Lines w={w} h={h} lines={grid} style={style} seed={seed + 1} stroke="faint" strokeWidth={1} />
        <SketchLines w={w} h={h} lines={[[[px0, py0], [px0, py1], [px1, py1]]]} style={style} seed={seed + 2} stroke="muted" strokeWidth={1.25} />
        {axisL > 6 && [0, 1, 2].map((k) => <SkeletonLine key={k} x={4} y={py0 + ((py1 - py0) * k) / 3} w={axisL - 12} style={style} seed={seed + 20 + k} />)}
        {axisB > 6 && [0, 1, 2, 3].map((k) => <SkeletonLine key={`x${k}`} x={px0 + ((px1 - px0) * (k + 0.5)) / 4 - 10} y={h - 8} w={20} style={style} seed={seed + 30 + k} />)}
        <SketchLines w={w} h={h} lines={[pts]} style={style} seed={seed + 3} stroke="ink" strokeWidth={2} />
        {dots && pts.map(([x, y], i) => (
          <At key={i} x={x - 3.5} y={y - 3.5} w={7} h={7}>
            <SketchEllipse w={7} h={7} style={style} seed={seed + 40 + i} fill="surface" strokeWidth={1.5} />
          </At>
        ))}
      </>
    );
  },
  describe: (p) => `Line chart${p.title ? ` '${p.title}'` : ''}, ${CHART_SHAPES.includes(p.shape) ? p.shape : 'rising'} trend over ${toInt(p.points, 8, 2, 40)} points`,
};
