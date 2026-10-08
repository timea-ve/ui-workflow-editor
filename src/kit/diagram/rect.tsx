import type { KitItemDef } from '../types';
import { SketchRect } from '../../design/primitives';
import { CenteredLabel } from './_helpers';

type RectProps = { label: string };

export const rect: KitItemDef<RectProps> = {
  type: 'rect',
  label: 'Process',
  category: 'diagram',
  keywords: ['rect', 'rectangle', 'box', 'process', 'step', 'shape'],
  defaultSize: { w: 160, h: 72 },
  minSize: { w: 40, h: 24 },
  resize: 'both',
  defaultProps: { label: 'Step' },
  textProp: 'label',
  editableProps: [{ key: 'label', label: 'Label', kind: 'multiline' }],
  linkable: false,
  render: (p, { w, h, style, seed }) => (
    <>
      <SketchRect w={w} h={h} radius={4} style={style} seed={seed} fill="surface" />
      <CenteredLabel>{p.label}</CenteredLabel>
    </>
  ),
  describe: (p) => `Process box '${p.label}'`,
};
