import type { KitItemDef } from '../types';
import { SketchEllipse, SketchLines, SketchPolygon, SketchRect } from '../../design/primitives';
import { At, TextRow, toBool, toInt } from './_helpers';

type VideoProps = { title: string; progress: number; time: string; controls: boolean };

const BAR_H = 32;

export const video: KitItemDef<VideoProps> = {
  type: 'video',
  label: 'Video',
  category: 'wireframe',
  group: 'content',
  keywords: ['video', 'player', 'media', 'movie', 'clip', 'play', 'stream', 'placeholder'],
  defaultSize: { w: 327, h: 184 },
  minSize: { w: 48, h: 36 },
  resize: 'both',
  defaultProps: { title: 'Product tour', progress: 30, time: '0:42 / 2:15', controls: true },
  textProp: 'title',
  editableProps: [
    { key: 'title', label: 'Title', kind: 'text', bar: 'more' },
    { key: 'progress', label: 'Progress %', kind: 'number', bar: 'inline' },
    { key: 'controls', label: 'Controls', kind: 'boolean', bar: 'inline' },
    { key: 'time', label: 'Time', kind: 'text', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const controls = toBool(p.controls) && h >= 96 && w >= 120;
    const areaH = controls ? h - BAR_H : h;
    const d = Math.max(16, Math.min(56, Math.min(w, areaH) * 0.4));
    const cx = w / 2;
    const cy = areaH / 2;
    const t = d * 0.22;
    const tri: [number, number][] = [[d * 0.4, d / 2 - t * 1.15], [d * 0.4, d / 2 + t * 1.15], [d * 0.4 + t * 2, d / 2]];
    const pct = toInt(p.progress, 30, 0, 100) / 100;
    const timeW = p.time && w >= 200 ? Math.min(96, p.time.length * 7 + 8) : 0;
    const trackX0 = 12;
    const trackX1 = w - 12 - (timeW ? timeW + 8 : 0);
    const ty = h - BAR_H / 2;
    const knobX = trackX0 + (trackX1 - trackX0) * pct;
    return (
      <>
        <SketchRect w={w} h={h} radius={6} style={style} seed={seed} stroke="muted" fill="faint" />
        <At x={cx - d / 2} y={cy - d / 2} w={d} h={d}>
          <SketchEllipse w={d} h={d} style={style} seed={seed + 2} fill="surface" strokeWidth={1.75} />
          <SketchPolygon w={d} h={d} points={tri} style={style} seed={seed + 3} fill="ink" />
        </At>
        {controls && (
          <>
            <SketchLines w={w} h={h} lines={[[[trackX0, ty], [trackX1, ty]]]} style={style} seed={seed + 4} stroke="surface" strokeWidth={4} />
            {pct > 0 && <SketchLines w={w} h={h} lines={[[[trackX0, ty], [knobX, ty]]]} style={style} seed={seed + 5} stroke="ink" strokeWidth={4} />}
            <At x={knobX - 6} y={ty - 6} w={12} h={12}>
              <SketchEllipse w={12} h={12} style={style} seed={seed + 6} fill="surface" />
            </At>
            {timeW > 0 && <TextRow x={w - 12 - timeW} y={h - BAR_H} w={timeW} h={BAR_H} size="sm" align="right">{p.time}</TextRow>}
          </>
        )}
      </>
    );
  },
  describe: (p) => `Video placeholder${p.title ? ` '${p.title}'` : ''}${toBool(p.controls) ? `, ${toInt(p.progress, 30, 0, 100)}% played${p.time ? ` (${p.time})` : ''}` : ''}`,
};
