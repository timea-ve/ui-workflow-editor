import type { KitItemDef } from '../types';
import { Box } from '../../design/primitives';
import { MultilineText } from './_helpers';

type TextProps = { text: string; size: 'sm' | 'md'; align: 'left' | 'center' | 'right'; tone: 'ink' | 'muted' };

export const text: KitItemDef<TextProps> = {
  type: 'text',
  label: 'Paragraph',
  category: 'wireframe',
  keywords: ['text', 'paragraph', 'body', 'copy', 'description', 'label', 'link'],
  defaultSize: { w: 327, h: 60 },
  minSize: { w: 24, h: 16 },
  resize: 'both',
  defaultProps: {
    text: 'Short supporting copy that explains this screen in a sentence or two.',
    size: 'md',
    align: 'left',
    tone: 'ink',
  },
  textProp: 'text',
  editableProps: [
    { key: 'text', label: 'Text', kind: 'multiline' },
    { key: 'size', label: 'Size', kind: 'select', options: ['sm', 'md'] },
    { key: 'align', label: 'Alignment', kind: 'select', options: ['left', 'center', 'right'] },
    { key: 'tone', label: 'Tone', kind: 'select', options: ['ink', 'muted'] },
  ],
  linkable: true,
  render: (p, { w, h }) => (
    <Box w={w} h={h} style={{ overflow: 'hidden' }}>
      <MultilineText h={h} size={p.size === 'sm' ? 'sm' : 'md'} tone={p.tone === 'muted' ? 'muted' : 'ink'} align={p.align}>{p.text}</MultilineText>
    </Box>
  ),
  describe: (p) => `Text '${String(p.text ?? '').slice(0, 80)}${String(p.text ?? '').length > 80 ? '…' : ''}'`,
};
