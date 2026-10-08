import type { KitItemDef } from '../types';
import { SketchEllipse } from '../../design/primitives';
import { Lines, ImagePlaceholder, TextRow } from './_helpers';

type ImageProps = { alt: string; shape: 'rectangle' | 'circle' };

export const image: KitItemDef<ImageProps> = {
  type: 'image',
  label: 'Image',
  category: 'wireframe',
  keywords: ['image', 'picture', 'photo', 'placeholder', 'banner', 'avatar', 'media'],
  defaultSize: { w: 327, h: 180 },
  minSize: { w: 16, h: 16 },
  resize: 'both',
  defaultProps: { alt: 'Image', shape: 'rectangle' },
  textProp: 'alt',
  editableProps: [
    { key: 'alt', label: 'Description', kind: 'text' },
    { key: 'shape', label: 'Shape', kind: 'select', options: ['rectangle', 'circle'] },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const showCaption = !!p.alt && w >= 64 && h >= 48;
    const caption = showCaption && (
      <TextRow x={8} y={h - 26} w={w - 16} h={20} size="sm" tone="muted" align="center">{p.alt}</TextRow>
    );
    if (p.shape === 'circle') {
      // Inscribed X stays within the ellipse (cos 45° ≈ 0.707).
      const dx = (w / 2) * 0.707;
      const dy = (h / 2) * 0.707;
      return (
        <>
          <SketchEllipse w={w} h={h} style={style} seed={seed} stroke="muted" />
          <Lines w={w} h={h} lines={[[[w / 2 - dx, h / 2 - dy], [w / 2 + dx, h / 2 + dy]], [[w / 2 + dx, h / 2 - dy], [w / 2 - dx, h / 2 + dy]]]} style={style} seed={seed + 1} stroke="faint" strokeWidth={1.25} />
        </>
      );
    }
    return (
      <>
        <ImagePlaceholder w={w} h={h} style={style} seed={seed} />
        {caption}
      </>
    );
  },
  describe: (p) => `Image placeholder${p.alt ? ` '${p.alt}'` : ''}${p.shape === 'circle' ? ', circular' : ''}`,
};
