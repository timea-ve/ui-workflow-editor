import { describe, expect, it } from 'vitest';
import { addElement, createScreen, emptyDoc } from '../flow/ops';
import { nudgeOp, selectAllIds } from './useEditorKeyboard';

function fixture() {
  let doc = emptyDoc();
  const a = createScreen(doc, { device: 'mobile', x: 0, y: 0 }); doc = a.doc;
  const b = createScreen(doc, { device: 'mobile', x: 500, y: 0 }); doc = b.doc;
  const e1 = addElement(doc, { type: 'button', parentId: a.id, x: 10, y: 10 }); doc = e1.doc;
  const e2 = addElement(doc, { type: 'text', parentId: a.id, x: 10, y: 80 }); doc = e2.doc;
  const loose = addElement(doc, { type: 'rect', x: 900, y: 0 }); doc = loose.doc;
  return { doc, a: a.id, b: b.id, e1: e1.id, e2: e2.id, loose: loose.id };
}

describe('selectAllIds', () => {
  it('selects top-level items by default', () => {
    const f = fixture();
    expect(new Set(selectAllIds(f.doc, []))).toEqual(new Set([f.a, f.b, f.loose]));
  });
  it('selects siblings when the selection is inside one screen', () => {
    const f = fixture();
    expect(new Set(selectAllIds(f.doc, [f.e1]))).toEqual(new Set([f.e1, f.e2]));
  });
});

describe('nudgeOp', () => {
  it('moves frames and loose elements, but not children of a moved frame', () => {
    const f = fixture();
    const next = nudgeOp([f.a, f.e1, f.loose], 10, -1)(f.doc);
    expect(next.frames[f.a]).toMatchObject({ x: 10, y: -1 });
    expect(next.elements[f.e1]).toMatchObject({ x: 10, y: 10 });
    expect(next.elements[f.loose]).toMatchObject({ x: 910, y: -1 });
    expect(next.frames[f.b]).toBe(f.doc.frames[f.b]);
  });
});
