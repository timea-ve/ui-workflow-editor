import type { KitItemDef } from '../types';
import { Box, SketchRect } from '../../design/primitives';
import { At, Lines, MultilineText, TextRow, toBool } from './_helpers';

type TextareaProps = { label: string; placeholder: string; showLabel: boolean };

const LABEL_H = 20;
const PAD = 12;

export const textarea: KitItemDef<TextareaProps> = {
  type: 'textarea',
  label: 'Text area',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['textarea', 'text area', 'multiline', 'message', 'comment', 'notes', 'feedback', 'description', 'form'],
  defaultSize: { w: 327, h: 128 },
  minSize: { w: 64, h: 40 },
  resize: 'both',
  defaultProps: { label: 'Message', placeholder: 'Tell us a bit more…', showLabel: true },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'placeholder', label: 'Placeholder', kind: 'multiline', bar: 'inline' },
    { key: 'showLabel', label: 'Show label', kind: 'boolean', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const withLabel = toBool(p.showLabel) && h >= LABEL_H + 4 + 48;
    const fy = withLabel ? LABEL_H + 4 : 0;
    const fh = h - fy;
    const g = Math.min(10, fh / 4);
    return (
      <>
        {withLabel && <TextRow w={w} h={LABEL_H} size="sm" tone="muted" weight={600}>{p.label}</TextRow>}
        <At x={0} y={fy} w={w} h={fh}>
          <SketchRect w={w} h={fh} radius={6} style={style} seed={seed} fill="surface" />
          <Box x={PAD} y={10} w={Math.max(0, w - 2 * PAD)} h={Math.max(0, fh - 20)} style={{ overflow: 'hidden' }}>
            <MultilineText h={Math.max(0, fh - 20)} tone="muted">{p.placeholder}</MultilineText>
          </Box>
          {w >= 48 && fh >= 32 && (
            <Lines w={w} h={fh} lines={[[[w - 4 - g, fh - 4], [w - 4, fh - 4 - g]], [[w - 4 - g / 2, fh - 4], [w - 4, fh - 4 - g / 2]]]} style={style} seed={seed + 3} stroke="muted" strokeWidth={1.25} />
          )}
        </At>
      </>
    );
  },
  describe: (p) => `Text area '${p.label}'${p.placeholder ? `, placeholder '${p.placeholder}'` : ''}`,
};
