import type { KitItemDef } from '../types';
import { SketchPolygon } from '../../design/primitives';
import { CenteredLabel } from './_helpers';

type DiamondProps = { label: string };

export const diamond: KitItemDef<DiamondProps> = {
  type: 'diamond',
  label: 'Decision',
  category: 'diagram',
  keywords: ['diamond', 'decision', 'if', 'branch', 'condition', 'question'],
  defaultSize: { w: 140, h: 100 },
  minSize: { w: 48, h: 36 },
  resize: 'both',
  defaultProps: { label: 'Decision?' },
  textProp: 'label',
  editableProps: [{ key: 'label', label: 'Question', kind: 'text' }],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const i = 1;
    return (
      <>
        <SketchPolygon w={w} h={h} style={style} seed={seed} fill="surface"
          points={[[w / 2, i], [w - i, h / 2], [w / 2, h - i], [i, h / 2]]} />
        {/* Text lives in the inner half of the diamond so it never crosses the edges. */}
        <CenteredLabel padding={`${h / 4}px ${w / 4}px`} size="sm">{p.label}</CenteredLabel>
      </>
    );
  },
  describe: (p) => `Decision '${p.label}'`,
};
