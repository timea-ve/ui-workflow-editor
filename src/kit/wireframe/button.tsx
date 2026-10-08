import type { KitItemDef } from '../types';
import { SketchRect, KitText } from '../../design/primitives';

// Reference implementation — the Wireframe Kit agent follows this pattern
// for all other components (one file per component, registered in index.ts).

type ButtonProps = { label: string; variant: 'primary' | 'secondary' };

export const button: KitItemDef<ButtonProps> = {
  type: 'button',
  label: 'Button',
  category: 'wireframe',
  keywords: ['button', 'cta', 'action', 'submit'],
  defaultSize: { w: 140, h: 40 },
  minSize: { w: 48, h: 28 },
  resize: 'both',
  defaultProps: { label: 'Button', variant: 'primary' },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'variant', label: 'Style', kind: 'select', options: ['primary', 'secondary'] },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => (
    <>
      <SketchRect w={w} h={h} radius={6} style={style} seed={seed} fill={p.variant === 'primary' ? 'faint' : 'none'} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '0 8px' }}>
        <KitText align="center" weight={p.variant === 'primary' ? 700 : 400}>{p.label}</KitText>
      </div>
    </>
  ),
  describe: (p) => `Button '${p.label}'`,
};
