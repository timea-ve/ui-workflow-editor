import type { KitItemDef } from '../types';
import { Box } from '../../design/primitives';
import { MultilineText, PlaceholderBars } from './_helpers';

type TextProps = { text: string; mode: 'text' | 'blocks'; size: 'sm' | 'md'; align: 'left' | 'center' | 'right'; tone: 'ink' | 'muted' };

export const text: KitItemDef<TextProps> = {
  type: 'text',
  label: 'Paragraph',
  category: 'wireframe',
  group: 'text',
  keywords: ['text', 'paragraph', 'body', 'copy', 'description', 'lorem', 'ipsum', 'placeholder', 'blocks', 'greeked'],
  defaultSize: { w: 327, h: 60 },
  minSize: { w: 24, h: 16 },
  resize: 'both',
  defaultProps: {
    text: 'Short supporting copy that explains this screen in a sentence or two.',
    mode: 'text',
    size: 'md',
    align: 'left',
    tone: 'ink',
  },
  textProp: 'text',
  editableProps: [
    { key: 'text', label: 'Text', kind: 'multiline' },
    { key: 'mode', label: 'Show as', kind: 'select', options: ['text', 'blocks'], bar: 'inline' },
    { key: 'size', label: 'Size', kind: 'select', options: ['sm', 'md'], bar: 'inline' },
    { key: 'align', label: 'Alignment', kind: 'select', options: ['left', 'center', 'right'], bar: 'more' },
    { key: 'tone', label: 'Tone', kind: 'select', options: ['ink', 'muted'], bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const size = p.size === 'sm' ? 'sm' : 'md';
    return (
      <Box w={w} h={h} style={{ overflow: 'hidden' }}>
        {p.mode === 'blocks'
          ? <PlaceholderBars w={w} h={h} size={size} align={p.align} style={style} seed={seed} />
          : <MultilineText h={h} size={size} tone={p.tone === 'muted' ? 'muted' : 'ink'} align={p.align}>{p.text}</MultilineText>}
      </Box>
    );
  },
  describe: (p) => {
    if (p.mode === 'blocks') return 'Paragraph placeholder (grey text blocks)';
    const t = String(p.text ?? '');
    return `Text '${t.slice(0, 80)}${t.length > 80 ? '…' : ''}'`;
  },
};
