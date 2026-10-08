import { describe, expect, it } from 'vitest';
import { DEVICE_SIZES, type BoardDoc } from '../../../model/types';
import { addElement, createScreen, emptyDoc } from '../../../flow/ops';
import {
  alignNodes, distributeNodes, frameAtPoint, insertAtPoint, insertIntoFrame, nudgeSize, reparentAfterMove,
  resizeBox, resizeRules, setElementProps, setElementText, setFrameDevice, setNodeSize, setStartScreen,
  targetFrameFor, textPropOf,
} from './ops';

function board() {
  let doc: BoardDoc = emptyDoc();
  const a = createScreen(doc, { device: 'mobile', x: 0, y: 0, name: 'A' });
  doc = a.doc;
  const b = createScreen(doc, { device: 'mobile', x: 600, y: 0, name: 'B' });
  doc = b.doc;
  return { doc, a: a.id, b: b.id };
}

describe('insert placement', () => {
  it('inserts at the top of an empty screen, below the status bar', () => {
    const { doc, a } = board();
    const r = insertIntoFrame(doc, 'button', a);
    const el = r.doc.elements[r.id];
    expect(el.parentId).toBe(a);
    expect(el.x).toBe(24);
    expect(el.y).toBe(44 + 16);
    expect(el.props.label).toBeDefined();
  });

  it('stacks below the lowest element with a 16px gap', () => {
    const { doc, a } = board();
    const one = insertIntoFrame(doc, 'heading', a);
    const two = insertIntoFrame(one.doc, 'button', a);
    const h = one.doc.elements[one.id];
    expect(two.doc.elements[two.id].y).toBe(h.y + h.h + 16);
  });

  it('makes headers full width at the top', () => {
    const { doc, a } = board();
    const r = insertIntoFrame(doc, 'header', a);
    const el = r.doc.elements[r.id];
    expect([el.x, el.y, el.w]).toEqual([0, 44, DEVICE_SIZES.mobile.w]);
  });

  it('clamps inside the screen when it is full', () => {
    const { doc, a } = board();
    const filled = addElement(doc, { type: 'card', parentId: a, x: 0, y: 700, w: 300, h: 100 });
    const r = insertIntoFrame(filled.doc, 'button', a);
    const el = r.doc.elements[r.id];
    expect(el.y + el.h).toBeLessThanOrEqual(812 - 24);
  });

  it('shrinks components wider than the screen', () => {
    const { doc, a } = board();
    const r = insertIntoFrame(doc, 'table', a);
    const el = r.doc.elements[r.id];
    expect(el.x + el.w).toBeLessThanOrEqual(DEVICE_SIZES.mobile.w);
  });

  it('inserts centred on a point, clamped inside a screen', () => {
    const { doc, a } = board();
    const free = insertAtPoint(doc, 'rect', { x: 2000, y: 2000 });
    const f = free.doc.elements[free.id];
    expect(f.parentId).toBeUndefined();
    expect(f.x + f.w / 2).toBe(2000);
    const inside = insertAtPoint(doc, 'button', { x: 370, y: 5 }, a);
    const e = inside.doc.elements[inside.id];
    expect(e.parentId).toBe(a);
    expect(e.x + e.w).toBeLessThanOrEqual(375);
    expect(e.y).toBe(0);
  });

  it('finds the target screen from the selection', () => {
    const { doc, a } = board();
    const r = insertIntoFrame(doc, 'button', a);
    expect(targetFrameFor(r.doc, [a])).toBe(a);
    expect(targetFrameFor(r.doc, [r.id])).toBe(a);
    expect(targetFrameFor(r.doc, [])).toBeUndefined();
    expect(frameAtPoint(r.doc, { x: 10, y: 10 })).toBe(a);
    expect(frameAtPoint(r.doc, { x: 500, y: 10 })).toBeUndefined();
  });
});

describe('reparentAfterMove', () => {
  it('moves an element dragged from one screen into another', () => {
    const { doc, a, b } = board();
    const r = addElement(doc, { type: 'button', parentId: a, x: 20, y: 100, w: 100, h: 40 });
    // Dragged so its absolute position is now over B.
    const moved = { ...r.doc, elements: { ...r.doc.elements, [r.id]: { ...r.doc.elements[r.id], x: 640 } } };
    const out = reparentAfterMove(moved, [r.id]);
    expect(out.elements[r.id]).toMatchObject({ parentId: b, x: 40, y: 100 });
  });

  it('makes an element dragged onto empty canvas a canvas element', () => {
    const { doc, a } = board();
    const r = addElement(doc, { type: 'button', parentId: a, x: 20, y: 100, w: 100, h: 40 });
    const moved = { ...r.doc, elements: { ...r.doc.elements, [r.id]: { ...r.doc.elements[r.id], x: 420 } } };
    const out = reparentAfterMove(moved, [r.id]);
    expect(out.elements[r.id].parentId).toBeUndefined();
    expect(out.elements[r.id]).toMatchObject({ x: 420, y: 100 });
  });

  it('drops a canvas element into a screen', () => {
    const { doc, b } = board();
    const r = addElement(doc, { type: 'rect', x: 650, y: 300, w: 100, h: 60 });
    const out = reparentAfterMove(r.doc, [r.id]);
    expect(out.elements[r.id]).toMatchObject({ parentId: b, x: 50, y: 300 });
  });

  it('clamps an element that stays in its screen and ignores children moved with their screen', () => {
    const { doc, a } = board();
    const r = addElement(doc, { type: 'button', parentId: a, x: 300, y: 100, w: 120, h: 40 });
    const out = reparentAfterMove(r.doc, [r.id]);
    expect(out.elements[r.id].x).toBe(375 - 120);
    expect(reparentAfterMove(r.doc, [a, r.id])).toBe(r.doc);
  });
});

describe('resize', () => {
  const start = { x: 16, y: 16, w: 100, h: 40 };
  it('snaps the moving edge to the 8px grid and keeps the opposite edge', () => {
    expect(resizeBox(start, 'se', 13, 2, { axes: 'both', min: { w: 20, h: 20 }, snap: true })).toEqual({ x: 16, y: 16, w: 112, h: 40 });
    expect(resizeBox(start, 'nw', -9, 0, { axes: 'both', min: { w: 20, h: 20 }, snap: true })).toEqual({ x: 8, y: 16, w: 108, h: 40 });
  });
  it('respects min size, axes and parent bounds', () => {
    expect(resizeBox(start, 'se', -500, -500, { axes: 'both', min: { w: 40, h: 24 } })).toMatchObject({ w: 40, h: 24 });
    expect(resizeBox(start, 'se', 50, 50, { axes: 'horizontal', min: { w: 1, h: 1 } })).toMatchObject({ w: 150, h: 40 });
    expect(resizeBox(start, 'se', 500, 500, { axes: 'both', min: { w: 1, h: 1 }, bounds: { w: 200, h: 100 } })).toEqual({ x: 16, y: 16, w: 184, h: 84 });
    expect(resizeBox(start, 'nw', -500, -500, { axes: 'both', min: { w: 1, h: 1 }, bounds: { w: 200, h: 100 } })).toEqual({ x: 0, y: 0, w: 116, h: 56 });
  });
  it('locks screen width and never cuts content', () => {
    const { doc, a } = board();
    const r = addElement(doc, { type: 'button', parentId: a, x: 0, y: 900, w: 100, h: 40 });
    const rules = resizeRules(r.doc, a)!;
    expect(rules.axes).toBe('vertical');
    expect(rules.min.h).toBe(940);
  });
  it('setNodeSize clamps children inside the screen and respects min size', () => {
    const { doc, a } = board();
    const r = addElement(doc, { type: 'button', parentId: a, x: 300, y: 100, w: 60, h: 40 });
    const out = setNodeSize(r.doc, r.id, { w: 1000 });
    expect(out.elements[r.id]).toMatchObject({ x: 0, w: 375 });
    const tiny = setNodeSize(r.doc, r.id, { w: 1, h: 1 });
    expect(tiny.elements[r.id].w).toBeGreaterThan(1);
    expect(nudgeSize(r.doc, r.id, 8, 0).elements[r.id].w).toBe(68);
  });
});

describe('props and text', () => {
  it('edits props immutably and is a no-op when unchanged', () => {
    const { doc, a } = board();
    const r = insertIntoFrame(doc, 'button', a);
    const out = setElementProps(r.doc, r.id, { label: 'Sign up' });
    expect(out.elements[r.id].props.label).toBe('Sign up');
    expect(r.doc.elements[r.id].props.label).not.toBe('Sign up');
    expect(setElementProps(out, r.id, { label: 'Sign up' })).toBe(out);
  });
  it('knows each type’s inline text prop', () => {
    expect(textPropOf('button')?.key).toBe('label');
    expect(textPropOf('icon')).toBeUndefined();
    expect(textPropOf('sticky')?.multiline).toBe(true);
    const { doc } = board();
    const r = insertAtPoint(doc, 'sticky', { x: 0, y: 2000 });
    expect(Object.values(setElementText(r.doc, r.id, 'Hi').elements[r.id].props)).toContain('Hi');
  });
});

describe('screens', () => {
  it('changes device keeping top-left and fits children', () => {
    let { doc, a } = board();
    doc = setFrameDevice(doc, a, 'desktop');
    expect(doc.frames[a]).toMatchObject({ x: 0, y: 0, w: 1280, h: 800, device: 'desktop' });
    const r = addElement(doc, { type: 'card', parentId: a, x: 900, y: 100, w: 300, h: 100 });
    const back = setFrameDevice(r.doc, a, 'mobile');
    const el = back.elements[r.id];
    expect(el.x + el.w).toBeLessThanOrEqual(375);
    expect(back.frames[a]).toMatchObject({ w: 375, h: 812 });
  });

  it('keeps one start screen per flow and moves the flow name', () => {
    let { doc, a, b } = board();
    doc = { ...doc, frames: { ...doc.frames, [a]: { ...doc.frames[a], isStart: true } } };
    doc = { ...doc, links: { l: { id: 'l', sourceElementId: 'x', targetFrameId: b, trigger: 'click' } } };
    const btn = addElement(doc, { type: 'button', parentId: a, x: 0, y: 100 });
    doc = btn.doc;
    doc = { ...doc, links: { l: { id: 'l', sourceElementId: btn.id, targetFrameId: b, trigger: 'click' } }, flowNames: { [a]: 'Sign up' } };
    const out = setStartScreen(doc, b, true);
    expect(out.frames[b].isStart).toBe(true);
    expect(out.frames[a].isStart).toBeUndefined();
    expect(out.flowNames).toEqual({ [b]: 'Sign up' });
    expect(setStartScreen(out, b, false).frames[b].isStart).toBeUndefined();
  });
});

describe('align / distribute', () => {
  function three() {
    let doc = emptyDoc();
    const ids: string[] = [];
    for (const [x, y, w] of [[0, 0, 100], [150, 40, 50], [400, 10, 100]]) {
      const r = addElement(doc, { type: 'rect', x, y, w, h: 40 });
      doc = r.doc;
      ids.push(r.id);
    }
    return { doc, ids };
  }
  it('aligns edges and centres', () => {
    const { doc, ids } = three();
    expect(ids.map((id) => alignNodes(doc, ids, 'left').elements[id].x)).toEqual([0, 0, 0]);
    expect(ids.map((id) => alignNodes(doc, ids, 'right').elements[id].x)).toEqual([400, 450, 400]);
    expect(ids.map((id) => alignNodes(doc, ids, 'top').elements[id].y)).toEqual([0, 0, 0]);
    expect(ids.map((id) => alignNodes(doc, ids, 'bottom').elements[id].y)).toEqual([40, 40, 40]);
    expect(ids.map((id) => alignNodes(doc, ids, 'center').elements[id].x)).toEqual([200, 225, 200]);
    expect(ids.map((id) => alignNodes(doc, ids, 'middle').elements[id].y)).toEqual([20, 20, 20]);
    expect(alignNodes(doc, ids.slice(0, 1), 'left')).toBe(doc);
  });
  it('distributes with equal gaps', () => {
    const { doc, ids } = three();
    const out = distributeNodes(doc, ids, 'horizontal');
    // span 0..500, widths 250 → gap 125
    expect(ids.map((id) => out.elements[id].x)).toEqual([0, 225, 400]);
    expect(distributeNodes(doc, ids.slice(0, 2), 'vertical')).toBe(doc);
  });
  it('keeps children inside their screen when aligning', () => {
    const { doc, a } = board();
    const r1 = addElement(doc, { type: 'button', parentId: a, x: 10, y: 100, w: 100, h: 40 });
    const r2 = addElement(r1.doc, { type: 'rect', x: 2000, y: 100, w: 100, h: 40 });
    const out = alignNodes(r2.doc, [r1.id, r2.id], 'right');
    expect(out.elements[r1.id].x).toBe(375 - 100);
  });
});
