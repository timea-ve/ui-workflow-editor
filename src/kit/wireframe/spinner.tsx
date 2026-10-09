import type { KitItemDef } from '../types';
import { SketchEllipse, SketchLines } from '../../design/primitives';
import { At, TextRow } from './_helpers';

type SpinnerProps = { label: string };

export const spinner: KitItemDef<SpinnerProps> = {
  type: 'spinner',
  label: 'Loading spinner',
  category: 'wireframe',
  group: 'feedback',
  keywords: ['spinner', 'loading', 'loader', 'busy', 'wait', 'activity indicator', 'progress'],
  defaultSize: { w: 120, h: 72 },
  minSize: { w: 16, h: 16 },
  resize: 'both',
  defaultProps: { label: 'Loading…' },
  textProp: 'label',
  editableProps: [{ key: 'label', label: 'Label (empty = hide)', kind: 'text', bar: 'inline' }],
  linkable: false,
  // Static on purpose: a calm, still arc reads as "loading" in a wireframe without motion.
  render: (p, { w, h, style, seed }) => {
    const beside = w >= h * 2.2;
    const withLabel = !!p.label && (beside ? w >= 96 : h >= 52);
    const d = Math.max(12, Math.min(32, withLabel && !beside ? h - 26 : h, w));
    const sw = Math.max(2, d / 10);
    const r = (d - sw) / 2;
    const arc: [number, number][] = Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (k / 9) * (Math.PI * 0.7);
      return [d / 2 + r * Math.cos(a), d / 2 + r * Math.sin(a)];
    });
    const cx = withLabel && beside ? 0 : (w - d) / 2;
    const cy = withLabel && !beside ? (h - d - 22) / 2 : (h - d) / 2;
    return (
      <>
        <At x={cx} y={cy} w={d} h={d}>
          <At x={sw / 2 - 0.75} y={sw / 2 - 0.75} w={d - sw + 1.5} h={d - sw + 1.5}>
            <SketchEllipse w={d - sw + 1.5} h={d - sw + 1.5} style={style} seed={seed} stroke="faint" strokeWidth={1.5} />
          </At>
          <SketchLines w={d} h={d} lines={[arc]} style={style} seed={seed + 1} stroke="ink" strokeWidth={sw} />
        </At>
        {withLabel && (beside
          ? <TextRow x={d + 10} w={w - d - 10} h={h} size="sm" tone="muted">{p.label}</TextRow>
          : <TextRow x={0} y={cy + d + 4} w={w} h={18} size="sm" tone="muted" align="center">{p.label}</TextRow>)}
      </>
    );
  },
  describe: (p) => `Loading spinner${p.label ? ` '${p.label}'` : ''}`,
};
