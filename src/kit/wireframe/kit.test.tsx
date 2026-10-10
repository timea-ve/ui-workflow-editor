import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { WireframeType } from '../../model/types';
import { DEVICE_SIZES } from '../../model/types';
import { KitItemView } from '../KitItemView';
import { kitRegistry } from '../registry';
import type { VisualStyle } from '../types';
import { wireframeKit } from './index';
import { DeviceFrame, deviceContentInset } from './DeviceFrame';
import { ICON_GLYPHS } from './_helpers';

const ALL: WireframeType[] = [
  'header', 'nav', 'button', 'input', 'checkbox', 'toggle', 'dropdown', 'card',
  'list', 'table', 'image', 'text', 'heading', 'modal', 'tabs', 'icon',
  'caption', 'link', 'icon-button', 'fab', 'textarea', 'search', 'radio', 'slider', 'datepicker',
  'sidebar', 'menu', 'breadcrumbs', 'pagination', 'video', 'avatar', 'calendar', 'line-chart',
  'stacked-chart', 'divider', 'tooltip', 'toast', 'badge', 'progress', 'spinner', 'hotspot',
];
const STYLES: VisualStyle[] = ['sketchy', 'clean'];

const TEXT_ONLY = ['text', 'heading', 'caption', 'link'];

afterEach(cleanup);

describe('wireframe kit', () => {
  it('registers all 41 wireframe types', () => {
    expect(wireframeKit.map((d) => d.type).sort()).toEqual([...ALL].sort());
    for (const t of ALL) expect(kitRegistry.get(t)?.category).toBe('wireframe');
  });

  it('puts every component in a palette section, and index fields point at an items list', () => {
    for (const def of wireframeKit) {
      expect(def.group, def.type).toBeTruthy();
      for (const f of def.editableProps) {
        if (!f.itemsFrom) continue;
        expect(f.kind).toBe('number');
        expect(def.editableProps.find((g) => g.key === f.itemsFrom)?.kind, `${def.type}.${f.key}`).toBe('items');
      }
    }
  });

  for (const def of wireframeKit) {
    describe(def.type, () => {
      it('has sane metadata', () => {
        expect(def.describe(def.defaultProps)).toMatch(/\S/);
        expect(def.keywords.length).toBeGreaterThan(0);
        expect(def.minSize.w).toBeLessThanOrEqual(def.defaultSize.w);
        expect(def.minSize.h).toBeLessThanOrEqual(def.defaultSize.h);
        for (const f of def.editableProps) expect(Object.keys(def.defaultProps)).toContain(f.key);
        if (def.textProp) expect(Object.keys(def.defaultProps)).toContain(def.textProp);
        // Fits inside a mobile screen.
        expect(def.defaultSize.w).toBeLessThanOrEqual(DEVICE_SIZES.mobile.w);
      });

      for (const style of STYLES) {
        for (const [label, size] of [['default', def.defaultSize], ['min', def.minSize]] as const) {
          it(`renders ${style} at ${label} size`, () => {
            const { container } = render(<KitItemView def={def} style={style} seed={7} w={size.w} h={size.h} />);
            const root = container.firstElementChild as HTMLElement;
            expect(root.getAttribute('aria-label')).toMatch(/\S/);
            // Text-only items draw no shapes; everything else must draw at least one.
            if (!TEXT_ONLY.includes(def.type)) expect(root.querySelector('svg')).not.toBeNull();
            expect(root.textContent?.length ?? 0).toBeGreaterThanOrEqual(TEXT_ONLY.includes(def.type) ? 1 : 0);
          });
        }
      }

      it('keeps tappable parts inside the component', () => {
        for (const size of [def.defaultSize, { w: 600, h: 400 }]) {
          for (const r of def.itemRects?.(def.defaultProps, size) ?? []) {
            expect(r.label, def.type).toMatch(/\S/);
            expect(r.x).toBeGreaterThanOrEqual(-8);
            expect(r.y).toBeGreaterThanOrEqual(-8);
            expect(r.x + r.w).toBeLessThanOrEqual(size.w + 8);
            expect(r.y + r.h).toBeLessThanOrEqual(size.h + 8);
          }
        }
      });

      it('tolerates junk props', () => {
        const junk = Object.fromEntries(Object.keys(def.defaultProps).map((k) => [k, undefined]));
        expect(() => render(<KitItemView def={def} props={junk} style="clean" seed={1} />)).not.toThrow();
        expect(() => render(<KitItemView def={def} props={junk} style="sketchy" seed={1} />)).not.toThrow();
      });
    });
  }

  it('state props change the description', () => {
    const cb = kitRegistry.get('checkbox')!;
    expect(cb.describe({ ...cb.defaultProps, checked: true })).toMatch(/checked/);
    expect(cb.describe({ ...cb.defaultProps, checked: false })).toMatch(/not checked/);
    const tg = kitRegistry.get('toggle')!;
    expect(tg.describe({ ...tg.defaultProps, on: false })).toMatch(/off/);
  });

  it('renders every icon glyph', () => {
    const def = kitRegistry.get('icon')!;
    for (const glyph of ICON_GLYPHS) {
      for (const style of STYLES) {
        expect(() => render(<KitItemView def={def} props={{ glyph }} style={style} seed={3} />)).not.toThrow();
      }
    }
  });

  it('hides list rows that do not fit', () => {
    const def = kitRegistry.get('list')!;
    const { container } = render(<KitItemView def={def} props={{ count: 10, items: 'A,B,C,D,E,F,G,H,I,J' }} style="clean" seed={1} w={300} h={120} />);
    expect(container.textContent).toContain('B');
    expect(container.textContent).not.toContain('C');
  });
});

describe('DeviceFrame', () => {
  for (const device of ['mobile', 'tablet', 'desktop'] as const) {
    for (const style of STYLES) {
      it(`renders ${device} in ${style}`, () => {
        const { w, h } = DEVICE_SIZES[device];
        const { getByRole, getByText } = render(
          <DeviceFrame device={device} w={w} h={h} name="Sign up" style={style} seed={5}><span>child</span></DeviceFrame>,
        );
        expect(getByRole('group', { name: /Sign up/ })).toBeInTheDocument();
        expect(getByText('child')).toBeInTheDocument();
      });
    }
    it(`${device} inset leaves a content area`, () => {
      const i = deviceContentInset(device);
      const { w, h } = DEVICE_SIZES[device];
      expect(w - i.left - i.right).toBeGreaterThan(0);
      expect(h - i.top - i.bottom).toBeGreaterThan(0);
    });
  }
});
