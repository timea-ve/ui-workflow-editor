import { describe, expect, it } from 'vitest';
import { filterInsertItems } from '../../../chrome/insertSearch';
import { PALETTE_ITEMS, paletteItem } from './paletteItems';

describe('insert palette items', () => {
  it('lists 16 components, 5 shapes and 3 screens, grouped in that order', () => {
    const count = (g: string) => PALETTE_ITEMS.filter((i) => i.group === g).length;
    expect(PALETTE_ITEMS).toHaveLength(24);
    expect([count('Components'), count('Shapes'), count('Screens')]).toEqual([16, 5, 3]);
    const groups = [...new Set(PALETTE_ITEMS.map((i) => i.group))];
    expect(groups).toEqual(['Components', 'Shapes', 'Screens']);
    expect(new Set(PALETTE_ITEMS.map((i) => i.id)).size).toBe(24);
  });

  it('ranks the best match first', () => {
    expect(filterInsertItems(PALETTE_ITEMS, 'button')[0].label).toBe('Button');
    expect(filterInsertItems(PALETTE_ITEMS, 'sticky')[0].id).toBe('kit:sticky');
    expect(filterInsertItems(PALETTE_ITEMS, 'phone')[0].id).toBe('screen:mobile');
  });

  it('finds every screen by "screen" and nothing for gibberish', () => {
    const ids = filterInsertItems(PALETTE_ITEMS, 'screen').map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['screen:mobile', 'screen:tablet', 'screen:desktop']));
    expect(filterInsertItems(PALETTE_ITEMS, 'zzqx')).toHaveLength(0);
  });

  it('shows the placement shortcut for shapes and screens', () => {
    expect(paletteItem('kit:rect')?.hint).toBe('R');
    expect(paletteItem('kit:sticky')?.hint).toBe('N');
    expect(paletteItem('screen:tablet')?.hint).toBe('F');
    expect(paletteItem('nope')).toBeUndefined();
  });
});
