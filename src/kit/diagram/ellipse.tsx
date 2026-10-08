import type { KitItemDef } from '../types';
import { SketchEllipse } from '../../design/primitives';
import { CenteredLabel, SketchPill } from './_helpers';

type EllipseProps = { label: string; shape: 'pill' | 'oval' };

export const ellipse: KitItemDef<EllipseProps> = {
  type: 'ellipse',
  label: 'Start / end',
  category: 'diagram',
  keywords: ['ellipse', 'oval', 'circle', 'pill', 'start', 'end', 'terminal'],
  defaultSize: { w: 140, h: 56 },
  minSize: { w: 40, h: 28 },
  resize: 'both',
  defaultProps: { label: 'Start', shape: 'pill' },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'shape', label: 'Shape', kind: 'select', options: ['pill', 'oval'] },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => (
    <>
      {p.shape === 'oval'
        ? <SketchEllipse w={w} h={h} style={style} seed={seed} fill="surface" />
        : <SketchPill w={w} h={h} style={style} seed={seed} fill="surface" />}
      <CenteredLabel padding={`0 ${Math.min(w, h) / 3}px`}>{p.label}</CenteredLabel>
    </>
  ),
  describe: (p) => `Start/end '${p.label}'`,
};
