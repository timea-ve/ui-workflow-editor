import type { KitItemDef } from '../types';
import { KitText } from '../../design/primitives';
import { BUTTON_STATES, ButtonFace, stateSuffix, toButtonState, type ButtonState } from './_helpers';

// Reference implementation — the Wireframe Kit agent follows this pattern
// for all other components (one file per component, registered in index.ts).

type ButtonProps = { label: string; variant: 'primary' | 'secondary'; state: ButtonState };

export const button: KitItemDef<ButtonProps> = {
  type: 'button',
  label: 'Button',
  category: 'wireframe',
  group: 'actions',
  keywords: ['button', 'cta', 'action', 'submit', 'primary', 'secondary', 'disabled', 'hover', 'pressed'],
  defaultSize: { w: 140, h: 40 },
  minSize: { w: 48, h: 28 },
  resize: 'both',
  defaultProps: { label: 'Button', variant: 'primary', state: 'default' },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'variant', label: 'Style', kind: 'select', options: ['primary', 'secondary'], bar: 'inline' },
    { key: 'state', label: 'State', kind: 'select', options: [...BUTTON_STATES], bar: 'inline' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const state = toButtonState(p.state);
    const primary = p.variant !== 'secondary';
    return (
      <>
        <ButtonFace w={w} h={h} radius={6} filled={primary} state={state} style={style} seed={seed} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '0 8px', transform: state === 'pressed' ? 'translateY(1px)' : undefined }}>
          <KitText align="center" weight={primary ? 700 : 400} tone={state === 'disabled' ? 'muted' : 'ink'}>{p.label}</KitText>
        </div>
      </>
    );
  },
  describe: (p) => `Button '${p.label}'${stateSuffix(p.state)}`,
};
