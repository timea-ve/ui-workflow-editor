import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { BoardDoc } from '../model/types';
import { addElement, connectNodes as connect, createScreen, emptyDoc, moveNode as move } from '../flow/ops';
import { applyDocDiff, readDoc } from './docSync';
import { BoardStore, createMemoryStore, SEED_ORIGIN } from './boardStore';

const moveNode = (d: BoardDoc, id: string, p: { x: number; y: number }) => move(d, id, p.x, p.y);
const connectNodes = (d: BoardDoc, a: string, b: string) => connect(d, a, b).doc;
/** createScreen/addElement generate ids; rename them to fixed ones for readable tests. */
function withId<K extends 'frames' | 'elements'>(doc: BoardDoc, key: K, from: string, to: string): BoardDoc {
  const { [from]: entity, ...rest } = doc[key] as Record<string, { id: string }>;
  return { ...doc, [key]: { ...rest, [to]: { ...entity, id: to } } };
}
function addFrame(doc: BoardDoc, input: { id: string; name: string; x: number; y: number }) {
  const r = createScreen(doc, { device: 'desktop', name: input.name, x: input.x, y: input.y });
  return withId(r.doc, 'frames', r.id, input.id);
}
function sample() {
  let doc = emptyDoc();
  doc = addFrame(doc, { id: 'f1', name: 'Home', x: 0, y: 0 });
  doc = addFrame(doc, { id: 'f2', name: 'Detail', x: 1600, y: 0 });
  const r = addElement(doc, { type: 'button', parentId: 'f1', x: 20, y: 20, props: { label: 'Go' } });
  return withId(r.doc, 'elements', r.id, 'e1');
}

describe('docSync', () => {
  it('writes only changed entities in one transaction', () => {
    const ydoc = new Y.Doc();
    const doc = sample();
    applyDocDiff(ydoc, readDoc(ydoc), doc, SEED_ORIGIN);
    let transactions = 0;
    ydoc.on('afterTransaction', () => { transactions++; });
    const next = moveNode(doc, 'f2', { x: 1700, y: 10 });
    const stats = applyDocDiff(ydoc, doc, next, 'test');
    expect(stats).toEqual({ set: 1, deleted: 0 });
    expect(transactions).toBe(1);
    expect(readDoc(ydoc).frames.f2.x).toBe(1700);
  });

  it('skips structurally equal entities and handles deletes', () => {
    const ydoc = new Y.Doc();
    const doc = sample();
    applyDocDiff(ydoc, readDoc(ydoc), doc, SEED_ORIGIN);
    const copy: BoardDoc = JSON.parse(JSON.stringify(doc));
    expect(applyDocDiff(ydoc, doc, copy, 'x')).toEqual({ set: 0, deleted: 0 });
    const { e1: _gone, ...rest } = doc.elements;
    expect(applyDocDiff(ydoc, doc, { ...doc, elements: rest }, 'x')).toEqual({ set: 0, deleted: 1 });
    expect(readDoc(ydoc).elements.e1).toBeUndefined();
  });

  it('round-trips through a Yjs update (what IndexedDB stores)', () => {
    const a = new Y.Doc();
    const doc = connectNodes(sample(), 'e1', 'f2');
    applyDocDiff(a, readDoc(a), doc, SEED_ORIGIN);
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(readDoc(b)).toEqual(JSON.parse(JSON.stringify(doc)));
  });

  it('is generic over top-level keys', () => {
    const ydoc = new Y.Doc();
    const doc = { ...sample(), comments: { c1: { id: 'c1', text: 'hi' } } } as unknown as BoardDoc;
    applyDocDiff(ydoc, readDoc(ydoc), doc, SEED_ORIGIN);
    expect((readDoc(ydoc) as unknown as Record<string, Record<string, unknown>>).comments.c1).toEqual({ id: 'c1', text: 'hi' });
  });
});

describe('BoardStore', () => {
  it('keeps unchanged entity references across applies', () => {
    const store = createMemoryStore(sample());
    const before = store.getDoc();
    store.apply((d) => moveNode(d, 'f2', { x: 10, y: 10 }));
    const after = store.getDoc();
    expect(after).not.toBe(before);
    expect(after.frames.f1).toBe(before.frames.f1);
    expect(after.elements).toBe(before.elements);
    expect(after.frames.f2.x).toBe(10);
  });

  it('notifies subscribers and ignores no-op ops', () => {
    const store = createMemoryStore(sample());
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.apply((d) => d)).toBe(false);
    store.apply((d) => moveNode(d, 'f1', { x: 5, y: 5 }));
    expect(calls).toBe(1);
  });

  it('seeding is not undoable; each apply is one undo step', () => {
    const store = createMemoryStore(sample());
    expect(store.canUndo()).toBe(false);
    store.apply((d) => addFrame(d, { id: 'f3', name: 'Three', x: 0, y: 1200 }), { label: 'Add screen' });
    store.apply((d) => moveNode(d, 'f3', { x: 50, y: 1200 }), { label: 'Move' });
    expect(store.undo()).toBe('Move');
    expect(store.getDoc().frames.f3.x).toBe(0);
    expect(store.undo()).toBe('Add screen');
    expect(store.getDoc().frames.f3).toBeUndefined();
    expect(store.undo()).toBeUndefined();
    expect(store.redo()).toBe('Add screen');
    expect(store.getDoc().frames.f3.name).toBe('Three');
  });

  it('a multi-entity op (e.g. multi-move/paste) is one undo step', () => {
    const store = createMemoryStore(sample());
    store.apply((d) => moveNode(moveNode(d, 'f1', { x: 100, y: 0 }), 'f2', { x: 2000, y: 0 }));
    store.undo();
    expect(store.getDoc().frames.f1.x).toBe(0);
    expect(store.getDoc().frames.f2.x).toBe(1600);
    expect(store.canUndo()).toBe(false);
  });

  it('merges consecutive applies with the same mergeKey (nudge)', () => {
    const store = createMemoryStore(sample());
    for (let i = 1; i <= 5; i++) store.apply((d) => moveNode(d, 'f1', { x: i, y: 0 }), { mergeKey: 'nudge:f1', label: 'Nudge' });
    store.apply((d) => moveNode(d, 'f2', { x: 0, y: 900 }), { label: 'Move' });
    store.undo();
    expect(store.getDoc().frames.f1.x).toBe(5);
    store.undo();
    expect(store.getDoc().frames.f1.x).toBe(0);
    expect(store.canUndo()).toBe(false);
  });

  it('different mergeKeys stay separate steps', () => {
    const store = createMemoryStore(sample());
    store.apply((d) => moveNode(d, 'f1', { x: 1, y: 0 }), { mergeKey: 'a' });
    store.apply((d) => moveNode(d, 'f1', { x: 2, y: 0 }), { mergeKey: 'b' });
    store.undo();
    expect(store.getDoc().frames.f1.x).toBe(1);
  });

  it('two stores on one update stream converge (persistence reload)', () => {
    const a = new BoardStore();
    a.seed(sample());
    a.apply((d) => moveNode(d, 'f1', { x: 42, y: 0 }));
    const b = new BoardStore();
    Y.applyUpdate(b.ydoc, Y.encodeStateAsUpdate(a.ydoc));
    expect(b.getDoc().frames.f1.x).toBe(42);
    expect(b.canUndo()).toBe(false);
  });
});
