import { describe, expect, it } from 'vitest';
import { kitRegistry } from '../../../kit/registry';
import type { PropField } from '../../../kit/types';
import { MAX_INLINE, joinItems, splitFields, splitItems } from './contextBarFields';

const f = (key: string, kind: PropField['kind'], bar?: PropField['bar']): PropField => ({ key, label: key, kind, bar });

describe('splitFields', () => {
  it('honours explicit bar placement', () => {
    const r = splitFields([f('a', 'text', 'inline'), f('b', 'select', 'more'), f('c', 'boolean')]);
    expect(r.inline.map((x) => x.key)).toEqual(['a', 'c']);
    expect(r.more.map((x) => x.key)).toEqual(['b']);
  });

  it('puts compact kinds on the bar by default and text-like kinds in More', () => {
    const r = splitFields([f('t', 'text'), f('m', 'multiline'), f('n', 'number'), f('s', 'select'), f('i', 'icon'), f('l', 'items')]);
    expect(r.inline.map((x) => x.key)).toEqual(['s', 'i', 'l']);
    expect(r.more.map((x) => x.key)).toEqual(['t', 'm', 'n']);
  });

  it(`caps default inline fields at ${MAX_INLINE}`, () => {
    const r = splitFields([f('a', 'boolean'), f('b', 'boolean'), f('c', 'boolean'), f('d', 'boolean')]);
    expect(r.inline).toHaveLength(MAX_INLINE);
    expect(r.more.map((x) => x.key)).toEqual(['d']);
  });

  it('every field of every kit item lands exactly once', () => {
    for (const def of kitRegistry.values()) {
      const r = splitFields(def.editableProps);
      expect(r.inline.length + r.more.length).toBe(def.editableProps.length);
    }
  });

  it('Button: style and state on the bar, label in More', () => {
    const r = splitFields(kitRegistry.get('button')!.editableProps);
    expect(r.inline.map((x) => x.key)).toEqual(expect.arrayContaining(['state']));
    expect(r.more.map((x) => x.key)).toContain('label');
  });
});

describe('items encoding', () => {
  it('splits and joins comma lists, dropping blanks', () => {
    expect(splitItems('Home,  Search , ,Profile')).toEqual(['Home', 'Search', 'Profile']);
    expect(splitItems(undefined)).toEqual([]);
    expect(joinItems(['Home', ' ', 'Search '])).toBe('Home, Search');
  });
});
