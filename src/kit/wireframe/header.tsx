import type { KitItemDef } from '../types';
import { SketchRect } from '../../design/primitives';
import { IconGlyph, TextRow } from './_helpers';

type HeaderProps = { title: string; leading: 'back' | 'menu' | 'none'; action: 'none' | 'search' | 'user' | 'more' };

const ICON = 24;
const PAD = 12;

export const header: KitItemDef<HeaderProps> = {
  type: 'header',
  label: 'Header',
  category: 'wireframe',
  keywords: ['header', 'app bar', 'top bar', 'title', 'navbar', 'toolbar'],
  defaultSize: { w: 375, h: 56 },
  minSize: { w: 120, h: 40 },
  resize: 'horizontal',
  defaultProps: { title: 'Page title', leading: 'back', action: 'none' },
  textProp: 'title',
  editableProps: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'leading', label: 'Left button', kind: 'select', options: ['back', 'menu', 'none'] },
    { key: 'action', label: 'Right button', kind: 'select', options: ['none', 'search', 'user', 'more'] },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const size = Math.min(ICON, h - 12);
    const iy = (h - size) / 2;
    const hasLead = p.leading === 'back' || p.leading === 'menu';
    const hasAction = p.action === 'search' || p.action === 'user' || p.action === 'more';
    // Both sides reserve the same width so the title stays centred.
    const side = hasLead || hasAction ? PAD + size + 8 : PAD;
    const showIcons = w >= side * 2 + 24;
    return (
      <>
        <SketchRect w={w} h={h} style={style} seed={seed} fill="surface" />
        {showIcons && hasLead && (
          <IconGlyph glyph={p.leading === 'back' ? 'chevron-left' : 'menu'} x={PAD} y={iy} size={size} style={style} seed={seed + 3} />
        )}
        {showIcons && hasAction && (
          <IconGlyph glyph={p.action as 'search' | 'user' | 'more'} x={w - PAD - size} y={iy} size={size} style={style} seed={seed + 5} />
        )}
        <TextRow x={showIcons ? side : PAD} w={w - (showIcons ? side : PAD) * 2} h={h} align="center" weight={700}>{p.title}</TextRow>
      </>
    );
  },
  describe: (p) => {
    const extras = [p.leading !== 'none' && `${p.leading} button`, p.action !== 'none' && `${p.action} button`].filter(Boolean);
    return `Header '${p.title}'${extras.length ? ` with ${extras.join(' and ')}` : ''}`;
  },
};
