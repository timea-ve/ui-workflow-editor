import type { KitItemDef } from '../types';
import { Box, KitText } from '../../design/primitives';

type LinkProps = { text: string; size: 'sm' | 'md'; align: 'left' | 'center' | 'right' };

// Ink, not accent: the accent colour is reserved for app chrome and selection.
export const link: KitItemDef<LinkProps> = {
  type: 'link',
  label: 'Link',
  category: 'wireframe',
  group: 'text',
  keywords: ['link', 'hyperlink', 'href', 'url', 'anchor', 'text link', 'forgot password'],
  defaultSize: { w: 160, h: 20 },
  minSize: { w: 24, h: 14 },
  resize: 'horizontal',
  defaultProps: { text: 'Forgot password?', size: 'md', align: 'left' },
  textProp: 'text',
  editableProps: [
    { key: 'text', label: 'Text', kind: 'text' },
    { key: 'size', label: 'Size', kind: 'select', options: ['sm', 'md'], bar: 'inline' },
    { key: 'align', label: 'Alignment', kind: 'select', options: ['left', 'center', 'right'], bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h }) => (
    <Box w={w} h={h} style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <KitText size={p.size === 'sm' ? 'sm' : 'md'} align={p.align} weight={500}
        style={{ flex: 1, minWidth: 0, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationThickness: 1 }}>
        {p.text}
      </KitText>
    </Box>
  ),
  describe: (p) => `Link '${p.text}'`,
};
