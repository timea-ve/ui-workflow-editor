import type { KitItemDef } from '../types';
import { SketchEllipse, SketchRect } from '../../design/primitives';
import { At, IconAt, TextRow, toBool } from './_helpers';

type BadgeProps = { label: string; variant: 'solid' | 'soft' | 'outline'; dot: boolean; removable: boolean };

export const badge: KitItemDef<BadgeProps> = {
  type: 'badge',
  label: 'Badge / tag',
  category: 'wireframe',
  group: 'feedback',
  keywords: ['badge', 'tag', 'chip', 'pill', 'label', 'status', 'filter', 'count'],
  defaultSize: { w: 72, h: 24 },
  minSize: { w: 24, h: 16 },
  resize: 'both',
  defaultProps: { label: 'New', variant: 'soft', dot: false, removable: false },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Text', kind: 'text', bar: 'more' },
    { key: 'variant', label: 'Style', kind: 'select', options: ['solid', 'soft', 'outline'], bar: 'inline' },
    { key: 'dot', label: 'Dot', kind: 'boolean', bar: 'more' },
    { key: 'removable', label: 'Remove "x"', kind: 'boolean', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const solid = p.variant === 'solid';
    const fill = solid ? 'ink' : p.variant === 'outline' ? 'surface' : 'faint';
    const tone = solid ? 'surface' : 'ink';
    const dot = toBool(p.dot) && w >= 40 ? 6 : 0;
    const x = toBool(p.removable) && w >= 48 ? 12 : 0;
    const padL = 10 + (dot ? dot + 6 : 0);
    const padR = 10 + (x ? x + 4 : 0);
    const size = h >= 28 ? 'md' : 'sm';
    return (
      <>
        <SketchRect w={w} h={h} radius={h / 2} style={style} seed={seed} fill={fill} stroke={p.variant === 'soft' ? 'none' : 'ink'} strokeWidth={1.25} />
        {dot > 0 && (
          <At x={10} y={(h - dot) / 2} w={dot} h={dot}>
            <SketchEllipse w={dot} h={dot} style={style} seed={seed + 1} stroke="none" fill={tone} />
          </At>
        )}
        <TextRow x={w < 40 ? 4 : padL} w={w - (w < 40 ? 8 : padL + padR)} h={h} size={size} tone={tone} align="center" weight={600}>{p.label}</TextRow>
        {x > 0 && <IconAt name="close" x={w - 10 - x} y={(h - x) / 2} size={x} tone={tone} strokeWidth={2.25} />}
      </>
    );
  },
  describe: (p) => `${toBool(p.removable) ? 'Removable tag' : 'Badge'} '${p.label}'`,
};
