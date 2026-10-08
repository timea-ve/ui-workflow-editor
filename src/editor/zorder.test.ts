import { describe, expect, it } from 'vitest';
import type { BoardDoc, Frame } from '../model/types';
import { compareZ, emptyDoc } from '../flow/ops';
import { reorder } from './zorder';

const frame = (id: string, z: string): Frame => ({ id, kind: 'frame', name: id, device: 'mobile', x: 0, y: 0, w: 10, h: 10, z });
function board(...fs: Frame[]): BoardDoc {
  return { ...emptyDoc(), frames: Object.fromEntries(fs.map((f) => [f.id, f])) };
}
const order = (d: BoardDoc) => Object.values(d.frames).sort((a, b) => compareZ(a.z, b.z)).map((f) => f.id);

describe('reorder', () => {
  const d = board(frame('a', 'a0'), frame('b', 'a1'), frame('c', 'a2'), frame('d', 'a3'));

  it('brings to front and sends to back, touching only moved entities', () => {
    const front = reorder(d, ['b'], 'front');
    expect(order(front)).toEqual(['a', 'c', 'd', 'b']);
    expect(front.frames.a).toBe(d.frames.a);
    expect(front.frames.c).toBe(d.frames.c);
    expect(order(reorder(d, ['c', 'd'], 'back'))).toEqual(['c', 'd', 'a', 'b']);
  });

  it('moves forward/backward one step', () => {
    expect(order(reorder(d, ['a'], 'forward'))).toEqual(['b', 'a', 'c', 'd']);
    expect(order(reorder(d, ['d'], 'backward'))).toEqual(['a', 'b', 'd', 'c']);
    expect(order(reorder(d, ['a', 'b'], 'forward'))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('is a no-op when already in place', () => {
    expect(reorder(d, ['d'], 'front')).toBe(d);
    expect(reorder(d, ['a'], 'backward')).toBe(d);
  });

  it('orders elements within their own frame only', () => {
    const doc: BoardDoc = {
      ...board(frame('f', 'a0'), frame('g', 'a1')),
      elements: {
        e1: { id: 'e1', type: 'button', parentId: 'f', x: 0, y: 0, w: 1, h: 1, z: 'a2', props: {} },
        e2: { id: 'e2', type: 'button', parentId: 'f', x: 0, y: 0, w: 1, h: 1, z: 'a3', props: {} },
        e3: { id: 'e3', type: 'button', parentId: 'g', x: 0, y: 0, w: 1, h: 1, z: 'a4', props: {} },
      },
    };
    const next = reorder(doc, ['e1'], 'front');
    expect(compareZ(next.elements.e1.z, next.elements.e2.z)).toBe(1);
    expect(next.elements.e3).toBe(doc.elements.e3);
    expect(next.frames).toBe(doc.frames);
  });

  it('renumbers legacy keys that are not valid fractional indexes', () => {
    const legacy = board(frame('a', 'z00000001'), frame('b', 'z00000002'));
    expect(order(reorder(legacy, ['a'], 'front'))).toEqual(['b', 'a']);
  });
});
