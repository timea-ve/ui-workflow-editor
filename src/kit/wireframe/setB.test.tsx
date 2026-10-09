import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { KitItemView } from '../KitItemView';
import { KIT_ICON_NAMES } from '../icons';
import type { KitGroup, KitItemDef, VisualStyle } from '../types';
import { setB } from './setB';
import { header } from './header';
import { nav } from './nav';
import { tabs } from './tabs';
import { dropdown } from './dropdown';
import { list } from './list';
import { table } from './table';
import { card } from './card';
import { image } from './image';
import { modal } from './modal';
import { pageList } from './pagination';
import { monthLayout } from './calendar';
import { chartSeries, iconForLabel } from './_helpers';

afterEach(cleanup);

const STYLES: VisualStyle[] = ['sketchy', 'clean'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OWNED: KitItemDef<any>[] = [header, nav, tabs, dropdown, list, table, card, image, modal, ...setB];
const GROUPS: Record<string, KitGroup> = {
  header: 'navigation', nav: 'navigation', tabs: 'navigation', sidebar: 'navigation', menu: 'navigation',
  breadcrumbs: 'navigation', pagination: 'navigation', dropdown: 'inputs',
  image: 'content', video: 'content', avatar: 'content', card: 'content', list: 'content', table: 'content',
  calendar: 'content', 'line-chart': 'content', 'stacked-chart': 'content', divider: 'content',
  modal: 'feedback', tooltip: 'feedback', toast: 'feedback', badge: 'feedback', progress: 'feedback', spinner: 'feedback',
};

describe('kit set B', () => {
  it('registers the 15 new types', () => {
    expect(setB.map((d) => d.type).sort()).toEqual([
      'avatar', 'badge', 'breadcrumbs', 'calendar', 'divider', 'line-chart', 'menu', 'pagination',
      'progress', 'sidebar', 'spinner', 'stacked-chart', 'toast', 'tooltip', 'video',
    ]);
  });

  for (const def of OWNED) {
    describe(def.type, () => {
      it('has metadata, a group and sane props', () => {
        expect(def.group).toBe(GROUPS[def.type]);
        expect(def.category).toBe('wireframe');
        expect(def.keywords.length).toBeGreaterThan(2);
        expect(def.describe(def.defaultProps)).toMatch(/\S/);
        expect(def.minSize.w).toBeLessThanOrEqual(def.defaultSize.w);
        expect(def.minSize.h).toBeLessThanOrEqual(def.defaultSize.h);
        expect(def.defaultSize.w).toBeLessThanOrEqual(375);
        const keys = Object.keys(def.defaultProps);
        for (const f of def.editableProps) {
          expect(keys).toContain(f.key);
          if (f.kind === 'select') expect(f.options).toContain(def.defaultProps[f.key]);
          if (f.kind === 'icon') expect(KIT_ICON_NAMES).toContain(def.defaultProps[f.key]);
          expect(f.label.length).toBeLessThanOrEqual(32);
        }
        if (def.textProp) expect(keys).toContain(def.textProp);
        const inline = def.editableProps.filter((f) => f.bar === 'inline').length;
        expect(inline).toBeGreaterThanOrEqual(1);
        expect(inline).toBeLessThanOrEqual(3);
      });

      for (const style of STYLES) {
        for (const [label, size] of [['default', def.defaultSize], ['min', def.minSize], ['wide', { w: 375, h: def.defaultSize.h }]] as const) {
          it(`renders ${style} at ${label} size`, () => {
            const { container } = render(<KitItemView def={def} style={style} seed={7} w={size.w} h={size.h} />);
            const root = container.firstElementChild as HTMLElement;
            expect(root.getAttribute('aria-label')).toMatch(/\S/);
            expect(root.querySelector('svg')).not.toBeNull();
          });
        }
      }

      it('tolerates junk props', () => {
        const junk = Object.fromEntries(Object.keys(def.defaultProps).map((k) => [k, undefined]));
        for (const style of STYLES) expect(() => render(<KitItemView def={def} props={junk} style={style} seed={1} />)).not.toThrow();
        const weird = Object.fromEntries(Object.keys(def.defaultProps).map((k) => [k, 'zzz']));
        for (const style of STYLES) expect(() => render(<KitItemView def={def} props={weird} style={style} seed={1} />)).not.toThrow();
      });

      it('renders every select option', () => {
        for (const f of def.editableProps.filter((x) => x.kind === 'select')) {
          for (const o of f.options ?? []) {
            for (const style of STYLES) expect(() => render(<KitItemView def={def} props={{ [f.key]: o }} style={style} seed={2} />)).not.toThrow();
          }
        }
      });
    });
  }

  it('uses the items kind for list-like props (comma-separated storage)', () => {
    const kinds = (d: KitItemDef<never>, k: string) => d.editableProps.find((f) => f.key === k)?.kind;
    expect(kinds(tabs as never, 'tabs')).toBe('items');
    expect(kinds(nav as never, 'items')).toBe('items');
    expect(kinds(dropdown as never, 'options')).toBe('items');
    expect(kinds(list as never, 'items')).toBe('items');
    expect(kinds(table as never, 'columns')).toBe('items');
    expect(nav.label).toBe('Mobile tab bar');
  });

  it('keeps old header boards working (no variant = app bar)', () => {
    const { container } = render(<KitItemView def={header} props={{ title: 'Old', leading: 'back', action: 'none', variant: undefined }} style="clean" seed={1} />);
    expect(container.textContent).toBe('Old');
  });

  it('draws the web header with links, search and CTA', () => {
    const { container } = render(<KitItemView def={header} props={{ variant: 'web', title: 'Acme', links: 'Product, Pricing', search: true, right: 'button', cta: 'Sign up' }} style="clean" seed={1} w={960} h={64} />);
    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('Pricing');
    expect(container.textContent).toContain('Search');
    expect(container.textContent).toContain('Sign up');
    expect(header.describe({ ...header.defaultProps, variant: 'web' })).toMatch(/Web header/);
  });

  it('edited tab names render', () => {
    const { container } = render(<KitItemView def={tabs} props={{ tabs: 'One, Two, Three', active: 1 }} style="clean" seed={1} />);
    expect(container.textContent).toBe('OneTwoThree');
  });

  it('menu hides rows that do not fit and keeps the divider with the last row', () => {
    const def = setB.find((d) => d.type === 'menu')!;
    const { container } = render(<KitItemView def={def} props={{ items: 'A, B, C, D', showIcons: false }} style="clean" seed={1} w={200} h={90} />);
    expect(container.textContent).toBe('AB');
  });

  it('breadcrumbs collapse the middle when narrow', () => {
    const def = setB.find((d) => d.type === 'breadcrumbs')!;
    const { container } = render(<KitItemView def={def} props={{ items: 'Home, Projects, Clients, Website redesign' }} style="clean" seed={1} w={160} h={24} />);
    expect(container.textContent).toContain('…');
    expect(container.textContent).toContain('Website redesign');
  });

  it('pagination keeps first, last and current pages', () => {
    expect(pageList(1, 5, 7)).toEqual([1, 2, 3, 4, 5]);
    expect(pageList(7, 20, 7)).toEqual([1, null, 6, 7, 8, null, 20]);
    expect(pageList(1, 20, 7)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(pageList(20, 20, 7)).toEqual([1, null, 16, 17, 18, 19, 20]);
    expect(pageList(5, 20, 3)).toEqual([4, 5, 6]);
  });

  it('calendar lays out real months', () => {
    expect(monthLayout('October 2026', 'monday')).toMatchObject({ offset: 3, days: 31 }); // Thu 1 Oct 2026
    expect(monthLayout('February 2028', 'sunday')).toMatchObject({ offset: 2, days: 29 }); // Tue, leap year
    expect(monthLayout('nonsense', 'monday').days).toBe(31);
  });

  it('chart series are deterministic and bounded', () => {
    for (const shape of ['rising', 'falling', 'wave', 'flat', 'junk']) {
      const a = chartSeries(shape, 8);
      expect(a).toEqual(chartSeries(shape, 8));
      for (const v of a) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(chartSeries('rising', 8).at(-1)!).toBeGreaterThan(chartSeries('rising', 8)[0]);
  });

  it('icon heuristics only return known icons', () => {
    for (const l of ['Home', 'Settings', 'Log out', 'Zebra', 'Team', 'Reports']) expect(KIT_ICON_NAMES).toContain(iconForLabel(l, 3));
  });

  it('descriptions reflect state', () => {
    const get = (t: string) => setB.find((d) => d.type === t)!;
    expect(get('toast').describe({ ...get('toast').defaultProps, kind: 'error' })).toMatch(/^Error toast/);
    expect(get('progress').describe({ ...get('progress').defaultProps, value: 25 })).toMatch(/25%/);
    expect(get('pagination').describe({ current: 2, total: 9 })).toBe('Pagination, page 2 of 9');
    expect(get('calendar').describe({ ...get('calendar').defaultProps, rangeEnd: 18 })).toMatch(/14–18/);
  });
});
