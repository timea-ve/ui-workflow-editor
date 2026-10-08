import type { KitItemDef } from '../types';
import { Box, KitText, SketchLines, SketchRect } from '../../design/primitives';

type StickyProps = { text: string };

const FOLD = 16;

export const sticky: KitItemDef<StickyProps> = {
  type: 'sticky',
  label: 'Sticky note',
  category: 'diagram',
  keywords: ['sticky', 'note', 'comment', 'post-it', 'memo'],
  defaultSize: { w: 180, h: 140 },
  minSize: { w: 80, h: 60 },
  resize: 'both',
  defaultProps: { text: 'Note' },
  textProp: 'text',
  editableProps: [{ key: 'text', label: 'Text', kind: 'multiline' }],
  linkable: false,
  render: (p, { w, h, style, seed }) => (
    <>
      {/* Subtle grayscale paper: the faint tone at low opacity, then the outline on top. */}
      <Box w={w} h={h} style={{ opacity: 0.35 }}>
        <SketchRect w={w} h={h} style={style} seed={seed} stroke="none" fill="faint" />
      </Box>
      <SketchRect w={w} h={h} style={style} seed={seed + 1} stroke="muted" />
      <SketchLines w={w} h={h} style={style} seed={seed + 2} stroke="muted"
        lines={[[[w - FOLD, h - 1], [w - FOLD, h - FOLD], [w - 1, h - FOLD]]]} />
      <Box x={10} y={10} w={w - 20} h={h - 20 - FOLD / 2} style={{ overflow: 'hidden' }}>
        <KitText style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.text}</KitText>
      </Box>
    </>
  ),
  describe: (p) => `Sticky note: ${p.text}`,
};
