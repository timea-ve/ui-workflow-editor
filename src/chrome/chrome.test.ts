import { describe, expect, it } from 'vitest';
import { toolForKey, isTypingTarget } from './tools';
import { filterInsertItems, type InsertItem } from './insertSearch';

describe('toolForKey', () => {
  it('maps every documented single-key shortcut', () => {
    const expected: Record<string, string> = { v: 'select', h: 'pan', f: 'screen', r: 'rect', d: 'diamond', o: 'ellipse', a: 'arrow', t: 'text', n: 'sticky', '/': 'insert', p: 'play' };
    for (const [key, tool] of Object.entries(expected)) expect(toolForKey({ key })).toBe(tool);
  });
  it('is case-insensitive and Esc returns to select', () => {
    expect(toolForKey({ key: 'R' })).toBe('rect');
    expect(toolForKey({ key: 'Escape' })).toBe('select');
  });
  it('ignores modified keys, typing and unbound keys', () => {
    expect(toolForKey({ key: 'd', metaKey: true })).toBeNull();
    expect(toolForKey({ key: 'c', ctrlKey: true })).toBeNull();
    expect(toolForKey({ key: 'r' }, true)).toBeNull();
    expect(toolForKey({ key: 'q' })).toBeNull();
  });
  it('detects typing targets', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('filterInsertItems', () => {
  const items: InsertItem[] = [
    { id: 'button', label: 'Button', group: 'Wireframe', keywords: ['cta', 'action'] },
    { id: 'input', label: 'Text input', group: 'Wireframe', keywords: ['field', 'form'] },
    { id: 'text', label: 'Text', group: 'Diagram' },
    { id: 'tabs', label: 'Tabs', group: 'Wireframe' },
    { id: 'table', label: 'Table', group: 'Wireframe', keywords: ['grid', 'data'] },
  ];
  it('returns everything for an empty query', () => {
    expect(filterInsertItems(items, '  ')).toEqual(items);
  });
  it('ranks exact > prefix > word > keyword', () => {
    expect(filterInsertItems(items, 'text').map((i) => i.id)).toEqual(['text', 'input']);
    expect(filterInsertItems(items, 'ta').map((i) => i.id)).toEqual(['tabs', 'table']);
    expect(filterInsertItems(items, 'cta').map((i) => i.id)).toEqual(['button']);
    expect(filterInsertItems(items, 'inp').map((i) => i.id)).toEqual(['input']);
  });
  it('returns nothing when nothing matches', () => {
    expect(filterInsertItems(items, 'zzz')).toEqual([]);
  });
});
