import { describe, expect, it } from 'vitest';
import { filterInsertItems } from '../../../chrome/insertSearch';
import { KIT_ICON_NAMES } from '../../../kit/icons';
import { diagramKit, kitRegistry, wireframeKit } from '../../../kit/registry';
import { KIT_GROUP_LABELS, PALETTE_ITEMS, iconLabel, paletteItem } from './paletteItems';

const groups = () => [...new Set(PALETTE_ITEMS.map((i) => i.group))];

describe('insert palette items', () => {
  it('lists every component, shape, screen and icon once', () => {
    const count = (g: string) => PALETTE_ITEMS.filter((i) => i.group === g).length;
    expect(PALETTE_ITEMS.filter((i) => i.id.startsWith('kit:') && i.group !== 'Shapes')).toHaveLength(wireframeKit.length);
    expect(count('Shapes')).toBe(diagramKit.length + 1); // + the Arrow tool hint
    expect(count('Screens')).toBe(3);
    expect(count('Icons')).toBe(KIT_ICON_NAMES.length);
    expect(new Set(PALETTE_ITEMS.map((i) => i.id)).size).toBe(PALETTE_ITEMS.length);
  });

  it('groups components by kit group, then shapes, screens and icons — each section contiguous', () => {
    const g = groups();
    const known = Object.values(KIT_GROUP_LABELS);
    const componentGroups = g.slice(0, g.indexOf('Shapes'));
    // Kit sections keep the canonical order; an ungrouped fallback ("Components") comes last.
    const order = [...known, 'Components'];
    expect(componentGroups.map((x) => order.indexOf(x))).toEqual([...componentGroups.map((x) => order.indexOf(x))].sort((a, b) => a - b));
    expect(componentGroups.every((x) => order.includes(x))).toBe(true);
    expect(g.slice(-3)).toEqual(['Shapes', 'Screens', 'Icons']);
    // Contiguous: headings are shown on group change, so a group must never re-appear later.
    const runs = PALETTE_ITEMS.map((i) => i.group).filter((x, i, a) => x !== a[i - 1]);
    expect(runs).toEqual(g);
  });

  it('puts Button under "Buttons & actions" and Tabs under "Navigation"', () => {
    expect(paletteItem('kit:button')?.group).toBe('Buttons & actions');
    expect(paletteItem('kit:tabs')?.group).toBe('Navigation');
  });

  it('ranks the best match first', () => {
    expect(filterInsertItems(PALETTE_ITEMS, 'button')[0].label).toBe('Button');
    expect(filterInsertItems(PALETTE_ITEMS, 'sticky')[0].id).toBe('kit:sticky');
    // The Phone icon matches by name; the mobile screen (keyword) follows right after.
    expect(filterInsertItems(PALETTE_ITEMS, 'phone').slice(0, 2).map((i) => i.id)).toEqual(['icon:phone', 'screen:mobile']);
  });

  it('finds arrow icons and the Arrow tool for "arrow"', () => {
    const ids = filterInsertItems(PALETTE_ITEMS, 'arrow').map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['tool:arrow', 'icon:arrow-left', 'icon:arrow-right']));
    expect(ids[0]).toBe('tool:arrow');
    expect(paletteItem('tool:arrow')?.target).toEqual({ kind: 'tool', tool: 'arrow' });
  });

  it('inserts icons as an Icon element with the icon preset', () => {
    const item = paletteItem('icon:bell');
    expect(item).toMatchObject({ label: 'Bell', group: 'Icons', tile: true });
    // Stored in the prop the Icon component edits in the context bar, so the picker changes what's drawn.
    const key = kitRegistry.get('icon')!.editableProps.find((f) => f.kind === 'icon')!.key;
    expect(item?.target).toEqual({ kind: 'element', type: 'icon', props: { [key]: 'bell' } });
    expect(iconLabel('credit-card')).toBe('Credit card');
    expect(filterInsertItems(PALETTE_ITEMS, 'icon').some((i) => i.id === 'icon:heart')).toBe(true);
  });

  it('finds every screen by "screen" and nothing for gibberish', () => {
    const ids = filterInsertItems(PALETTE_ITEMS, 'screen').map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['screen:mobile', 'screen:tablet', 'screen:desktop']));
    expect(filterInsertItems(PALETTE_ITEMS, 'zzqx')).toHaveLength(0);
  });

  it('shows the placement shortcut for shapes, screens and the arrow tool', () => {
    expect(paletteItem('kit:rect')?.hint).toBe('R');
    expect(paletteItem('kit:sticky')?.hint).toBe('N');
    expect(paletteItem('screen:tablet')?.hint).toBe('F');
    expect(paletteItem('tool:arrow')?.hint).toBe('A');
    expect(paletteItem('nope')).toBeUndefined();
  });
});
