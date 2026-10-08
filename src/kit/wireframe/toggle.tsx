import type { KitItemDef } from '../types';
import { SketchEllipse } from '../../design/primitives';
import { At, RoundedRect, TextRow, toBool } from './_helpers';

type ToggleProps = { label: string; on: boolean };

export const toggle: KitItemDef<ToggleProps> = {
  type: 'toggle',
  label: 'Toggle',
  category: 'wireframe',
  keywords: ['toggle', 'switch', 'on off', 'setting', 'preference'],
  defaultSize: { w: 327, h: 32 },
  minSize: { w: 44, h: 24 },
  resize: 'horizontal',
  defaultProps: { label: 'Notifications', on: true },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'on', label: 'On', kind: 'boolean' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const th = Math.min(24, h);
    const tw = Math.min(w, th * 1.75);
    const tx = w - tw;
    const ty = (h - th) / 2;
    const k = th - 6;
    const on = toBool(p.on);
    return (
      <>
        <TextRow w={tx - 12} h={h}>{p.label}</TextRow>
        <At x={tx} y={ty} w={tw} h={th}>
          <RoundedRect w={tw} h={th} radius={th / 2} style={style} seed={seed} fill={on ? 'faint' : 'surface'} />
          <At x={on ? tw - k - 3 : 3} y={3} w={k} h={k}>
            <SketchEllipse w={k} h={k} style={style} seed={seed + 2} fill={on ? 'ink' : 'surface'} />
          </At>
        </At>
      </>
    );
  },
  describe: (p) => `Toggle '${p.label}', ${toBool(p.on) ? 'on' : 'off'}`,
};
