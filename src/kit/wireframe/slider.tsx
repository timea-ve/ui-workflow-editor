import type { KitItemDef } from '../types';
import { SketchEllipse } from '../../design/primitives';
import { At, Lines, TextRow, toInt } from './_helpers';

type SliderProps = { label: string; value: number; minLabel: string; maxLabel: string };

const LABEL_H = 20;
const RANGE_H = 16;
const TRACK_H = 24;

export const slider: KitItemDef<SliderProps> = {
  type: 'slider',
  label: 'Slider',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['slider', 'range', 'volume', 'price range', 'scrubber', 'seek', 'level', 'form'],
  defaultSize: { w: 327, h: 64 },
  minSize: { w: 48, h: 24 },
  resize: 'both',
  defaultProps: { label: 'Volume', value: 60, minLabel: '0', maxLabel: '100' },
  textProp: 'label',
  editableProps: [
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'value', label: 'Value (0–100)', kind: 'number', bar: 'inline' },
    { key: 'minLabel', label: 'Min text', kind: 'text', bar: 'more' },
    { key: 'maxLabel', label: 'Max text', kind: 'text', bar: 'more' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const value = toInt(p.value, 50, 0, 100);
    const label = String(p.label ?? '').trim();
    const minL = String(p.minLabel ?? '').trim();
    const maxL = String(p.maxLabel ?? '').trim();
    const withLabel = !!label && h >= LABEL_H + TRACK_H;
    const withRange = (!!minL || !!maxL) && h >= (withLabel ? LABEL_H : 0) + TRACK_H + RANGE_H;
    const ty = withLabel ? LABEL_H : 0;
    const th = Math.min(TRACK_H, h - ty - (withRange ? RANGE_H : 0));
    const k = Math.max(10, Math.min(18, th - 4));
    const x0 = k / 2;
    const x1 = Math.max(x0, w - k / 2);
    const kx = x0 + ((x1 - x0) * value) / 100;
    const cy = ty + th / 2;
    return (
      <>
        {withLabel && (
          <>
            <TextRow w={w - 48} h={LABEL_H} size="sm" tone="muted" weight={600}>{label}</TextRow>
            <TextRow x={w - 48} w={48} h={LABEL_H} size="sm" tone="muted" align="right">{value}</TextRow>
          </>
        )}
        <Lines w={w} h={h} lines={[[[x0, cy], [x1, cy]]]} style={style} seed={seed} stroke="faint" strokeWidth={4} />
        {kx > x0 + 1 && <Lines w={w} h={h} lines={[[[x0, cy], [kx, cy]]]} style={style} seed={seed + 2} stroke="ink" strokeWidth={4} />}
        <At x={kx - k / 2} y={cy - k / 2} w={k} h={k}>
          <SketchEllipse w={k} h={k} style={style} seed={seed + 4} fill="surface" strokeWidth={2} />
        </At>
        {withRange && (
          <>
            <TextRow y={h - RANGE_H} w={w / 2} h={RANGE_H} size="sm" tone="muted">{minL}</TextRow>
            <TextRow x={w / 2} y={h - RANGE_H} w={w / 2} h={RANGE_H} size="sm" tone="muted" align="right">{maxL}</TextRow>
          </>
        )}
      </>
    );
  },
  describe: (p) => `Slider${p.label ? ` '${p.label}'` : ''} at ${toInt(p.value, 50, 0, 100)}%`,
};
