import type { KitItemDef } from '../types';
import { SketchLines } from '../../design/primitives';
import { TextRow } from './_helpers';

type DividerProps = { orientation: 'horizontal' | 'vertical'; label: string };

export const divider: KitItemDef<DividerProps> = {
  type: 'divider',
  label: 'Divider',
  category: 'wireframe',
  group: 'content',
  keywords: ['divider', 'separator', 'rule', 'line', 'hr', 'or', 'section break'],
  defaultSize: { w: 327, h: 24 },
  minSize: { w: 8, h: 8 },
  resize: 'both',
  defaultProps: { orientation: 'horizontal', label: '' },
  textProp: 'label',
  editableProps: [
    { key: 'orientation', label: 'Direction', kind: 'select', options: ['horizontal', 'vertical'], bar: 'inline' },
    { key: 'label', label: 'Label (e.g. "or")', kind: 'text', bar: 'inline' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    if (p.orientation === 'vertical') {
      return <SketchLines w={w} h={h} lines={[[[w / 2, 1], [w / 2, h - 1]]]} style={style} seed={seed} stroke="faint" strokeWidth={1.25} />;
    }
    const y = h / 2;
    const label = String(p.label ?? '').trim();
    const lw = label && w >= 80 ? Math.min(w - 48, label.length * 7 + 24) : 0;
    const lines: [number, number][][] = lw
      ? [[[1, y], [(w - lw) / 2, y]], [[(w + lw) / 2, y], [w - 1, y]]]
      : [[[1, y], [w - 1, y]]];
    return (
      <>
        {lines.map((l, i) => <SketchLines key={i} w={w} h={h} lines={[l]} style={style} seed={seed + i} stroke="faint" strokeWidth={1.25} />)}
        {lw > 0 && <TextRow x={(w - lw) / 2} w={lw} h={h} size="sm" tone="muted" align="center">{label}</TextRow>}
      </>
    );
  },
  describe: (p) => `${p.orientation === 'vertical' ? 'Vertical' : 'Horizontal'} divider${p.label ? ` labelled '${p.label}'` : ''}`,
};
