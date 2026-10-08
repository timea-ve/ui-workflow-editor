import { describe, expect, it } from 'vitest';
import { createScreen, emptyDoc } from '../flow/ops';
import { nextScreenName, placeScreen, placeShape } from './placement';

describe('placement', () => {
  it('names screens "Screen N" with the next free number', () => {
    let doc = emptyDoc();
    expect(nextScreenName(doc)).toBe('Screen 1');
    doc = placeScreen(doc, { x: 0, y: 0 }).doc;
    doc = placeScreen(doc, { x: 0, y: 0 }).doc;
    expect(nextScreenName(doc)).toBe('Screen 3');
    doc = createScreen(doc, { device: 'mobile', name: 'Home', x: 0, y: 0 }).doc;
    expect(nextScreenName(doc)).toBe('Screen 3');
  });

  it('centres a desktop screen on the click by default', () => {
    const r = placeScreen(emptyDoc(), { x: 640, y: 400 });
    expect(r.doc.frames[r.id]).toMatchObject({ x: 0, y: 0, w: 1280, h: 800, device: 'desktop', name: 'Screen 1' });
  });

  it('places shapes on the canvas or inside a screen (clamped, relative)', () => {
    const s = placeScreen(emptyDoc(), { x: 640, y: 400 }, 'mobile');
    const onCanvas = placeShape(s.doc, 'rect', { x: 5000, y: 5000 });
    expect(onCanvas.doc.elements[onCanvas.id].parentId).toBeUndefined();
    const inFrame = placeShape(s.doc, 'text', { x: -1000, y: -1000 }, s.id);
    const e = inFrame.doc.elements[inFrame.id];
    expect(e).toMatchObject({ parentId: s.id, x: 0, y: 0, type: 'text' });
    expect(placeShape(s.doc, 'text', { x: 0, y: 0 }).doc.elements).toBeDefined();
  });
});
