import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DEVICE_SIZES } from '../../model/types';
import { KitItemView } from '../KitItemView';
import { kitRegistry } from '../registry';
import { KIT_ICON_NAMES } from '../icons';
import type { KitItemDef, VisualStyle } from '../types';
import { setA } from './setA';
import { button } from './button';
import { text } from './text';
import { heading } from './heading';
import { icon } from './icon';
import { input } from './input';
import { checkbox } from './checkbox';
import { toggle } from './toggle';

const STYLES: VisualStyle[] = ['sketchy', 'clean'];
const NEW_TYPES = ['caption', 'link', 'icon-button', 'fab', 'textarea', 'search', 'radio', 'slider', 'datepicker'];
const TEXT_ONLY = ['caption', 'link', 'heading', 'text'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OWNED: KitItemDef<any>[] = [...setA, button, text, heading, icon, input, checkbox, toggle];
const GROUPS: Record<string, string> = {
  heading: 'text', text: 'text', caption: 'text', link: 'text',
  button: 'actions', 'icon-button': 'actions', fab: 'actions',
  input: 'inputs', textarea: 'inputs', search: 'inputs', checkbox: 'inputs', radio: 'inputs', toggle: 'inputs', slider: 'inputs', datepicker: 'inputs',
  icon: 'content',
};

afterEach(cleanup);

function view(def: KitItemDef<Record<string, unknown>>, props: Record<string, unknown> = {}, style: VisualStyle = 'clean', w?: number, h?: number) {
  const { container } = render(<KitItemView def={def} props={props} style={style} seed={5} w={w} h={h} />);
  return container.firstElementChild as HTMLElement;
}

describe('kit set A', () => {
  it('registers the new types in setA and the registry', () => {
    expect(setA.map((d) => d.type).sort()).toEqual([...NEW_TYPES].sort());
    for (const t of NEW_TYPES) expect(kitRegistry.get(t as never)?.category).toBe('wireframe');
  });

  for (const def of OWNED) {
    describe(def.type, () => {
      it('has sane metadata and a palette group', () => {
        expect(def.group).toBe(GROUPS[def.type]);
        expect(def.describe(def.defaultProps)).toMatch(/\S/);
        expect(def.keywords.length).toBeGreaterThan(2);
        expect(def.minSize.w).toBeLessThanOrEqual(def.defaultSize.w);
        expect(def.minSize.h).toBeLessThanOrEqual(def.defaultSize.h);
        expect(def.defaultSize.w).toBeLessThanOrEqual(DEVICE_SIZES.mobile.w);
        for (const f of def.editableProps) {
          expect(Object.keys(def.defaultProps)).toContain(f.key);
          if (f.kind === 'select') expect(f.options).toContain(def.defaultProps[f.key]);
        }
        if (def.textProp) expect(Object.keys(def.defaultProps)).toContain(def.textProp);
        const inline = def.editableProps.filter((f) => f.bar === 'inline').length;
        expect(inline).toBeGreaterThanOrEqual(1);
        expect(inline).toBeLessThanOrEqual(3);
      });

      for (const style of STYLES) {
        for (const [label, size] of [['default', def.defaultSize], ['min', def.minSize]] as const) {
          it(`renders ${style} at ${label} size`, () => {
            const root = view(def, {}, style, size.w, size.h);
            expect(root.getAttribute('aria-label')).toMatch(/\S/);
            if (TEXT_ONLY.includes(def.type)) expect(root.textContent).toMatch(/\S/);
            else expect(root.querySelector('svg')).not.toBeNull();
          });
        }
      }

      it('tolerates junk props', () => {
        const junk = Object.fromEntries(Object.keys(def.defaultProps).map((k) => [k, undefined]));
        for (const style of STYLES) expect(() => view(def, junk, style)).not.toThrow();
      });
    });
  }

  it('paragraph switches between text and grey placeholder blocks', () => {
    expect(view(text).textContent).toMatch(/supporting copy/);
    const blocks = view(text, { mode: 'blocks' }, 'clean', 327, 60);
    expect(blocks.textContent).toBe('');
    // 60px of md text (17.5px lines) → 3 bars.
    expect(blocks.querySelectorAll('rect').length).toBe(3);
    expect(text.describe({ ...text.defaultProps, mode: 'blocks' })).toMatch(/placeholder/);
  });

  it('button states are described and drawn differently', () => {
    const svgCount = (state: string) => view(button, { state }).querySelectorAll('svg').length;
    expect(svgCount('default')).toBe(1);
    expect(svgCount('hover')).toBe(2);
    expect(svgCount('pressed')).toBe(3);
    expect(button.describe({ ...button.defaultProps, state: 'disabled' })).toBe("Button 'Button', disabled");
    expect(button.describe({ ...button.defaultProps, state: 'nonsense' })).toBe("Button 'Button'");
    for (const def of [kitRegistry.get('icon-button')!, kitRegistry.get('fab')!]) {
      expect(def.describe({ ...def.defaultProps, state: 'pressed' })).toMatch(/pressed$/);
    }
  });

  it('icon reads the curated set, keeping legacy glyph values working', () => {
    for (const glyph of ['star', 'menu', 'search', 'user', 'close', 'plus', 'chevron-left', 'chevron-right', 'check', 'home', 'more', 'circle', 'square']) {
      expect(KIT_ICON_NAMES).toContain(glyph);
      expect(icon.describe({ glyph, name: '' })).toBe(`Icon (${glyph})`);
    }
    expect(icon.describe({ glyph: 'star', icon: 'heart', name: 'Like' })).toBe("Icon 'Like' (heart)");
    expect(icon.describe({ glyph: 'nope', name: '' })).toBe('Icon (circle)');
    for (const name of KIT_ICON_NAMES) expect(view(icon, { glyph: name }).querySelector('svg')).not.toBeNull();
  });

  it('radio marks the selected option and hides rows that do not fit', () => {
    const radio = kitRegistry.get('radio')!;
    expect(radio.describe({ items: 'A, B, C', selected: 1 })).toBe('Radio buttons: A, B (selected), C');
    const root = view(radio, { items: 'A, B, C, D, E' }, 'clean', 200, 60);
    expect(root.textContent).toBe('AB');
  });

  it('slider clamps its value', () => {
    const slider = kitRegistry.get('slider')!;
    expect(slider.describe({ ...slider.defaultProps, value: 140 })).toMatch(/100%/);
    expect(slider.describe({ ...slider.defaultProps, value: 'x' })).toMatch(/50%/);
  });

  it('date picker draws a month grid only when open and there is room', () => {
    const dp = kitRegistry.get('datepicker')!;
    expect(view(dp, { open: true }).textContent).not.toMatch(/October/);
    const open = view(dp, { open: true, value: '3 Feb 2027' }, 'clean', 327, 280);
    expect(open.textContent).toMatch(/February 2027/);
    expect(open.textContent).toMatch(/28/);
    expect(open.textContent).not.toMatch(/29/);
    expect(dp.describe({ ...dp.defaultProps, open: true })).toMatch(/calendar open/);
  });

  it('search shows the typed query instead of the placeholder', () => {
    const s = kitRegistry.get('search')!;
    expect(view(s).textContent).toBe('Search');
    expect(view(s, { value: 'shoes' }).textContent).toBe('shoes');
  });

  it('text input shows helper text when there is room', () => {
    expect(view(input, { helper: 'Required', state: 'error' }, 'clean', 327, 84).textContent).toMatch(/Required/);
    expect(view(input, { helper: 'Required' }, 'clean', 327, 64).textContent).not.toMatch(/Required/);
    expect(input.describe({ ...input.defaultProps, state: 'error' })).toMatch(/error/);
  });

  it('fab extends with a label only when wide enough', () => {
    const fab = kitRegistry.get('fab')!;
    expect(view(fab, { label: 'Compose' }).textContent).toBe('');
    expect(view(fab, { label: 'Compose' }, 'clean', 160, 56).textContent).toBe('Compose');
  });
});
