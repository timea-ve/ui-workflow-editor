import type { KitItemDef } from '../types';
import { KitText } from '../../design/primitives';

type LabelProps = { text: string; size: 'sm' | 'md' | 'lg' | 'xl' };

export const label: KitItemDef<LabelProps> = {
  type: 'label',
  label: 'Text',
  category: 'diagram',
  keywords: ['text', 'label', 'caption', 'title', 'annotation', 'free text'],
  defaultSize: { w: 140, h: 32 },
  minSize: { w: 24, h: 18 },
  resize: 'both',
  defaultProps: { text: 'Text', size: 'md' },
  textProp: 'text',
  editableProps: [
    { key: 'text', label: 'Text', kind: 'multiline' },
    { key: 'size', label: 'Size', kind: 'select', options: ['sm', 'md', 'lg', 'xl'] },
  ],
  linkable: false,
  render: (p, { w, h }) => (
    <div style={{ position: 'absolute', inset: 0, width: w, height: h, overflow: 'hidden' }}>
      <KitText size={p.size} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.text}</KitText>
    </div>
  ),
  describe: (p) => `Text '${p.text}'`,
};
