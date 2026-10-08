import type { KitItemDef } from '../types';
import { TextRow } from './_helpers';

type HeadingProps = { text: string; level: 'H1' | 'H2' | 'H3'; align: 'left' | 'center' | 'right' };

const SIZE = { H1: 'xl', H2: 'lg', H3: 'md' } as const;

export const heading: KitItemDef<HeadingProps> = {
  type: 'heading',
  label: 'Heading',
  category: 'wireframe',
  keywords: ['heading', 'title', 'headline', 'h1', 'h2', 'h3'],
  defaultSize: { w: 327, h: 36 },
  minSize: { w: 24, h: 20 },
  resize: 'both',
  defaultProps: { text: 'Welcome back', level: 'H1', align: 'left' },
  textProp: 'text',
  editableProps: [
    { key: 'text', label: 'Text', kind: 'text' },
    { key: 'level', label: 'Level', kind: 'select', options: ['H1', 'H2', 'H3'] },
    { key: 'align', label: 'Alignment', kind: 'select', options: ['left', 'center', 'right'] },
  ],
  linkable: false,
  render: (p, { w, h }) => (
    <TextRow w={w} h={h} size={SIZE[p.level] ?? 'xl'} weight={700} align={p.align}>{p.text}</TextRow>
  ),
  describe: (p) => `Heading ${p.level} '${p.text}'`,
};
