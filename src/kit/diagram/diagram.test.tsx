import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { KitItemView } from '../KitItemView';
import { diagramKit } from './index';
import { pillPoints } from './_helpers';
import type { VisualStyle } from '../types';

const styles: VisualStyle[] = ['sketchy', 'clean'];

describe('diagram kit', () => {
  it('registers the five diagram shapes', () => {
    expect(diagramKit.map((d) => d.type)).toEqual(['rect', 'diamond', 'ellipse', 'sticky', 'label']);
    for (const d of diagramKit) {
      expect(d.category).toBe('diagram');
      expect(d.textProp && d.textProp in d.defaultProps).toBe(true);
      for (const f of d.editableProps) expect(f.key in d.defaultProps).toBe(true);
    }
  });

  for (const def of diagramKit) {
    for (const style of styles) {
      it(`${def.type} renders in ${style} style`, () => {
        const text = 'Hello shape';
        const { container, unmount } = render(
          <KitItemView def={def} props={{ [def.textProp!]: text }} style={style} seed={42} />,
        );
        const root = container.firstElementChild!;
        expect(root).toHaveAttribute('role', 'img');
        expect(root).toHaveAttribute('data-kit-style', style);
        expect(root.getAttribute('aria-label')).toContain(text);
        expect(container.textContent).toContain(text);
        if (def.type !== 'label') {
          const drawn = container.querySelectorAll('svg path, svg rect, svg ellipse, svg polygon, svg polyline');
          expect(drawn.length).toBeGreaterThan(0);
        }
        if (style === 'clean' && def.type !== 'label') {
          // Clean style never needs Rough.js paths for the main outline.
          expect(container.querySelector('svg rect, svg ellipse, svg polygon')).not.toBeNull();
        }
        // Colours come from tokens only.
        expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b/i);
        unmount();
      });
    }
  }

  it('ellipse supports pill and oval in both styles', () => {
    const def = diagramKit.find((d) => d.type === 'ellipse')!;
    for (const style of styles) {
      for (const shape of ['pill', 'oval']) {
        const { container, unmount } = render(<KitItemView def={def} props={{ shape }} style={style} seed={3} />);
        expect(container.querySelector('svg')).not.toBeNull();
        unmount();
      }
    }
  });

  it('sticky keeps line breaks', () => {
    const def = diagramKit.find((d) => d.type === 'sticky')!;
    const { container, unmount } = render(<KitItemView def={def} props={{ text: 'a\nb' }} style="clean" seed={1} />);
    expect(container.textContent).toContain('a\nb');
    unmount();
  });

  it('pillPoints stays inside the box', () => {
    for (const [x, y] of pillPoints(140, 56, 1)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(140);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(56);
    }
  });
});
