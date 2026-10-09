import type { KitItemDef } from '../types';
import { SketchPolygon } from '../../design/primitives';
import { TextRow } from './_helpers';

type Side = 'top' | 'bottom' | 'left' | 'right';
type TooltipProps = { text: string; arrow: Side; theme: 'dark' | 'light' };

const ARROW = 7;

/** Outline of a rounded bubble with a pointer on `side` (points, so it can be drawn sketchy too). */
export function bubblePoints(w: number, h: number, side: Side, r = 6): { points: [number, number][]; box: { x: number; y: number; w: number; h: number } } {
  const i = 1;
  const box = {
    x: side === 'left' ? ARROW + i : i,
    y: side === 'top' ? ARROW + i : i,
    w: w - 2 * i - (side === 'left' || side === 'right' ? ARROW : 0),
    h: h - 2 * i - (side === 'top' || side === 'bottom' ? ARROW : 0),
  };
  const { x, y } = box;
  const x1 = x + box.w;
  const y1 = y + box.h;
  const rr = Math.max(0, Math.min(r, box.w / 2 - ARROW, box.h / 2 - ARROW));
  const arc = (cx: number, cy: number, a0: number): [number, number][] =>
    [0, 1, 2, 3].map((k) => {
      const a = a0 + (k * Math.PI) / 6;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    });
  const mx = x + box.w / 2;
  const my = y + box.h / 2;
  const pts: [number, number][] = [];
  pts.push(...arc(x + rr, y + rr, Math.PI));
  if (side === 'top') pts.push([mx - ARROW, y], [mx, y - ARROW], [mx + ARROW, y]);
  pts.push(...arc(x1 - rr, y + rr, -Math.PI / 2));
  if (side === 'right') pts.push([x1, my - ARROW], [x1 + ARROW, my], [x1, my + ARROW]);
  pts.push(...arc(x1 - rr, y1 - rr, 0));
  if (side === 'bottom') pts.push([mx + ARROW, y1], [mx, y1 + ARROW], [mx - ARROW, y1]);
  pts.push(...arc(x + rr, y1 - rr, Math.PI / 2));
  if (side === 'left') pts.push([x, my + ARROW], [x - ARROW, my], [x, my - ARROW]);
  return { points: pts, box };
}

export const tooltip: KitItemDef<TooltipProps> = {
  type: 'tooltip',
  label: 'Tooltip',
  category: 'wireframe',
  group: 'feedback',
  keywords: ['tooltip', 'hint', 'popover', 'bubble', 'help', 'coach mark', 'callout'],
  defaultSize: { w: 140, h: 44 },
  minSize: { w: 40, h: 28 },
  resize: 'both',
  defaultProps: { text: 'Copy link', arrow: 'bottom', theme: 'dark' },
  textProp: 'text',
  editableProps: [
    { key: 'text', label: 'Text', kind: 'text', bar: 'more' },
    { key: 'arrow', label: 'Arrow', kind: 'select', options: ['top', 'bottom', 'left', 'right'], bar: 'inline' },
    { key: 'theme', label: 'Look', kind: 'select', options: ['dark', 'light'], bar: 'inline' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const side: Side = (['top', 'bottom', 'left', 'right'] as const).includes(p.arrow) ? p.arrow : 'bottom';
    const dark = p.theme !== 'light';
    const { points, box } = bubblePoints(w, h, side);
    return (
      <>
        <SketchPolygon w={w} h={h} points={points} style={style} seed={seed} stroke="ink" fill={dark ? 'ink' : 'surface'} />
        <TextRow x={box.x + 8} y={box.y} w={box.w - 16} h={box.h} size="sm" align="center" tone={dark ? 'surface' : 'ink'} weight={500}>{p.text}</TextRow>
      </>
    );
  },
  describe: (p) => `Tooltip '${p.text}' pointing ${p.arrow === 'top' ? 'up' : p.arrow === 'left' ? 'left' : p.arrow === 'right' ? 'right' : 'down'}`,
};
