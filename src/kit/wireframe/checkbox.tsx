import type { KitItemDef } from '../types';
import { SketchLines, SketchRect } from '../../design/primitives';
import { At, TextRow, toBool } from './_helpers';

type CheckboxProps = { label: string; checked: boolean };

export const checkbox: KitItemDef<CheckboxProps> = {
  type: 'checkbox',
  label: 'Checkbox',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['checkbox', 'check', 'tick', 'agree', 'option', 'form'],
  defaultSize: { w: 240, h: 24 },
  minSize: { w: 24, h: 20 },
  resize: 'horizontal',
  defaultProps: { label: 'Remember me', checked: false },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'checked', label: 'Checked', kind: 'boolean', bar: 'inline' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const s = Math.min(18, h - 2);
    const y = (h - s) / 2;
    const checked = toBool(p.checked);
    return (
      <>
        <At x={1} y={y} w={s} h={s}>
          <SketchRect w={s} h={s} radius={3} style={style} seed={seed} fill={checked ? 'faint' : 'surface'} />
          {checked && (
            <SketchLines w={s} h={s} lines={[[[s * 0.2, s * 0.52], [s * 0.42, s * 0.75], [s * 0.82, s * 0.25]]]} style={style} seed={seed + 2} strokeWidth={2} />
          )}
        </At>
        <TextRow x={s + 10} w={w - s - 10} h={h}>{p.label}</TextRow>
      </>
    );
  },
  describe: (p) => `Checkbox '${p.label}', ${toBool(p.checked) ? 'checked' : 'not checked'}`,
};
