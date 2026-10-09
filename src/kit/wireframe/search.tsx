import type { KitItemDef } from '../types';
import { At, KitIconAt, RoundedRect, TextRow } from './_helpers';

type SearchProps = { placeholder: string; value: string };

export const search: KitItemDef<SearchProps> = {
  type: 'search',
  label: 'Search field',
  category: 'wireframe',
  group: 'inputs',
  keywords: ['search', 'search field', 'search bar', 'find', 'query', 'filter', 'lookup'],
  defaultSize: { w: 327, h: 40 },
  minSize: { w: 40, h: 28 },
  resize: 'horizontal',
  defaultProps: { placeholder: 'Search', value: '' },
  textProp: 'placeholder',
  editableProps: [
    { key: 'placeholder', label: 'Placeholder', kind: 'text', bar: 'inline' },
    { key: 'value', label: 'Typed query', kind: 'text', bar: 'more' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const value = String(p.value ?? '').trim();
    const icon = Math.max(10, Math.min(18, h - 16));
    const ix = Math.min(12, (w - icon) / 2);
    const tx = ix + icon + 8;
    const clear = !!value && w >= 120;
    const cs = Math.max(10, icon - 4);
    return (
      <>
        <RoundedRect w={w} h={h} radius={h / 2} style={style} seed={seed} fill="surface" />
        <KitIconAt name="search" x={ix} y={(h - icon) / 2} size={icon} tone="muted" />
        {w >= 72 && <TextRow x={tx} w={w - tx - (clear ? cs + 20 : 12)} h={h} tone={value ? 'ink' : 'muted'}>{value || p.placeholder}</TextRow>}
        {clear && (
          <At x={w - 12 - cs} y={(h - cs) / 2} w={cs} h={cs}>
            <KitIconAt name="close" size={cs} tone="muted" />
          </At>
        )}
      </>
    );
  },
  describe: (p) => `Search field${p.value ? `, query '${p.value}'` : p.placeholder ? `, placeholder '${p.placeholder}'` : ''}`,
};
