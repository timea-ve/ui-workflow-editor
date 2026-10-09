import type { KitItemDef } from '../types';
import { SketchEllipse } from '../../design/primitives';
import { At, TextRow, splitList, toInt } from './_helpers';

type RadioProps = { items: string; selected: number };

const ROW = 28;

export const radio: KitItemDef<RadioProps> = {
  type: 'radio',
  label: 'Radio buttons',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['radio', 'radio button', 'option', 'choice', 'choose one', 'single select', 'form'],
  defaultSize: { w: 327, h: 84 },
  minSize: { w: 24, h: 24 },
  resize: 'both',
  defaultProps: { items: 'Standard delivery, Express delivery, Pick up in store', selected: 0 },
  editableProps: [
    { key: 'items', label: 'Options', kind: 'items', bar: 'inline' },
    { key: 'selected', label: 'Selected', kind: 'number', itemsFrom: 'items', bar: 'inline' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const items = splitList(p.items);
    const sel = toInt(p.selected, 0, -1, items.length - 1);
    const shown = items.slice(0, Math.max(1, Math.floor(h / ROW)));
    const rh = Math.min(ROW, h);
    const s = Math.min(18, rh - 4);
    const dot = Math.max(4, Math.round(s * 0.45));
    return (
      <>
        {shown.map((label, i) => (
          <At key={i} x={0} y={i * ROW} w={w} h={rh}>
            <At x={1} y={(rh - s) / 2} w={s} h={s}>
              <SketchEllipse w={s} h={s} style={style} seed={seed + i * 3} fill="surface" />
              {i === sel && (
                <At x={(s - dot) / 2} y={(s - dot) / 2} w={dot} h={dot}>
                  <SketchEllipse w={dot} h={dot} style={style} seed={seed + i * 3 + 1} fill="ink" strokeWidth={1} />
                </At>
              )}
            </At>
            <TextRow x={s + 10} w={w - s - 10} h={rh} weight={i === sel ? 600 : undefined}>{label}</TextRow>
          </At>
        ))}
      </>
    );
  },
  describe: (p) => {
    const items = splitList(p.items);
    const sel = toInt(p.selected, 0, -1, items.length - 1);
    return `Radio buttons: ${items.map((it, i) => (i === sel ? `${it} (selected)` : it)).join(', ') || 'no options'}`;
  },
};
