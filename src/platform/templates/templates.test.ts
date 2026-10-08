import { describe, expect, it } from 'vitest';
import { kitRegistry } from '../../kit/registry';
import { detectFlows } from '../../flow/ops';
import { TEMPLATES, getTemplate } from '.';

describe('templates', () => {
  it('has the five contract ids', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['signup', 'onboarding', 'checkout', 'settings', 'search']);
    expect(getTemplate('checkout')?.name).toBe('Checkout');
    expect(getTemplate('nope')).toBeUndefined();
  });

  describe.each(TEMPLATES)('$id', (t) => {
    const doc = t.build();
    const frames = Object.values(doc.frames);

    it('builds 3–6 named screens matching screenCount', () => {
      expect(frames.length).toBe(t.screenCount);
      expect(frames.length).toBeGreaterThanOrEqual(3);
      expect(frames.length).toBeLessThanOrEqual(6);
      for (const f of frames) expect(f.name.trim()).not.toBe('');
      expect(t.name).toMatch(/\S/);
      expect(t.description).toMatch(/\S/);
    });

    it('only uses registered element types with linkable link sources', () => {
      for (const e of Object.values(doc.elements)) expect(kitRegistry.has(e.type)).toBe(true);
      for (const l of Object.values(doc.links)) {
        const src = doc.elements[l.sourceElementId];
        expect(src).toBeDefined();
        expect(kitRegistry.get(src.type)!.linkable).toBe(true);
      }
    });

    it('links resolve to existing frames and connectors to existing nodes', () => {
      expect(Object.keys(doc.links).length).toBeGreaterThanOrEqual(frames.length - 1);
      for (const l of Object.values(doc.links)) {
        expect(doc.frames[l.targetFrameId]).toBeDefined();
        expect(doc.connectors[l.connectorId!]).toBeDefined();
      }
      const exists = (id: string) => !!doc.frames[id] || !!doc.elements[id];
      for (const c of Object.values(doc.connectors)) {
        expect(exists(c.from.nodeId)).toBe(true);
        expect(exists(c.to.nodeId)).toBe(true);
      }
    });

    it('keeps every element inside its frame', () => {
      for (const e of Object.values(doc.elements)) {
        if (!e.parentId) continue;
        const f = doc.frames[e.parentId];
        expect(f, `${e.type} parent`).toBeDefined();
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeGreaterThanOrEqual(0);
        expect(e.x + e.w, `${t.id} ${e.type} right edge`).toBeLessThanOrEqual(f.w);
        expect(e.y + e.h, `${t.id} ${e.type} bottom edge`).toBeLessThanOrEqual(f.h);
      }
    });

    it('lays screens out without overlap', () => {
      for (const a of frames) for (const b of frames) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    });

    it('forms exactly one flow that starts on the left-most screen', () => {
      const flows = detectFlows(doc);
      expect(flows).toHaveLength(1);
      expect(flows[0].frameIds).toHaveLength(frames.length);
      const leftmost = [...frames].sort((a, b) => a.x - b.x || a.y - b.y)[0];
      expect(flows[0].startFrameId).toBe(leftmost.id);
    });

    it('returns fresh ids on every build', () => {
      const again = t.build();
      const ids = new Set(Object.keys(doc.frames));
      expect(Object.keys(again.frames).some((id) => ids.has(id))).toBe(false);
    });
  });
});
