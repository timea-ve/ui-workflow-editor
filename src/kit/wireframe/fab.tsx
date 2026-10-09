import type { KitItemDef } from '../types';
import { KitText } from '../../design/primitives';
import { KIT_ICONS } from '../icons';
import { At, BUTTON_STATES, ButtonFace, KitIconAt, stateSuffix, toButtonState, type ButtonState } from './_helpers';

type FabProps = { icon: string; label: string; state: ButtonState };

const iconOf = (v: unknown) => (typeof v === 'string' && v in KIT_ICONS ? v : 'plus');
const SHADOW = 3;

export const fab: KitItemDef<FabProps> = {
  type: 'fab',
  label: 'Floating action button',
  category: 'wireframe',
  group: 'actions',
  keywords: ['fab', 'floating', 'floating action button', 'add', 'plus', 'compose', 'create', 'new', 'mobile'],
  defaultSize: { w: 56, h: 56 },
  minSize: { w: 32, h: 32 },
  resize: 'both',
  defaultProps: { icon: 'plus', label: '', state: 'default' },
  textProp: 'label',
  editableProps: [
    { key: 'icon', label: 'Icon', kind: 'icon', bar: 'inline' },
    { key: 'label', label: 'Label (extended)', kind: 'text', bar: 'inline' },
    { key: 'state', label: 'State', kind: 'select', options: [...BUTTON_STATES], bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const state = toButtonState(p.state);
    const label = String(p.label ?? '').trim();
    // Extended FAB (pill with icon + label) once the box is wide enough; otherwise a round button.
    const fh = h - SHADOW;
    const extended = !!label && w >= fh * 2;
    const fw = extended ? w - SHADOW : Math.min(w - SHADOW, fh);
    const d = Math.min(fw, fh);
    const fx = extended ? 0 : (w - SHADOW - fw) / 2;
    const fy = extended ? 0 : (h - SHADOW - d) / 2;
    const bh = extended ? fh : d;
    const is = Math.max(10, Math.round(bh * 0.42));
    const shift = state === 'pressed' ? 1 : 0;
    const ix = extended ? Math.round(bh * 0.32) : (fw - is) / 2;
    return (
      <>
        {state !== 'pressed' && state !== 'disabled' && (
          <At x={fx + SHADOW} y={fy + SHADOW} w={fw} h={bh}>
            <ButtonFace w={fw} h={bh} radius={bh / 2} shape={extended ? 'rect' : 'circle'} filled state="disabled" style={style} seed={seed + 11} />
          </At>
        )}
        <At x={fx + shift} y={fy + shift} w={fw} h={bh}>
          <ButtonFace w={fw} h={bh} radius={bh / 2} shape={extended ? 'rect' : 'circle'} filled state={state} style={style} seed={seed} />
          <KitIconAt name={iconOf(p.icon)} x={ix} y={(bh - is) / 2} size={is} tone={state === 'disabled' ? 'muted' : 'ink'} />
          {extended && (
            <div style={{ position: 'absolute', left: ix + is + 8, right: bh * 0.4, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>
              <KitText weight={700} tone={state === 'disabled' ? 'muted' : 'ink'} style={{ flex: 1, minWidth: 0 }}>{label}</KitText>
            </div>
          )}
        </At>
      </>
    );
  },
  describe: (p) => `Floating action button '${String(p.label ?? '').trim() || iconOf(p.icon)}'${stateSuffix(p.state)}`,
};
