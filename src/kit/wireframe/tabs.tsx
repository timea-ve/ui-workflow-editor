import type { KitItemDef } from '../types';
import { SketchLines } from '../../design/primitives';
import { TextRow, splitList, toInt } from './_helpers';

type TabsProps = { tabs: string; active: number };

const MIN_TAB_W = 56;

export const tabs: KitItemDef<TabsProps> = {
  type: 'tabs',
  label: 'Tabs',
  category: 'wireframe',
  group: 'navigation',
  keywords: ['tabs', 'tab', 'segmented', 'tab bar', 'sections', 'switcher', 'navigation'],
  defaultSize: { w: 327, h: 44 },
  minSize: { w: 64, h: 32 },
  resize: 'horizontal',
  defaultProps: { tabs: 'Overview, Details, Reviews', active: 0 },
  textProp: 'tabs',
  editableProps: [
    { key: 'tabs', label: 'Tabs', kind: 'items', bar: 'inline' },
    { key: 'active', label: 'Active tab', kind: 'number', itemsFrom: 'tabs', bar: 'inline' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const all = splitList(p.tabs);
    const items = (all.length ? all : ['Tab']).slice(0, Math.max(1, Math.floor(w / MIN_TAB_W)));
    const active = toInt(p.active, 0, 0, Math.max(0, all.length - 1));
    const tw = w / items.length;
    const base = h - 2;
    return (
      <>
        <SketchLines w={w} h={h} lines={[[[0, base], [w, base]]]} style={style} seed={seed} stroke="faint" />
        {active < items.length && (
          <SketchLines w={w} h={h} lines={[[[active * tw + 6, base - 1], [(active + 1) * tw - 6, base - 1]]]} style={style} seed={seed + 1} strokeWidth={3} />
        )}
        {items.map((t, i) => (
          <TextRow key={i} x={i * tw + 6} w={tw - 12} h={h - 4} align="center" tone={i === active ? 'ink' : 'muted'} weight={i === active ? 700 : 400}>{t}</TextRow>
        ))}
      </>
    );
  },
  describe: (p) => {
    const all = splitList(p.tabs);
    const a = all[toInt(p.active, 0, 0, Math.max(0, all.length - 1))];
    return `Tabs: ${all.join(', ') || 'none'}${a ? `; '${a}' selected` : ''}`;
  },
};
