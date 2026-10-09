import type { KitItemDef } from '../types';
import { SketchRect } from '../../design/primitives';
import { At, IconGlyph, TextRow, splitList, toBool } from './_helpers';

type DropdownProps = { label: string; value: string; options: string; open: boolean };

const LABEL_H = 20;
const FIELD_H = 40;
const OPTION_H = 32;

export const dropdown: KitItemDef<DropdownProps> = {
  type: 'dropdown',
  label: 'Dropdown',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['dropdown', 'select', 'picker', 'menu', 'combobox', 'options', 'choice'],
  defaultSize: { w: 327, h: 64 },
  minSize: { w: 64, h: 32 },
  resize: 'both',
  defaultProps: { label: 'Country', value: 'Select a country', options: 'Austria, Germany, Switzerland', open: false },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text', bar: 'inline' },
    { key: 'value', label: 'Selected value', kind: 'text' },
    { key: 'options', label: 'Options', kind: 'items', bar: 'inline' },
    { key: 'open', label: 'Open', kind: 'boolean', bar: 'inline' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const withLabel = !!p.label && h >= LABEL_H + 4 + 32;
    const fy = withLabel ? LABEL_H + 4 : 0;
    const fh = Math.min(FIELD_H, h - fy);
    const open = toBool(p.open);
    const listY = fy + fh + 4;
    const options = open ? splitList(p.options).slice(0, Math.max(0, Math.floor((h - listY - 8) / OPTION_H))) : [];
    const listH = options.length * OPTION_H + 8;
    const icon = Math.min(20, fh - 8);
    return (
      <>
        {withLabel && <TextRow w={w} h={LABEL_H} size="sm" tone="muted" weight={600}>{p.label}</TextRow>}
        <At x={0} y={fy} w={w} h={fh}>
          <SketchRect w={w} h={fh} radius={6} style={style} seed={seed} fill="surface" />
          <TextRow x={12} w={w - 24 - icon - 4} h={fh}>{p.value}</TextRow>
          {w >= icon + 40 && (
            <div style={{ position: 'absolute', left: w - 10 - icon, top: (fh - icon) / 2, width: icon, height: icon, transform: open ? 'rotate(-90deg)' : 'rotate(90deg)' }}>
              <IconGlyph glyph="chevron-right" size={icon} style={style} seed={seed + 3} />
            </div>
          )}
        </At>
        {options.length > 0 && (
          <At x={0} y={listY} w={w} h={listH}>
            <SketchRect w={w} h={listH} radius={6} style={style} seed={seed + 5} fill="surface" />
            {options.map((o, i) => (
              <TextRow key={i} x={12} y={4 + i * OPTION_H} w={w - 24} h={OPTION_H} weight={o === p.value ? 700 : 400}>{o}</TextRow>
            ))}
          </At>
        )}
      </>
    );
  },
  describe: (p) => `Dropdown '${p.label}', value '${p.value}'${toBool(p.open) ? `, open with options ${splitList(p.options).join(', ')}` : ''}`,
};
