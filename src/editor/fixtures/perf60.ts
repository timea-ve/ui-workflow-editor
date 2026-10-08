// Performance fixture: 60 mobile screens × 8 elements, each screen's button linked to the next.
// Open with /b/perf-60 (ephemeral, never saved). See docs/phase-3/canvas-core.md.
import { addElement, createScreen, emptyDoc, linkElementToScreen } from '../../flow/ops';
import type { BoardDoc, ElementType, ID } from '../../model/types';

export const PERF_BOARD_ID = 'perf-60';

const COLS = 10;
const GAP = 120;
const W = 375;
const H = 812;

const CONTENT: { type: ElementType; x: number; y: number; w: number; h: number }[] = [
  { type: 'header', x: 0, y: 0, w: 375, h: 56 },
  { type: 'heading', x: 24, y: 88, w: 260, h: 36 },
  { type: 'text', x: 24, y: 136, w: 320, h: 48 },
  { type: 'input', x: 24, y: 208, w: 327, h: 44 },
  { type: 'input', x: 24, y: 268, w: 327, h: 44 },
  { type: 'card', x: 24, y: 336, w: 327, h: 200 },
  { type: 'button', x: 24, y: 664, w: 327, h: 48 },
  { type: 'nav', x: 0, y: 756, w: 375, h: 56 },
];

export function buildPerfDoc(screens = 60): BoardDoc {
  let doc = emptyDoc();
  const frames: ID[] = [];
  const buttons: ID[] = [];
  for (let i = 0; i < screens; i++) {
    const s = createScreen(doc, {
      device: 'mobile', name: `Screen ${i + 1}`,
      x: (i % COLS) * (W + GAP), y: Math.floor(i / COLS) * (H + GAP), isStart: i === 0,
    });
    doc = s.doc;
    frames.push(s.id);
    for (const c of CONTENT) {
      const e = addElement(doc, { ...c, parentId: s.id });
      doc = e.doc;
      if (c.type === 'button') buttons.push(e.id);
    }
  }
  for (let i = 0; i < screens - 1; i++) doc = linkElementToScreen(doc, buttons[i], frames[i + 1]).doc;
  return doc;
}
