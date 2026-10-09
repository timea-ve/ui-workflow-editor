import type { KitItemDef } from '../types';
import { KIT_ICONS } from '../icons';
import { BUTTON_STATES, ButtonFace, KitIconAt, stateSuffix, toButtonState, type ButtonState } from './_helpers';

type IconButtonProps = { icon: string; shape: 'circle' | 'square'; variant: 'primary' | 'secondary'; state: ButtonState; name: string };

const iconOf = (v: unknown) => (typeof v === 'string' && v in KIT_ICONS ? v : 'circle');

export const iconButton: KitItemDef<IconButtonProps> = {
  type: 'icon-button',
  label: 'Icon button',
  category: 'wireframe',
  group: 'actions',
  keywords: ['icon button', 'icon', 'button', 'action', 'toolbar', 'close', 'menu', 'more', 'share', 'like'],
  defaultSize: { w: 40, h: 40 },
  minSize: { w: 24, h: 24 },
  resize: 'both',
  defaultProps: { icon: 'heart', shape: 'circle', variant: 'secondary', state: 'default', name: '' },
  editableProps: [
    { key: 'icon', label: 'Icon', kind: 'icon', bar: 'inline' },
    { key: 'state', label: 'State', kind: 'select', options: [...BUTTON_STATES], bar: 'inline' },
    { key: 'shape', label: 'Shape', kind: 'select', options: ['circle', 'square'], bar: 'more' },
    { key: 'variant', label: 'Style', kind: 'select', options: ['primary', 'secondary'], bar: 'more' },
    { key: 'name', label: 'Accessible name', kind: 'text', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const state = toButtonState(p.state);
    const circle = p.shape !== 'square';
    // A circle stays round when the box is stretched; a square button fills the box.
    const s = Math.min(w, h);
    const fw = circle ? s : w;
    const fh = circle ? s : h;
    const x = (w - fw) / 2;
    const y = (h - fh) / 2;
    const is = Math.max(8, Math.round(s * 0.5));
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: fw, height: fh }}>
        <ButtonFace w={fw} h={fh} radius={Math.min(8, s / 4)} shape={circle ? 'circle' : 'rect'} filled={p.variant === 'primary'} state={state} style={style} seed={seed} />
        <KitIconAt name={iconOf(p.icon)} x={(fw - is) / 2} y={(fh - is) / 2 + (state === 'pressed' ? 1 : 0)} size={is} tone={state === 'disabled' ? 'muted' : 'ink'} />
      </div>
    );
  },
  describe: (p) => `Icon button '${p.name || iconOf(p.icon)}'${stateSuffix(p.state)}`,
};
