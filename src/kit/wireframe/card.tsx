import type { KitItemDef } from '../types';
import { Box, SketchRect } from '../../design/primitives';
import { ImagePlaceholder, MultilineText, TextRow, toBool } from './_helpers';

type CardProps = { title: string; body: string; hasImage: boolean };

const PAD = 12;
const TITLE_H = 24;

export const card: KitItemDef<CardProps> = {
  type: 'card',
  label: 'Card',
  category: 'wireframe',
  keywords: ['card', 'tile', 'panel', 'container', 'product', 'article'],
  defaultSize: { w: 327, h: 240 },
  minSize: { w: 80, h: 48 },
  resize: 'both',
  defaultProps: { title: 'Card title', body: 'A short description that explains what this card is about.', hasImage: true },
  textProp: 'title',
  editableProps: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'body', label: 'Body', kind: 'multiline' },
    { key: 'hasImage', label: 'Show image', kind: 'boolean' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const withImage = toBool(p.hasImage) && h >= 140;
    const imgH = withImage ? Math.round(h * 0.5) : 0;
    const ty = withImage ? imgH + 8 : PAD;
    const by = ty + TITLE_H + 2;
    const bodyH = h - by - PAD;
    return (
      <>
        <SketchRect w={w} h={h} radius={8} style={style} seed={seed} fill="surface" />
        {withImage && <ImagePlaceholder x={6} y={6} w={w - 12} h={imgH - 6} style={style} seed={seed + 2} />}
        <TextRow x={PAD} y={ty} w={w - PAD * 2} h={Math.min(TITLE_H, h - ty - 4)} weight={700}>{p.title}</TextRow>
        {bodyH >= 14 && p.body && (
          <Box x={PAD} y={by} w={w - PAD * 2} h={bodyH} style={{ overflow: 'hidden' }}>
            <MultilineText h={bodyH} size="sm" tone="muted">{p.body}</MultilineText>
          </Box>
        )}
      </>
    );
  },
  describe: (p) => `Card '${p.title}'${toBool(p.hasImage) ? ' with image' : ''}`,
};
