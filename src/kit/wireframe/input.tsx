import type { KitItemDef } from '../types';
import { SketchLines, SketchRect } from '../../design/primitives';
import { At, KitIconAt, TextRow, toBool } from './_helpers';

type FieldState = 'default' | 'focused' | 'error' | 'disabled';
type InputProps = { label: string; placeholder: string; showLabel: boolean; state: FieldState; helper: string };

const LABEL_H = 20;
const HELPER_H = 18;
const FIELD_STATES: FieldState[] = ['default', 'focused', 'error', 'disabled'];
const toState = (v: unknown): FieldState => (FIELD_STATES.includes(v as FieldState) ? (v as FieldState) : 'default');

export const input: KitItemDef<InputProps> = {
  type: 'input',
  label: 'Text input',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['input', 'text field', 'field', 'form', 'email', 'textbox', 'password', 'error', 'helper'],
  defaultSize: { w: 327, h: 64 },
  minSize: { w: 64, h: 32 },
  // 'both' so the field can grow to make room for helper text.
  resize: 'both',
  defaultProps: { label: 'Email', placeholder: 'you@example.com', showLabel: true, state: 'default', helper: '' },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'placeholder', label: 'Placeholder', kind: 'text', bar: 'inline' },
    { key: 'state', label: 'State', kind: 'select', options: [...FIELD_STATES], bar: 'inline' },
    { key: 'helper', label: 'Helper text', kind: 'text', bar: 'more' },
    { key: 'showLabel', label: 'Show label', kind: 'boolean', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const state = toState(p.state);
    const withLabel = toBool(p.showLabel) && h >= LABEL_H + 32;
    const fy = withLabel ? LABEL_H + 4 : 0;
    const helper = String(p.helper ?? '').trim();
    const withHelper = !!helper && h - fy >= 32 + HELPER_H;
    const fh = h - fy - (withHelper ? HELPER_H : 0);
    const disabled = state === 'disabled';
    const icon = Math.min(18, fh - 12);
    const showIcon = state === 'error' && w >= 96 && icon >= 10;
    const caret = state === 'focused';
    const tx = caret ? 16 : 12;
    return (
      <>
        {withLabel && <TextRow w={w} h={LABEL_H} size="sm" tone="muted" weight={600}>{p.label}</TextRow>}
        <At x={0} y={fy} w={w} h={fh}>
          <SketchRect w={w} h={fh} radius={6} style={style} seed={seed} stroke={disabled ? 'faint' : 'ink'} fill={disabled ? 'none' : 'surface'} strokeWidth={state === 'focused' || state === 'error' ? 2.5 : 1.5} />
          {caret && fh >= 20 && <SketchLines w={w} h={fh} lines={[[[12, fh / 2 - 8], [12, fh / 2 + 8]]]} style={style} seed={seed + 4} strokeWidth={1.5} />}
          <TextRow x={tx} w={w - tx - 12 - (showIcon ? icon + 6 : 0)} h={fh} tone="muted">{p.placeholder}</TextRow>
          {showIcon && <KitIconAt name="alert" x={w - 12 - icon} y={(fh - icon) / 2} size={icon} />}
        </At>
        {withHelper && <TextRow y={h - HELPER_H} w={w} h={HELPER_H} size="sm" tone="muted" weight={state === 'error' ? 600 : undefined}>{helper}</TextRow>}
      </>
    );
  },
  describe: (p) => {
    const s = toState(p.state);
    return `Text input '${p.label}'${p.placeholder ? `, placeholder '${p.placeholder}'` : ''}${s === 'default' ? '' : `, ${s}`}${p.helper ? `, helper '${p.helper}'` : ''}`;
  },
};
