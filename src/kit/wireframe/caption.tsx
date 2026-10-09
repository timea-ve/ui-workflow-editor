import type { KitItemDef } from '../types';
import { Box, KitText } from '../../design/primitives';

type CaptionProps = { text: string; size: 'sm' | 'xs'; align: 'left' | 'center' | 'right' };

export const caption: KitItemDef<CaptionProps> = {
  type: 'caption',
  label: 'Label / caption',
  category: 'wireframe',
  group: 'text',
  keywords: ['label', 'caption', 'helper', 'hint', 'small text', 'footnote', 'meta', 'overline'],
  defaultSize: { w: 200, h: 16 },
  minSize: { w: 24, h: 12 },
  resize: 'horizontal',
  defaultProps: { text: 'Helper text', size: 'sm', align: 'left' },
  textProp: 'text',
  editableProps: [
    { key: 'text', label: 'Text', kind: 'text' },
    { key: 'size', label: 'Size', kind: 'select', options: ['sm', 'xs'], bar: 'inline' },
    { key: 'align', label: 'Alignment', kind: 'select', options: ['left', 'center', 'right'], bar: 'inline' },
  ],
  linkable: false,
  render: (p, { w, h }) => (
    <Box w={w} h={h} style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
      <KitText size="sm" tone="muted" align={p.align} style={{ flex: 1, minWidth: 0, ...(p.size === 'xs' ? { fontSize: 'calc(var(--fs-kit-text-sm) - 1px)', letterSpacing: '0.01em' } : null) }}>
        {p.text}
      </KitText>
    </Box>
  ),
  describe: (p) => `Caption '${p.text}'`,
};
