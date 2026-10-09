import type { KitItemDef } from '../types';
import { SketchEllipse } from '../../design/primitives';
import { At, IconAt, TextRow, toBool } from './_helpers';

type AvatarProps = { name: string; subtitle: string; initials: string; size: 'small' | 'medium' | 'large'; showName: boolean; status: boolean };

const DIAMETER = { small: 32, medium: 44, large: 64 } as const;

export const avatar: KitItemDef<AvatarProps> = {
  type: 'avatar',
  label: 'Avatar',
  category: 'wireframe',
  group: 'content',
  keywords: ['avatar', 'profile', 'user', 'person', 'photo', 'initials', 'account', 'member'],
  defaultSize: { w: 220, h: 48 },
  minSize: { w: 24, h: 24 },
  resize: 'both',
  defaultProps: { name: 'Alex Kim', subtitle: 'Product designer', initials: '', size: 'medium', showName: true, status: false },
  textProp: 'name',
  editableProps: [
    { key: 'name', label: 'Name', kind: 'text', bar: 'inline' },
    { key: 'size', label: 'Size', kind: 'select', options: ['small', 'medium', 'large'], bar: 'inline' },
    { key: 'showName', label: 'Show name', kind: 'boolean', bar: 'inline' },
    { key: 'subtitle', label: 'Subtitle', kind: 'text', bar: 'more' },
    { key: 'initials', label: 'Initials (empty = silhouette)', kind: 'text', bar: 'more' },
    { key: 'status', label: 'Status dot', kind: 'boolean', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const d = Math.max(12, Math.min(DIAMETER[p.size] ?? 44, h, w));
    const y = (h - d) / 2;
    const initials = String(p.initials ?? '').trim().slice(0, 2).toUpperCase();
    const textX = d + 12;
    const showName = toBool(p.showName) && !!p.name && w - textX >= 40;
    const two = showName && !!p.subtitle && h >= 36 && d >= 32;
    const dot = Math.max(8, Math.round(d * 0.26));
    return (
      <>
        <At x={0} y={y} w={d} h={d}>
          <SketchEllipse w={d} h={d} style={style} seed={seed} stroke="muted" fill="faint" />
          {initials ? (
            <TextRow x={0} w={d} h={d} size={d >= 56 ? 'lg' : d >= 32 ? 'md' : 'sm'} align="center" weight={700}>{initials}</TextRow>
          ) : (
            <IconAt name="user" x={d * 0.22} y={d * 0.2} size={d * 0.56} tone="muted" />
          )}
          {toBool(p.status) && (
            <At x={d - dot} y={d - dot} w={dot} h={dot}>
              <SketchEllipse w={dot} h={dot} style={style} seed={seed + 2} stroke="surface" fill="ink" strokeWidth={2} />
            </At>
          )}
        </At>
        {showName && (two ? (
          <>
            <TextRow x={textX} y={h / 2 - 19} w={w - textX} h={20} weight={700}>{p.name}</TextRow>
            <TextRow x={textX} y={h / 2 + 1} w={w - textX} h={18} size="sm" tone="muted">{p.subtitle}</TextRow>
          </>
        ) : (
          <TextRow x={textX} w={w - textX} h={h} weight={700}>{p.name}</TextRow>
        ))}
      </>
    );
  },
  describe: (p) => `Avatar${p.name ? ` for '${p.name}'` : ''}${p.subtitle && toBool(p.showName) ? `, ${p.subtitle}` : ''}${toBool(p.status) ? ', online' : ''}`,
};
