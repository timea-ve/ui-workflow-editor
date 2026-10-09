import type { KitItemDef } from '../types';
import { KitText } from '../../design/primitives';
import { IconAt, splitList } from './_helpers';

type BreadcrumbsProps = { items: string; separator: 'chevron' | 'slash' };

export const breadcrumbs: KitItemDef<BreadcrumbsProps> = {
  type: 'breadcrumbs',
  label: 'Breadcrumbs',
  category: 'wireframe',
  group: 'navigation',
  keywords: ['breadcrumbs', 'breadcrumb', 'path', 'trail', 'hierarchy', 'navigation', 'location'],
  defaultSize: { w: 327, h: 24 },
  minSize: { w: 48, h: 20 },
  resize: 'horizontal',
  defaultProps: { items: 'Home, Projects, Website redesign', separator: 'chevron' },
  textProp: 'items',
  editableProps: [
    { key: 'items', label: 'Path', kind: 'items', bar: 'inline' },
    { key: 'separator', label: 'Separator', kind: 'select', options: ['chevron', 'slash'], bar: 'inline' },
  ],
  linkable: true,
  render: (p, { w, h }) => {
    const all = splitList(p.items);
    // Rough fit: ~7px per character + separators. Collapse the middle to "…" when it won't fit.
    const est = (xs: string[]) => xs.reduce((s, x) => s + x.length * 7 + 22, 0);
    let shown: string[] = all;
    if (all.length > 2 && est(all) > w) shown = [all[0], '…', all[all.length - 1]];
    const sep = (k: number) => (p.separator === 'slash'
      ? <span key={`s${k}`} style={{ flex: 'none', padding: '0 6px' }}><KitText tone="muted">/</KitText></span>
      : <span key={`s${k}`} style={{ flex: 'none', position: 'relative', width: 20, height: 14 }}><IconAt name="chevron-right" x={3} y={0} size={14} tone="muted" /></span>);
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', overflow: 'hidden', width: w, height: h }}>
        {shown.flatMap((label, i) => {
          const last = i === shown.length - 1;
          const node = (
            <span key={i} style={{ minWidth: 0, flex: last ? '0 1 auto' : '0 3 auto' }}>
              <KitText tone={last ? 'ink' : 'muted'} weight={last ? 700 : 400}>{label}</KitText>
            </span>
          );
          return last ? [node] : [node, sep(i)];
        })}
      </div>
    );
  },
  describe: (p) => {
    const items = splitList(p.items);
    return `Breadcrumbs: ${items.join(' › ') || 'empty'}${items.length ? `; current page '${items[items.length - 1]}'` : ''}`;
  },
};
