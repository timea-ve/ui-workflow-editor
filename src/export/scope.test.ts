import { describe, expect, it } from 'vitest';
import type { BoardDoc } from '../model/types';
import { addElement, createScreen, emptyDoc, linkElementToScreen } from '../flow/ops';
import { DEVICE_TITLE_H } from '../kit/wireframe/DeviceFrame';
import {
  EXPORT_MARGIN, MAX_PDF_SIDE_PT, MAX_SIDE_PX, MAX_TOTAL_PX,
  capPixelRatio, contentBounds, exportFileName, laneRect, pdfPageSize, scopeDoc, scopeLabel,
} from './scope';
import { effectiveScope, isExportShortcut, loadExportPrefs, saveExportPrefs } from './ExportDialog';

/** A: [S1 → S2] (S1 has a linked button), B: S3 in option "Option B", plus a loose sticky. */
function fixture() {
  let doc: BoardDoc = emptyDoc();
  let r = createScreen(doc, { device: 'mobile', name: 'Home', x: 0, y: 0 }); doc = r.doc; const s1 = r.id;
  r = createScreen(doc, { device: 'mobile', name: 'Detail', x: 500, y: 0 }); doc = r.doc; const s2 = r.id;
  r = createScreen(doc, { device: 'mobile', name: 'Alt', x: 0, y: 1200, variantId: 'vB' }); doc = r.doc; const s3 = r.id;
  doc = { ...doc, variants: { vB: { id: 'vB', flowId: s3, label: 'Option B', order: 'a0' } } };
  let e = addElement(doc, { type: 'button', parentId: s1, x: 20, y: 700, w: 100, h: 40, props: { label: 'Go' } }); doc = e.doc; const btn = e.id;
  e = addElement(doc, { type: 'text', parentId: s2, x: 10, y: 10 }); doc = e.doc; const txt = e.id;
  e = addElement(doc, { type: 'sticky', x: 1000, y: -300, w: 200, h: 200 }); doc = e.doc; const sticky = e.id;
  const l = linkElementToScreen(doc, btn, s2); doc = l.doc;
  return { doc, s1, s2, s3, btn, txt, sticky, connectorId: l.connectorId };
}

describe('scopeDoc', () => {
  it('board returns the doc untouched', () => {
    const { doc } = fixture();
    expect(scopeDoc(doc, { scope: 'board' })).toBe(doc);
  });

  it('selection keeps selected screens, their children and connectors between them', () => {
    const f = fixture();
    const out = scopeDoc(f.doc, { scope: 'selection', selectionIds: [f.s1, f.s2] });
    expect(Object.keys(out.frames).sort()).toEqual([f.s1, f.s2].sort());
    expect(Object.keys(out.elements).sort()).toEqual([f.btn, f.txt].sort());
    expect(Object.keys(out.connectors)).toEqual([f.connectorId]);
    expect(Object.keys(out.links)).toHaveLength(1);
    expect(out.variants).toEqual({});
  });

  it('selection drops connectors with an end outside the selection', () => {
    const f = fixture();
    const out = scopeDoc(f.doc, { scope: 'selection', selectionIds: [f.s1] });
    expect(Object.keys(out.elements)).toEqual([f.btn]);
    expect(out.connectors).toEqual({});
    expect(out.links).toEqual({});
  });

  it('an element selected without its screen is exported loose at its canvas position', () => {
    const f = fixture();
    const out = scopeDoc(f.doc, { scope: 'selection', selectionIds: [f.txt] });
    const el = out.elements[f.txt];
    expect(el.parentId).toBeUndefined();
    expect([el.x, el.y]).toEqual([510, 10]);
    expect(out.frames).toEqual({});
  });

  it('a selected lane expands to its screens', () => {
    const f = fixture();
    const out = scopeDoc(f.doc, { scope: 'selection', selectionIds: ['lane:vB'] });
    expect(Object.keys(out.frames)).toEqual([f.s3]);
  });

  it('option keeps only that variant, with its lane', () => {
    const f = fixture();
    const out = scopeDoc(f.doc, { scope: 'option', variantId: 'vB' });
    expect(Object.keys(out.frames)).toEqual([f.s3]);
    expect(Object.keys(out.variants)).toEqual(['vB']);
    expect(out.elements).toEqual({});
  });
});

describe('contentBounds', () => {
  it('includes screen name labels, loose elements and lanes', () => {
    const f = fixture();
    const b = contentBounds(f.doc)!;
    const lane = laneRect(f.doc, 'vB')!;
    expect(b.x).toBe(Math.min(0, lane.x));
    expect(b.y).toBe(-300); // the sticky is the top-most thing
    expect(b.x + b.w).toBe(1200); // sticky right edge
    expect(b.y + b.h).toBe(lane.y + lane.h);
  });

  it('counts the title label above the top-most screen', () => {
    let doc = emptyDoc();
    doc = createScreen(doc, { device: 'mobile', x: 10, y: 20 }).doc;
    expect(contentBounds(doc)).toEqual({ x: 10, y: 20 - DEVICE_TITLE_H, w: 375, h: 812 + DEVICE_TITLE_H });
  });

  it('is undefined for an empty doc', () => {
    expect(contentBounds(emptyDoc())).toBeUndefined();
  });

  it('margin is 48px', () => expect(EXPORT_MARGIN).toBe(48));
});

describe('capPixelRatio', () => {
  it('uses 2× for normal boards', () => expect(capPixelRatio(2000, 1000)).toBe(2));
  it('keeps the longest side within 16k px', () => {
    const r = capPixelRatio(20_000, 500);
    expect(20_000 * r).toBeLessThanOrEqual(MAX_SIDE_PX + 1e-6);
  });
  it('keeps the total within 64 MP', () => {
    const r = capPixelRatio(7000, 7000);
    expect(7000 * r * 7000 * r).toBeLessThanOrEqual(MAX_TOTAL_PX + 1);
    expect(r).toBeGreaterThan(1);
  });
  it('handles degenerate sizes', () => expect(capPixelRatio(0, 10)).toBe(2));
});

describe('pdfPageSize', () => {
  it('converts px to pt and picks orientation', () => {
    expect(pdfPageSize(800, 400)).toEqual({ w: 600, h: 300, orientation: 'landscape' });
    expect(pdfPageSize(400, 800).orientation).toBe('portrait');
  });
  it('shrinks to the PDF page limit keeping the aspect ratio', () => {
    const p = pdfPageSize(40_000, 10_000);
    expect(p.w).toBeCloseTo(MAX_PDF_SIDE_PT);
    expect(p.w / p.h).toBeCloseTo(4);
  });
});

describe('naming', () => {
  it('scopeLabel', () => {
    const { doc } = fixture();
    expect(scopeLabel(doc, 'board')).toBe('Whole board');
    expect(scopeLabel(doc, 'selection')).toBe('Selection');
    expect(scopeLabel(doc, 'option', 'vB')).toBe('Option B');
    expect(scopeLabel(doc, 'option', 'nope')).toBe('Option');
  });
  it('exportFileName sanitises', () => {
    expect(exportFileName('Checkout flow', 'Whole board', 'png')).toBe('Checkout flow – Whole board.png');
    expect(exportFileName('a/b:c*?"<>|d', 'Selection', 'pdf')).toBe('a b c d – Selection.pdf');
    expect(exportFileName('  ...hidden ', 'Option B', 'png')).toBe('hidden – Option B.png');
    expect(exportFileName('', 'Whole board', 'png')).toBe('UI Workflow Editor board – Whole board.png');
    expect(exportFileName('x'.repeat(300), '', 'png')).toBe(`${'x'.repeat(100)}.png`);
  });
});

describe('dialog helpers', () => {
  it('effectiveScope falls back to the whole board', () => {
    expect(effectiveScope('selection', false, true)).toBe('board');
    expect(effectiveScope('option', true, false)).toBe('board');
    expect(effectiveScope('selection', true, false)).toBe('selection');
  });
  it('prefs round-trip and ignore junk', () => {
    localStorage.clear();
    expect(loadExportPrefs()).toEqual({ scope: 'board', format: 'png', background: 'white' });
    saveExportPrefs({ scope: 'option', format: 'pdf', background: 'transparent' });
    expect(loadExportPrefs()).toEqual({ scope: 'option', format: 'pdf', background: 'transparent' });
    localStorage.setItem('fs:export:v1', '{"scope":"x","format":1}');
    expect(loadExportPrefs()).toEqual({ scope: 'board', format: 'png', background: 'white' });
  });
  it('isExportShortcut matches Mod+Shift+E only', () => {
    const k = (o: Partial<KeyboardEvent>) => ({ key: 'E', metaKey: false, ctrlKey: false, shiftKey: true, altKey: false, ...o });
    expect(isExportShortcut(k({ metaKey: true }))).toBe(true);
    expect(isExportShortcut(k({ ctrlKey: true }))).toBe(true);
    expect(isExportShortcut(k({}))).toBe(false);
    expect(isExportShortcut(k({ metaKey: true, shiftKey: false }))).toBe(false);
  });
});
