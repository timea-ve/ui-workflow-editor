import { describe, expect, it } from 'vitest';
import type { BoardDoc } from '../model/types';
import {
  addConnector, addElement, canLinkElement, createScreen, deleteOption, duplicateAsOption, duplicateFlowAsOption,
  emptyDoc, framesInVariant, linkElementToScreen, linkOf, renameFlow, retargetLink, unlinkElement,
  updateConnectorLabel, updateConnectorStyle, variantsInFlow,
} from './ops';
import { escapeAnchors, reconcileEdges, resolveConnectorAnchors } from './adapter';
import { buildSignup } from '../platform/templates/signup';

function threeScreens() {
  let doc: BoardDoc = emptyDoc();
  const a = createScreen(doc, { device: 'mobile', name: 'One', x: 0, y: 0 }); doc = a.doc;
  const b = createScreen(doc, { device: 'mobile', name: 'Two', x: 500, y: 0 }); doc = b.doc;
  const c = createScreen(doc, { device: 'mobile', name: 'Three', x: 1000, y: 0 }); doc = c.doc;
  const btn = addElement(doc, { type: 'button', parentId: a.id, x: 24, y: 700, w: 327, h: 48 }); doc = btn.doc;
  const btn2 = addElement(doc, { type: 'button', parentId: b.id, x: 24, y: 700, w: 327, h: 48 }); doc = btn2.doc;
  doc = linkElementToScreen(doc, btn.id, b.id).doc;
  doc = linkElementToScreen(doc, btn2.id, c.id).doc;
  return { doc, a: a.id, b: b.id, c: c.id, btn: btn.id, btn2: btn2.id };
}

describe('renameFlow', () => {
  it('stores and clears a user flow name', () => {
    const { doc, a } = threeScreens();
    const named = renameFlow(doc, a, '  Checkout ');
    expect(named.flowNames[a]).toBe('Checkout');
    expect(renameFlow(named, a, 'Checkout')).toBe(named);
    const cleared = renameFlow(named, a, '');
    expect(cleared.flowNames[a]).toBeUndefined();
    expect(doc.flowNames[a]).toBeUndefined();
  });
});

describe('duplicateFlowAsOption / deleteOption', () => {
  it('moves a custom flow name to the option set', () => {
    const { doc, a, b, c } = threeScreens();
    const r = duplicateFlowAsOption(renameFlow(doc, a, 'Sign-up'), [a, b, c]);
    expect(r.doc.flowNames[r.flowId]).toBe('Sign-up');
    expect(r.doc.flowNames[a]).toBeUndefined();
  });

  it('deletes an option with its screens, keeping the rest; one left dissolves the set', () => {
    const { doc, a, b, c } = threeScreens();
    const r1 = duplicateFlowAsOption(renameFlow(doc, a, 'Sign-up'), [a, b, c]);
    const r2 = duplicateAsOption(r1.doc, r1.frameIds);
    expect(variantsInFlow(r2.doc, r1.flowId).map((v) => v.label)).toEqual(['Option A', 'Option B', 'Option C']);

    const noB = deleteOption(r2.doc, r1.variantId);
    expect(noB.variants[r1.variantId]).toBeUndefined();
    expect(r1.frameIds.every((id) => !noB.frames[id])).toBe(true);
    expect(variantsInFlow(noB, r1.flowId)).toHaveLength(2);
    expect(Object.keys(noB.frames)).toHaveLength(6);

    const onlyC = deleteOption(noB, r1.originalVariantId);
    expect(Object.keys(onlyC.variants)).toHaveLength(0);
    expect(Object.keys(onlyC.frames)).toHaveLength(3);
    expect(Object.values(onlyC.frames).every((f) => !f.variantId)).toBe(true);
    expect(Object.values(onlyC.elements).every((e) => !e.variantId)).toBe(true);
    expect(Object.values(onlyC.connectors).every((x) => !x.variantId)).toBe(true);
    // Custom name follows the remaining screens' start.
    expect(onlyC.flowNames[r2.frameIds[0]]).toBe('Sign-up');
    expect(onlyC.flowNames[r1.flowId]).toBeUndefined();
    // links still consistent
    for (const l of Object.values(onlyC.links)) {
      expect(onlyC.elements[l.sourceElementId]).toBeDefined();
      expect(onlyC.frames[l.targetFrameId]).toBeDefined();
    }
  });

  it('is a no-op for an unknown option', () => {
    const { doc } = threeScreens();
    expect(deleteOption(doc, 'nope')).toBe(doc);
  });

  it('keeps every frame of the remaining options', () => {
    const { doc, a, b, c } = threeScreens();
    const r = duplicateAsOption(doc, [a, b, c]);
    const left = deleteOption(r.doc, r.originalVariantId);
    expect(framesInVariant(left, r.variantId)).toHaveLength(0);
    expect(Object.keys(left.frames).sort()).toEqual([...r.frameIds].sort());
  });
});

describe('link retarget / unlink', () => {
  it('retargets keeping the arrow label and style', () => {
    const { doc, btn, b, c } = threeScreens();
    const link = linkOf(doc, btn)!;
    expect(link.targetFrameId).toBe(b);
    let d = updateConnectorLabel(doc, link.connectorId!, 'Next');
    d = updateConnectorStyle(d, link.connectorId!, { style: 'curved' });
    const moved = retargetLink(d, btn, c);
    const l2 = linkOf(moved, btn)!;
    expect(l2.id).toBe(link.id);
    expect(l2.targetFrameId).toBe(c);
    expect(moved.connectors[l2.connectorId!]).toMatchObject({ label: 'Next', style: 'curved', to: { nodeId: c } });
    expect(retargetLink(moved, btn, c)).toBe(moved);
  });

  it('creates a link when there is none, and unlinks', () => {
    const { doc, btn, c } = threeScreens();
    const un = unlinkElement(doc, btn);
    expect(linkOf(un, btn)).toBeUndefined();
    expect(Object.keys(un.connectors)).toHaveLength(1);
    const re = retargetLink(un, btn, c);
    expect(linkOf(re, btn)?.targetFrameId).toBe(c);
  });
});

describe('canLinkElement', () => {
  it('allows components in screens, rejects screens, diagram shapes and tables', () => {
    const t = threeScreens();
    let doc = t.doc;
    const text = addElement(doc, { type: 'text', parentId: t.a, x: 24, y: 100 }); doc = text.doc;
    const table = addElement(doc, { type: 'table', parentId: t.a, x: 24, y: 200 }); doc = table.doc;
    const shape = addElement(doc, { type: 'rect', x: 2000, y: 0 }); doc = shape.doc;
    expect(canLinkElement(doc, t.btn)).toEqual({ ok: true, frameId: t.a });
    expect(canLinkElement(doc, text.id).ok).toBe(true);
    expect(canLinkElement(doc, table.id).ok).toBe(false);
    expect(canLinkElement(doc, shape.id)).toMatchObject({ ok: false, reason: expect.stringMatching(/Diagram shapes/) });
    expect(canLinkElement(doc, t.a).ok).toBe(false);
  });
});

describe('updateConnectorStyle', () => {
  it('changes routing and arrowheads, no-op when equal', () => {
    let doc: BoardDoc = emptyDoc();
    const a = createScreen(doc, { device: 'mobile', x: 0, y: 0 }); doc = a.doc;
    const b = createScreen(doc, { device: 'mobile', x: 500, y: 0 }); doc = b.doc;
    const c = addConnector(doc, a.id, b.id); doc = c.doc;
    const s = updateConnectorStyle(doc, c.id, { style: 'straight', arrowheads: 'both' });
    expect(s.connectors[c.id]).toMatchObject({ style: 'straight', arrowheads: 'both' });
    expect(updateConnectorStyle(s, c.id, { style: 'straight' })).toBe(s);
  });
});

describe('routing anchors', () => {
  const frame = { x: 990, y: 1012, w: 375, h: 812 };
  const btn = { x: 1014, y: 1752, w: 327, h: 48 };
  const signup = { x: 495, y: 0, w: 375, h: 812 };

  it('leaves a bottom button through the nearest edge facing the target', () => {
    expect(escapeAnchors(btn, frame, signup)).toEqual(['left', 'right']);
  });

  it('exits right towards a screen on the right', () => {
    const f = { x: 0, y: 0, w: 375, h: 812 };
    expect(escapeAnchors({ x: 24, y: 656, w: 327, h: 48 }, f, { x: 495, y: 0, w: 375, h: 812 })).toEqual(['right', 'left']);
  });

  it('does not double back across its own screen for a small button near the left edge', () => {
    const f = { x: 0, y: 0, w: 375, h: 812 };
    expect(escapeAnchors({ x: 24, y: 72, w: 120, h: 40 }, f, { x: 495, y: 0, w: 375, h: 812 })).toEqual(['right', 'left']);
  });

  it('respects explicit anchors and leaves screen-to-screen connectors alone', () => {
    const doc = buildSignup();
    for (const c of Object.values(doc.connectors)) {
      const r = resolveConnectorAnchors(doc, c)!;
      if (c.from.anchor !== 'auto') expect(r[0]).toBe(c.from.anchor);
      if (c.to.anchor !== 'auto') expect(r[1]).toBe(c.to.anchor);
    }
  });

  it('routes the Sign-up "Try again" link out of the side of its own screen', () => {
    const doc = buildSignup();
    const retry = Object.values(doc.elements).find((e) => e.props.label === 'Try again')!;
    const link = Object.values(doc.links).find((l) => l.sourceElementId === retry.id)!;
    const edge = reconcileEdges(doc).find((e) => e.id === link.connectorId)!;
    expect(edge.sourceHandle).toBe('left');
    // After leaving its screen the line stays left of it (never runs back across the screen).
    const frame = doc.frames[retry.parentId!];
    const pts = edge.data!.route!.points;
    expect(pts[0][0]).toBeGreaterThanOrEqual(frame.x);
    for (const [x] of pts.slice(2)) expect(x).toBeLessThanOrEqual(frame.x);
  });
});
