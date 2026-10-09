import type { KitItemDef } from '../types';
import { SketchEllipse, SketchLines, SketchRect } from '../../design/primitives';
import { At, TextRow, toBool, toInt } from './_helpers';

type ProgressProps = { value: number; label: string; showValue: boolean; variant: 'bar' | 'steps'; steps: number };

const LABEL_H = 20;
const TRACK = 8;

export const progress: KitItemDef<ProgressProps> = {
  type: 'progress',
  label: 'Progress bar',
  category: 'wireframe',
  group: 'feedback',
  keywords: ['progress', 'progress bar', 'loading', 'upload', 'percent', 'steps', 'stepper', 'meter'],
  defaultSize: { w: 327, h: 40 },
  minSize: { w: 48, h: 12 },
  resize: 'both',
  defaultProps: { value: 60, label: 'Uploading…', showValue: true, variant: 'bar', steps: 4 },
  textProp: 'label',
  editableProps: [
    { key: 'value', label: 'Value %', kind: 'number', bar: 'inline' },
    { key: 'variant', label: 'Type', kind: 'select', options: ['bar', 'steps'], bar: 'inline' },
    { key: 'label', label: 'Label', kind: 'text', bar: 'more' },
    { key: 'showValue', label: 'Show %', kind: 'boolean', bar: 'more' },
    { key: 'steps', label: 'Steps', kind: 'number', bar: 'more' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const value = toInt(p.value, 60, 0, 100);
    const showHead = (!!p.label || toBool(p.showValue)) && h >= LABEL_H + TRACK + 4;
    const ty = showHead ? LABEL_H + 4 : 0;
    const steps = toInt(p.steps, 4, 2, 10);
    const head = showHead && (
      <>
        {p.label && <TextRow w={w - 48} h={LABEL_H} size="sm">{p.label}</TextRow>}
        {toBool(p.showValue) && (
          <TextRow x={w - 48} w={48} h={LABEL_H} size="sm" tone="muted" align="right">
            {p.variant === 'steps' ? `${Math.round((value / 100) * steps)}/${steps}` : `${value}%`}
          </TextRow>
        )}
      </>
    );
    if (p.variant === 'steps') {
      const done = Math.round((value / 100) * steps);
      const d = Math.min(16, h - ty);
      const gap = (w - d) / (steps - 1);
      const cy = ty + d / 2;
      return (
        <>
          {head}
          <SketchLines w={w} h={h} lines={[[[d / 2, cy], [w - d / 2, cy]]]} style={style} seed={seed} stroke="faint" strokeWidth={2} />
          {done > 1 && <SketchLines w={w} h={h} lines={[[[d / 2, cy], [d / 2 + gap * (done - 1), cy]]]} style={style} seed={seed + 1} stroke="ink" strokeWidth={2} />}
          {Array.from({ length: steps }, (_, i) => (
            <At key={i} x={i * gap} y={ty} w={d} h={d}>
              <SketchEllipse w={d} h={d} style={style} seed={seed + 10 + i} stroke={i < done ? 'ink' : 'muted'} fill={i < done ? 'ink' : 'surface'} />
            </At>
          ))}
        </>
      );
    }
    const th = Math.min(TRACK, h - ty);
    const fw = Math.max(th, (w * value) / 100);
    return (
      <>
        {head}
        <At x={0} y={ty} w={w} h={th}>
          <SketchRect w={w} h={th} radius={th / 2} style={style} seed={seed} stroke="none" fill="faint" />
          {value > 0 && (
            <At x={0} y={0} w={fw} h={th}>
              <SketchRect w={fw} h={th} radius={th / 2} style={style} seed={seed + 1} stroke="none" fill="ink" />
            </At>
          )}
        </At>
      </>
    );
  },
  describe: (p) => {
    const v = toInt(p.value, 60, 0, 100);
    if (p.variant === 'steps') {
      const s = toInt(p.steps, 4, 2, 10);
      return `Progress steps${p.label ? ` '${p.label}'` : ''}: ${Math.round((v / 100) * s)} of ${s} done`;
    }
    return `Progress bar${p.label ? ` '${p.label}'` : ''} at ${v}%`;
  },
};
