import type { KitItemDef } from '../types';
import { SketchRect } from '../../design/primitives';
import { TextRow, toBool } from './_helpers';

type InputProps = { label: string; placeholder: string; showLabel: boolean };

const LABEL_H = 20;

export const input: KitItemDef<InputProps> = {
  type: 'input',
  label: 'Text input',
  category: 'wireframe',
  keywords: ['input', 'text field', 'field', 'form', 'email', 'textbox', 'search field'],
  defaultSize: { w: 327, h: 64 },
  minSize: { w: 64, h: 32 },
  resize: 'horizontal',
  defaultProps: { label: 'Email', placeholder: 'you@example.com', showLabel: true },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'placeholder', label: 'Placeholder', kind: 'text' },
    { key: 'showLabel', label: 'Show label', kind: 'boolean' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const withLabel = toBool(p.showLabel) && h >= LABEL_H + 32;
    const fy = withLabel ? LABEL_H + 4 : 0;
    const fh = h - fy;
    return (
      <>
        {withLabel && <TextRow w={w} h={LABEL_H} size="sm" tone="muted" weight={600}>{p.label}</TextRow>}
        <div style={{ position: 'absolute', left: 0, top: fy, width: w, height: fh }}>
          <SketchRect w={w} h={fh} radius={6} style={style} seed={seed} fill="surface" />
          <TextRow x={12} w={w - 24} h={fh} tone="muted">{p.placeholder}</TextRow>
        </div>
      </>
    );
  },
  describe: (p) => `Text input '${p.label}'${p.placeholder ? `, placeholder '${p.placeholder}'` : ''}`,
};
