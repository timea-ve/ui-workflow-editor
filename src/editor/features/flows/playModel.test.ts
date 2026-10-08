import { describe, expect, it } from 'vitest';
import type { BoardDoc } from '../../../model/types';
import { addConnector, addElement, createScreen, deleteFrame, duplicateAsOption, emptyDoc, linkElementToScreen, renameFrame } from '../../../flow/ops';
import {
  brokenLinks, canGoBack, correspondingFrame, fitScale, flowOrder, hotspots, playBack, playCurrent, playGo, playRestart, playStart,
} from './playModel';
import { getFlowIndex, targetGroup } from './flowIndex';

function board() {
  let doc: BoardDoc = emptyDoc();
  const ids: string[] = [];
  for (const [i, name] of ['Home', 'Details', 'Done'].entries()) {
    const s = createScreen(doc, { device: 'mobile', name, x: i * 500, y: 0 }); doc = s.doc; ids.push(s.id);
  }
  const b1 = addElement(doc, { type: 'button', parentId: ids[0], x: 24, y: 700, w: 327, h: 48 }); doc = b1.doc;
  const b2 = addElement(doc, { type: 'button', parentId: ids[1], x: 24, y: 700, w: 327, h: 48 }); doc = b2.doc;
  const back = addElement(doc, { type: 'text', parentId: ids[1], x: 24, y: 40, w: 100, h: 24 }); doc = back.doc;
  doc = linkElementToScreen(doc, b1.id, ids[1]).doc;
  doc = linkElementToScreen(doc, b2.id, ids[2]).doc;
  doc = linkElementToScreen(doc, back.id, ids[0]).doc;
  return { doc, ids, b1: b1.id, b2: b2.id, back: back.id };
}

describe('play history', () => {
  it('goes, backs and restarts', () => {
    let h = playStart('a');
    expect(canGoBack(h)).toBe(false);
    h = playGo(h, 'b'); h = playGo(h, 'c');
    expect(playCurrent(h)).toBe('c');
    h = playBack(h);
    expect(playCurrent(h)).toBe('b');
    expect(playBack(playBack(h)).stack).toEqual(['a']);
    expect(playRestart(playGo(h, 'c')).stack).toEqual(['a']);
    expect(playGo(h, 'b')).toBe(h);
  });
});

describe('hotspots & order', () => {
  it('only links make hotspots, sorted top-down', () => {
    const { doc, ids, b2, back } = board();
    const shape = addElement(doc, { type: 'rect', x: 2000, y: 0 });
    const withConnector = addConnector(shape.doc, ids[1], shape.id).doc;
    expect(hotspots(withConnector, ids[1]).map((h) => h.elementId)).toEqual([back, b2]);
    expect(hotspots(withConnector, ids[2])).toEqual([]);
  });

  it('orders a flow from its start along links', () => {
    const { doc, ids } = board();
    expect(flowOrder(doc, [...ids].reverse(), ids[0])).toEqual(ids);
  });

  it('reports links to removed screens', () => {
    const { doc, ids, b2 } = board();
    // deleteFrame cascades links; simulate a stale link from a remote edit.
    const stale = { ...doc, frames: { ...doc.frames } };
    delete stale.frames[ids[2]];
    expect(brokenLinks(stale, ids[1])).toEqual([b2]);
    expect(hotspots(deleteFrame(doc, ids[2]), ids[1]).map((h) => h.targetFrameId)).toEqual([ids[0]]);
  });
});

describe('option switching', () => {
  it('maps to the same-named screen in the other option, else by position', () => {
    const { doc, ids } = board();
    const r = duplicateAsOption(doc, ids);
    const idx = getFlowIndex(r.doc);
    const g = idx.groupByFrame.get(ids[0])!;
    expect(g.options.map((o) => o.letter)).toEqual(['A', 'B']);
    const [a, b] = g.options;
    expect(correspondingFrame(r.doc, a, b, ids[1])).toBe(r.idMap[ids[1]]);
    const renamed = renameFrame(r.doc, r.idMap[ids[1]], 'Other');
    const idx2 = getFlowIndex(renamed);
    const [a2, b2] = idx2.groupByFrame.get(ids[0])!.options;
    expect(correspondingFrame(renamed, a2, b2, ids[1])).toBe(r.idMap[ids[1]]);
  });
});

describe('flow index', () => {
  it('groups options under one flow and keeps plain flows separate', () => {
    const { doc, ids } = board();
    const lone = createScreen(doc, { device: 'mobile', name: 'Lone', x: 0, y: 3000 });
    const r = duplicateAsOption(lone.doc, ids);
    const idx = getFlowIndex(r.doc);
    expect(idx.listed).toHaveLength(1);
    expect(idx.groups).toHaveLength(2);
    expect(idx.listed[0]).toMatchObject({ key: r.flowId, name: 'Home flow', hasOptions: true });
    expect(getFlowIndex(r.doc)).toBe(idx);
    expect(targetGroup(r.doc, [lone.id])?.key).toBe(lone.id);
    expect(targetGroup(r.doc, [])?.key).toBe(r.flowId);
  });
});

describe('fitScale', () => {
  it('fits without upscaling', () => {
    expect(fitScale({ w: 375, h: 812 }, { w: 2000, h: 2000 })).toBe(1);
    expect(fitScale({ w: 375, h: 812 }, { w: 1000, h: 470 })).toBeCloseTo(0.5);
  });
});
