import { describe, expect, it } from 'vitest';
import type { BoardDoc } from '../model/types';
import { addConnector, addElement, compareZ, connectNodes, createScreen, emptyDoc } from '../flow/ops';
import { copySelection, duplicateSelection, parseClipboard, pastePayload, serializeClipboard } from './clipboard';

function board() {
  let doc: BoardDoc = emptyDoc();
  const a = createScreen(doc, { device: 'mobile', x: 0, y: 0 }); doc = a.doc;
  const b = createScreen(doc, { device: 'mobile', x: 600, y: 0 }); doc = b.doc;
  const btn = addElement(doc, { type: 'button', parentId: a.id, x: 20, y: 40 }); doc = btn.doc;
  const link = connectNodes(doc, btn.id, b.id); doc = link.doc;
  const note = addElement(doc, { type: 'sticky', x: 2000, y: 100 }); doc = note.doc;
  return { doc, a: a.id, b: b.id, btn: btn.id, note: note.id, linkId: link.linkId! };
}

describe('clipboard', () => {
  it('round-trips through text with a FlowSketch marker', () => {
    const { doc, a } = board();
    const p = copySelection(doc, [a])!;
    expect(parseClipboard(serializeClipboard(p))).toEqual(p);
    expect(parseClipboard('hello')).toBeUndefined();
    expect(parseClipboard('{"marker":"flowsketch/v1"')).toBeUndefined();
  });

  it('copies frames with children and internal links, remapping every id', () => {
    const { doc, a, b, btn } = board();
    const p = copySelection(doc, [a, b])!;
    expect(p.frames).toHaveLength(2);
    expect(p.elements.map((e) => e.id)).toEqual([btn]);
    expect(p.links).toHaveLength(1);
    expect(p.connectors).toHaveLength(1);
    const { doc: next, ids } = pastePayload(doc, p);
    expect(ids).toHaveLength(2);
    expect(Object.keys(next.frames)).toHaveLength(4);
    const [na, nb] = ids;
    expect(next.frames[na].x).toBe(24);
    expect(next.frames[nb].x).toBe(624);
    const child = Object.values(next.elements).find((e) => e.parentId === na)!;
    expect(child.x).toBe(20); // relative to its (new) frame
    const link = Object.values(next.links).find((l) => l.sourceElementId === child.id)!;
    expect(link.targetFrameId).toBe(nb);
    expect(next.connectors[link.connectorId!].from.nodeId).toBe(child.id);
    expect(next.frames[na].isStart).toBeUndefined();
  });

  it('drops links whose target was not copied', () => {
    const { doc, a } = board();
    const p = copySelection(doc, [a])!;
    expect(p.links).toHaveLength(0);
    expect(p.connectors).toHaveLength(0);
    const { doc: next } = pastePayload(doc, p);
    expect(Object.keys(next.links)).toHaveLength(1);
  });

  it('keeps plain connectors between copied nodes', () => {
    const base = board();
    const c = addConnector(base.doc, base.a, base.note);
    const { doc: next } = pastePayload(c.doc, copySelection(c.doc, [base.a, base.note])!);
    expect(Object.keys(next.connectors)).toHaveLength(3);
  });

  it('pastes above everything else, preserving relative order', () => {
    const { doc, a, note } = board();
    const { doc: next, ids } = pastePayload(doc, copySelection(doc, [a, note])!);
    const maxOld = [...Object.values(doc.frames), ...Object.values(doc.elements)].map((e) => e.z).sort(compareZ).at(-1)!;
    for (const id of ids) expect(compareZ((next.frames[id] ?? next.elements[id]).z, maxOld)).toBe(1);
  });

  it('pastes at a point (centre of the group lands there)', () => {
    const { doc, note } = board();
    const { doc: next, ids } = pastePayload(doc, copySelection(doc, [note])!, { at: { x: 0, y: 0 } });
    const e = next.elements[ids[0]];
    expect(e.x + e.w / 2).toBeCloseTo(0, 0);
    expect(e.y + e.h / 2).toBeCloseTo(0, 0);
  });

  it('pastes a lone element into a target frame, clamped inside', () => {
    const { doc, btn, b } = board();
    const { doc: next, ids } = pastePayload(doc, copySelection(doc, [btn])!, { targetFrameId: b });
    const e = next.elements[ids[0]];
    expect(e.parentId).toBe(b);
    expect(e.x).toBe(44);
    expect(e.y).toBe(64);
  });

  it('duplicate = copy + paste with offset', () => {
    const { doc, note } = board();
    const { doc: next, ids } = duplicateSelection(doc, [note]);
    expect(next.elements[ids[0]].x).toBe(doc.elements[note].x + 24);
    expect(ids[0]).not.toBe(note);
  });
});
