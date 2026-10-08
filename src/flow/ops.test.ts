import { describe, expect, it } from 'vitest';
import type { BoardDoc } from '../model/types';
import {
  addConnector, addElement, connectNodes, createScreen, deleteConnector, deleteElement, deleteFrame, deleteNodes,
  detectFlows, duplicateAsOption, emptyDoc, flowForNode, getLinksFromFrame, getStartFrame, LANE_GAP,
  linkElementToScreen, linkToNewScreen, moveNode, SCREEN_GAP, variantsInFlow,
} from './ops';
import { buildSandboxBoard, buildSignupFlow } from './seed';
import { docToEdges, docToNodes, resolveAnchors } from './adapter';

const deepFreeze = <T,>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

/** Every id referenced anywhere must exist. */
function expectConsistent(doc: BoardDoc) {
  for (const e of Object.values(doc.elements)) if (e.parentId) expect(doc.frames[e.parentId], `parent of ${e.id}`).toBeDefined();
  const node = (id: string) => doc.frames[id] ?? doc.elements[id];
  for (const c of Object.values(doc.connectors)) {
    expect(node(c.from.nodeId)).toBeDefined();
    expect(node(c.to.nodeId)).toBeDefined();
  }
  for (const l of Object.values(doc.links)) {
    expect(doc.elements[l.sourceElementId]).toBeDefined();
    expect(doc.frames[l.targetFrameId]).toBeDefined();
    if (l.connectorId) expect(doc.connectors[l.connectorId]).toBeDefined();
  }
  for (const f of Object.values(doc.frames)) if (f.variantId) expect(doc.variants[f.variantId]).toBeDefined();
}

describe('createScreen / addElement', () => {
  it('creates a device-sized frame without mutating the input', () => {
    const doc = deepFreeze(emptyDoc());
    const { doc: next, id } = createScreen(doc, { device: 'mobile', name: 'Home', x: 10, y: 20 });
    expect(next.frames[id]).toMatchObject({ kind: 'frame', name: 'Home', device: 'mobile', x: 10, y: 20, w: 375, h: 812 });
    expect(Object.keys(doc.frames)).toHaveLength(0);
  });

  it('names screens by default and gives increasing z', () => {
    let doc = emptyDoc();
    const a = createScreen(doc, { device: 'desktop', x: 0, y: 0 }); doc = a.doc;
    const b = createScreen(doc, { device: 'tablet', x: 0, y: 0 }); doc = b.doc;
    expect(doc.frames[a.id].name).toBe('Screen 1');
    expect(doc.frames[b.id].name).toBe('Screen 2');
    expect(doc.frames[b.id].z > doc.frames[a.id].z).toBe(true);
  });

  it('adds elements with registry defaults, merged props, and parent', () => {
    let doc = emptyDoc();
    const s = createScreen(doc, { device: 'mobile', x: 0, y: 0 }); doc = s.doc;
    const e = addElement(doc, { type: 'button', parentId: s.id, x: 8, y: 8, props: { label: 'Go' } });
    expect(e.doc.elements[e.id]).toMatchObject({ type: 'button', parentId: s.id, w: 140, h: 40, props: { label: 'Go', variant: 'primary' } });
    const shape = addElement(e.doc, { type: 'diamond', x: 0, y: 0 });
    expect(shape.doc.elements[shape.id].parentId).toBeUndefined();
    expect(shape.doc.elements[shape.id].w).toBe(140);
  });

  it('rejects an unknown parent', () => {
    expect(() => addElement(emptyDoc(), { type: 'button', parentId: 'nope', x: 0, y: 0 })).toThrow();
  });
});

describe('links', () => {
  it('linkElementToScreen creates a link backed by a step connector element → frame', () => {
    const { doc, getStarted, screens } = buildSignupFlow();
    const link = Object.values(doc.links).find((l) => l.sourceElementId === getStarted)!;
    expect(link.targetFrameId).toBe(screens.signup);
    const c = doc.connectors[link.connectorId!];
    expect(c).toMatchObject({ from: { nodeId: getStarted }, to: { nodeId: screens.signup }, style: 'step', arrowheads: 'end' });
  });

  it('relinking an element replaces its previous link and connector', () => {
    const { doc, getStarted, screens } = buildSignupFlow();
    const before = Object.keys(doc.connectors).length;
    const r = linkElementToScreen(deepFreeze(doc), getStarted, screens.success);
    const fromButton = Object.values(r.doc.links).filter((l) => l.sourceElementId === getStarted);
    expect(fromButton).toHaveLength(1);
    expect(fromButton[0].targetFrameId).toBe(screens.success);
    expect(Object.keys(r.doc.connectors)).toHaveLength(before);
    expectConsistent(r.doc);
  });

  it('linkToNewScreen places the new screen 120px right of the source screen, same y and device', () => {
    let doc = emptyDoc();
    const s = createScreen(doc, { device: 'tablet', x: 100, y: 50 }); doc = s.doc;
    const b = addElement(doc, { type: 'button', parentId: s.id, x: 10, y: 10 }); doc = b.doc;
    const r = linkToNewScreen(doc, b.id, { name: 'Next' });
    const f = r.doc.frames[r.frameId];
    expect(f).toMatchObject({ x: 100 + 768 + SCREEN_GAP, y: 50, device: 'tablet', name: 'Next' });
    expect(r.doc.links[r.linkId]).toMatchObject({ sourceElementId: b.id, targetFrameId: r.frameId });
    expect(r.doc.connectors[r.connectorId]).toBeDefined();
  });

  it('linkToNewScreen skips an occupied slot', () => {
    const { doc, createAccount, screens } = buildSignupFlow();
    // The slot right of "Sign up" is taken by "Success" → goes one further.
    const r = linkToNewScreen(doc, createAccount);
    const success = doc.frames[screens.success];
    expect(r.doc.frames[r.frameId].x).toBe(success.x + success.w + SCREEN_GAP);
  });

  it('getLinksFromFrame returns links whose source sits inside the frame', () => {
    const { doc, screens, getStarted } = buildSignupFlow();
    expect(getLinksFromFrame(doc, screens.welcome).map((l) => l.sourceElementId)).toEqual([getStarted]);
    expect(getLinksFromFrame(doc, screens.success)).toEqual([]);
  });

  it('connectNodes makes a link for element-in-screen → screen, else a plain connector', () => {
    let doc = emptyDoc();
    const a = createScreen(doc, { device: 'mobile', x: 0, y: 0 }); doc = a.doc;
    const b = createScreen(doc, { device: 'mobile', x: 500, y: 0 }); doc = b.doc;
    const btn = addElement(doc, { type: 'button', parentId: a.id, x: 0, y: 0 }); doc = btn.doc;
    const rect = addElement(doc, { type: 'rect', x: 0, y: -200 }); doc = rect.doc;
    const asLink = connectNodes(doc, btn.id, b.id);
    expect(asLink.linkId).toBeDefined();
    const plain = connectNodes(doc, rect.id, b.id, { fromAnchor: 'bottom' });
    expect(plain.linkId).toBeUndefined();
    expect(plain.doc.connectors[plain.connectorId].from.anchor).toBe('bottom');
    const frameToFrame = connectNodes(doc, a.id, b.id);
    expect(frameToFrame.linkId).toBeUndefined();
    // Non-linkable diagram shape inside a screen stays a connector.
    const inner = addElement(doc, { type: 'sticky', parentId: a.id, x: 0, y: 0 });
    expect(connectNodes(inner.doc, inner.id, b.id).linkId).toBeUndefined();
    expect(() => connectNodes(doc, a.id, a.id)).toThrow();
  });
});

describe('cascading deletes', () => {
  it('deleteFrame removes children, links in/out, and every connector touching them', () => {
    const { doc, screens } = buildSignupFlow();
    let d = addConnector(doc, screens.welcome, screens.signup, { label: 'plain' }).doc;
    d = deepFreeze(d);
    const next = deleteFrame(d, screens.signup);
    expect(next.frames[screens.signup]).toBeUndefined();
    expect(Object.values(next.elements).some((e) => e.parentId === screens.signup)).toBe(false);
    // Get started → Sign up (incoming) and Create account → Success (outgoing) both gone.
    expect(Object.keys(next.links)).toHaveLength(0);
    expect(Object.keys(next.connectors)).toHaveLength(0);
    expectConsistent(next);
    // Untouched screens survive.
    expect(next.frames[screens.welcome]).toBeDefined();
    expect(next.frames[screens.success]).toBeDefined();
  });

  it('deleteElement removes its link and connector but keeps other links', () => {
    const { doc, getStarted } = buildSignupFlow();
    const next = deleteElement(doc, getStarted);
    expect(next.elements[getStarted]).toBeUndefined();
    expect(Object.values(next.links)).toHaveLength(1);
    expect(Object.values(next.connectors)).toHaveLength(1);
    expectConsistent(next);
  });

  it('deleteConnector also removes the link it backs', () => {
    const { doc, getStarted } = buildSignupFlow();
    const link = Object.values(doc.links).find((l) => l.sourceElementId === getStarted)!;
    const next = deleteConnector(doc, link.connectorId!);
    expect(next.links[link.id]).toBeUndefined();
    expectConsistent(next);
  });

  it('deleting every screen of an option removes the option group', () => {
    const board = buildSandboxBoard();
    const b = Object.values(board.variants).find((v) => v.label === 'Option B')!;
    const ids = Object.values(board.frames).filter((f) => f.variantId === b.id).map((f) => f.id);
    const next = deleteNodes(board, ids);
    expect(next.variants[b.id]).toBeUndefined();
    expect(Object.values(next.variants).map((v) => v.label)).toEqual(['Option A']);
    expectConsistent(next);
  });

  it('deleting unknown ids is a no-op', () => {
    const doc = emptyDoc();
    expect(deleteFrame(doc, 'x')).toBe(doc);
    expect(deleteElement(doc, 'x')).toBe(doc);
    expect(deleteNodes(doc, ['x'])).toBe(doc);
  });
});

describe('detectFlows / getStartFrame', () => {
  it('groups linked screens and finds the start (no incoming links)', () => {
    const { doc, screens } = buildSignupFlow();
    const flows = detectFlows(doc);
    expect(flows).toHaveLength(1);
    expect(new Set(flows[0].frameIds)).toEqual(new Set(Object.values(screens)));
    expect(flows[0].startFrameId).toBe(screens.welcome);
    expect(flows[0].name).toBe('Welcome flow');
  });

  it('separates unconnected groups and skips lone screens unless asked', () => {
    let { doc } = buildSignupFlow();
    const lone = createScreen(doc, { device: 'desktop', x: 0, y: 3000 }); doc = lone.doc;
    expect(detectFlows(doc)).toHaveLength(1);
    expect(detectFlows(doc, { includeSingles: true })).toHaveLength(2);
    expect(flowForNode(doc, lone.id)?.frameIds).toEqual([lone.id]);
  });

  it('screen-to-screen connectors also join flows (and diagram shapes do not)', () => {
    let doc = emptyDoc();
    const a = createScreen(doc, { device: 'mobile', x: 0, y: 0 }); doc = a.doc;
    const b = createScreen(doc, { device: 'mobile', x: 500, y: 0 }); doc = b.doc;
    const c = createScreen(doc, { device: 'mobile', x: 1000, y: 0 }); doc = c.doc;
    const shape = addElement(doc, { type: 'diamond', x: 0, y: -300 }); doc = shape.doc;
    doc = addConnector(doc, a.id, b.id).doc;
    doc = addConnector(doc, b.id, shape.id).doc;
    doc = addConnector(doc, shape.id, c.id).doc;
    const flows = detectFlows(doc);
    expect(flows).toHaveLength(1);
    expect(flows[0].frameIds).toEqual([a.id, b.id]);
  });

  it('isStart overrides the detected start', () => {
    const { doc, screens } = buildSignupFlow();
    const d = { ...doc, frames: { ...doc.frames, [screens.signup]: { ...doc.frames[screens.signup], isStart: true } } };
    expect(getStartFrame(d, Object.values(screens))).toBe(screens.signup);
  });

  it('a cycle falls back to the left-most screen; empty input gives undefined', () => {
    const { doc, screens } = buildSignupFlow();
    const successBtn = Object.values(doc.elements).find((e) => e.parentId === screens.success && e.type === 'button')!;
    const cyc = linkElementToScreen(doc, successBtn.id, screens.welcome).doc;
    expect(getStartFrame(cyc, Object.values(screens))).toBe(screens.welcome);
    expect(getStartFrame(cyc, [])).toBeUndefined();
  });

  it('flowForNode resolves an element to its screen’s flow; canvas shapes have none', () => {
    const { doc, getStarted, screens } = buildSignupFlow();
    expect(flowForNode(doc, getStarted)?.startFrameId).toBe(screens.welcome);
    const shape = addElement(doc, { type: 'rect', x: 0, y: 0 });
    expect(flowForNode(shape.doc, shape.id)).toBeUndefined();
  });
});

describe('duplicateAsOption', () => {
  const setup = () => {
    const demo = buildSignupFlow();
    const frameIds = Object.values(demo.screens);
    return { ...demo, frameIds, result: duplicateAsOption(deepFreeze(demo.doc), frameIds) };
  };

  it('deep-copies screens and children with fresh ids', () => {
    const { doc, frameIds, result } = setup();
    const next = result.doc;
    expect(result.frameIds).toHaveLength(3);
    for (const id of result.frameIds) expect(frameIds).not.toContain(id);
    expect(Object.keys(next.frames)).toHaveLength(6);
    expect(Object.keys(next.elements)).toHaveLength(Object.keys(doc.elements).length * 2);
    for (const [oldId, newId] of Object.entries(result.idMap)) {
      if (doc.elements[oldId]) {
        const copy = next.elements[newId];
        expect(copy.type).toBe(doc.elements[oldId].type);
        expect(copy.props).toEqual(doc.elements[oldId].props);
        expect(copy.props).not.toBe(doc.elements[oldId].props);
        expect(copy.parentId).toBe(result.idMap[doc.elements[oldId].parentId!]);
        expect(copy.x).toBe(doc.elements[oldId].x); // relative to the copied screen
      }
    }
    expectConsistent(next);
  });

  it('remaps links and their connectors to the copied screens', () => {
    const { doc, getStarted, screens, result } = setup();
    const next = result.doc;
    expect(Object.keys(next.links)).toHaveLength(4);
    const copiedLink = Object.values(next.links).find((l) => l.sourceElementId === result.idMap[getStarted])!;
    expect(copiedLink.targetFrameId).toBe(result.idMap[screens.signup]);
    const c = next.connectors[copiedLink.connectorId!];
    expect(c.from.nodeId).toBe(result.idMap[getStarted]);
    expect(c.to.nodeId).toBe(result.idMap[screens.signup]);
    expect(c.variantId).toBe(result.variantId);
    // Originals untouched (apart from variant tagging).
    const orig = Object.values(next.links).find((l) => l.sourceElementId === getStarted)!;
    expect(orig.targetFrameId).toBe(screens.signup);
    expect(Object.keys(doc.links)).toHaveLength(2);
  });

  it('places the copy below the original with a lane gap, same columns', () => {
    const { doc, frameIds, result } = setup();
    const bottom = Math.max(...frameIds.map((id) => doc.frames[id].y + doc.frames[id].h));
    for (const id of frameIds) {
      const copy = result.doc.frames[result.idMap[id]];
      expect(copy.x).toBe(doc.frames[id].x);
      expect(copy.y).toBe(doc.frames[id].y + (bottom + LANE_GAP - 0));
    }
  });

  it('labels Option A / Option B sharing a flowId', () => {
    const { frameIds, result } = setup();
    const next = result.doc;
    const a = next.variants[result.originalVariantId];
    const b = next.variants[result.variantId];
    expect(a.label).toBe('Option A');
    expect(b).toMatchObject({ label: 'Option B', flowId: a.flowId, duplicatedFromId: a.id });
    expect(b.order > a.order).toBe(true);
    for (const id of frameIds) expect(next.frames[id].variantId).toBe(a.id);
    for (const id of result.frameIds) expect(next.frames[id].variantId).toBe(b.id);
  });

  it('duplicating again adds Option C below all existing lanes', () => {
    const { frameIds, result } = setup();
    const again = duplicateAsOption(result.doc, frameIds);
    const labels = variantsInFlow(again.doc, result.flowId).map((v) => v.label);
    expect(labels).toEqual(['Option A', 'Option B', 'Option C']);
    const bBottom = Math.max(...result.frameIds.map((id) => result.doc.frames[id].y + result.doc.frames[id].h));
    const cTop = Math.min(...again.frameIds.map((id) => again.doc.frames[id].y));
    expect(cTop).toBe(bBottom + LANE_GAP);
    // Duplicating option B also yields a new letter in the same flow.
    const fromB = duplicateAsOption(again.doc, result.frameIds);
    expect(fromB.doc.variants[fromB.variantId].label).toBe('Option D');
    expect(fromB.flowId).toBe(result.flowId);
  });

  it('copies only internal links; links leaving the selection are dropped in the copy', () => {
    const { doc, screens, getStarted } = buildSignupFlow();
    const r = duplicateAsOption(doc, [screens.welcome]);
    expect(Object.keys(r.doc.links)).toHaveLength(2);
    expect(r.doc.elements[r.idMap[getStarted]]).toBeDefined();
    expectConsistent(r.doc);
  });

  it('copied flow is detected as its own flow with a remapped start', () => {
    const { screens, result } = setup();
    const flows = detectFlows(result.doc);
    expect(flows).toHaveLength(2);
    expect(flows.map((f) => f.startFrameId)).toEqual([screens.welcome, result.idMap[screens.welcome]]);
    expect(flows[1].variantId).toBe(result.variantId);
  });

  it('throws when no screens are given', () => {
    expect(() => duplicateAsOption(emptyDoc(), ['missing'])).toThrow();
  });
});

describe('moveNode', () => {
  it('moves frames and elements immutably; no-op returns the same doc', () => {
    const { doc, screens, getStarted } = buildSignupFlow();
    const moved = moveNode(doc, screens.welcome, 5, 6);
    expect(moved.frames[screens.welcome]).toMatchObject({ x: 5, y: 6 });
    expect(doc.frames[screens.welcome].x).toBe(0);
    expect(moveNode(moved, screens.welcome, 5, 6)).toBe(moved);
    expect(moveNode(doc, getStarted, 1, 2).elements[getStarted]).toMatchObject({ x: 1, y: 2 });
    expect(moveNode(doc, 'nope', 1, 2)).toBe(doc);
  });
});

describe('React Flow adapter', () => {
  it('maps frames, elements (children with parentId + extent), lanes and connectors', () => {
    const board = buildSandboxBoard();
    const nodes = docToNodes(board);
    const edges = docToEdges(board);
    expect(nodes.filter((n) => n.type === 'screen')).toHaveLength(6);
    expect(nodes.filter((n) => n.type === 'lane')).toHaveLength(2);
    const kit = nodes.filter((n) => n.type === 'kit');
    expect(kit).toHaveLength(Object.keys(board.elements).length);
    const child = kit.find((n) => n.parentId);
    expect(child?.extent).toBe('parent');
    // Parents precede children.
    const index = new Map(nodes.map((n, i) => [n.id, i]));
    for (const n of kit) if (n.parentId) expect(index.get(n.parentId)!).toBeLessThan(index.get(n.id)!);
    expect(edges).toHaveLength(Object.keys(board.connectors).length);
    expect(edges.every((e) => e.type === 'sketch' && e.sourceHandle && e.targetHandle)).toBe(true);
    expect(edges.filter((e) => e.data?.isLink)).toHaveLength(4);
    const sources = kit.filter((n) => n.type === 'kit' && n.data.isLinkSource);
    expect(sources).toHaveLength(4);
  });

  it('resolves auto anchors by relative position and respects explicit ones', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    expect(resolveAnchors(a, { x: 300, y: 0, w: 100, h: 100 })).toEqual(['right', 'left']);
    expect(resolveAnchors(a, { x: -300, y: 0, w: 100, h: 100 })).toEqual(['left', 'right']);
    expect(resolveAnchors(a, { x: 0, y: 300, w: 100, h: 100 })).toEqual(['bottom', 'top']);
    expect(resolveAnchors(a, { x: 0, y: -300, w: 100, h: 100 })).toEqual(['top', 'bottom']);
    expect(resolveAnchors(a, { x: 300, y: 0, w: 100, h: 100 }, 'top', 'auto')).toEqual(['top', 'left']);
  });
});

describe('sandbox board', () => {
  it('has a linked 3-screen flow, diagram shapes, and an Option B lane', () => {
    const board = buildSandboxBoard();
    expectConsistent(board);
    expect(Object.values(board.variants).map((v) => v.label).sort()).toEqual(['Option A', 'Option B']);
    const types = Object.values(board.elements).filter((e) => !e.parentId).map((e) => e.type).sort();
    expect(types).toEqual(['diamond', 'ellipse', 'sticky']);
    expect(detectFlows(board)).toHaveLength(2);
  });
});
