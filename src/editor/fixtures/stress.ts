// Stress fixture for connector routing: 60 mobile screens × 10 elements, 6 canvas shapes and 80 elbow
// connectors (button → next screen, "Skip" links that jump rows, screen → screen and shape lines),
// so lines cross, share sides and detour around screens. Open with /b/perf-stress (ephemeral, never
// saved). Used by src/flow/routing.bench.test.ts and e2e/editor-perf.spec.ts. See docs/phase-4/performance.md.
import { addConnector, addElement, createScreen, emptyDoc, linkElementToScreen } from '../../flow/ops';
import type { BoardDoc, ElementType, ID } from '../../model/types';

export const STRESS_BOARD_ID = 'perf-stress';

const COLS = 10;
const GAP = 160;
const W = 375;
const H = 812;

const CONTENT: { type: ElementType; x: number; y: number; w: number; h: number; text?: string }[] = [
  { type: 'header', x: 0, y: 0, w: 375, h: 56 },
  { type: 'heading', x: 24, y: 88, w: 260, h: 36 },
  { type: 'text', x: 24, y: 136, w: 320, h: 48 },
  { type: 'input', x: 24, y: 208, w: 327, h: 44 },
  { type: 'input', x: 24, y: 268, w: 327, h: 44 },
  { type: 'card', x: 24, y: 336, w: 327, h: 160 },
  { type: 'checkbox', x: 24, y: 516, w: 200, h: 24 },
  { type: 'button', x: 24, y: 600, w: 327, h: 48, text: 'Skip' },
  { type: 'button', x: 24, y: 664, w: 327, h: 48, text: 'Next' },
  { type: 'nav', x: 0, y: 756, w: 375, h: 56 },
];

export function buildStressDoc(screens = 60): BoardDoc {
  let doc = emptyDoc();
  const frames: ID[] = [];
  const next: ID[] = [];
  const skip: ID[] = [];
  for (let i = 0; i < screens; i++) {
    const s = createScreen(doc, {
      device: 'mobile', name: `Screen ${i + 1}`,
      x: (i % COLS) * (W + GAP), y: Math.floor(i / COLS) * (H + GAP), isStart: i === 0,
    });
    doc = s.doc;
    frames.push(s.id);
    for (const c of CONTENT) {
      const e = addElement(doc, { type: c.type, x: c.x, y: c.y, w: c.w, h: c.h, parentId: s.id, ...(c.text ? { props: { text: c.text } } : {}) });
      doc = e.doc;
      if (c.text === 'Next') next.push(e.id);
      if (c.text === 'Skip') skip.push(e.id);
    }
  }
  // 59 element → screen links along the reading order (row ends wrap back to the next row's start).
  for (let i = 0; i < screens - 1; i++) doc = linkElementToScreen(doc, next[i], frames[i + 1]).doc;
  // 11 "Skip" links that jump a row and a few columns: they cross other lines and share sides.
  for (let i = 3; i < screens - 13; i += 4) doc = linkElementToScreen(doc, skip[i], frames[i + 13]).doc;
  // 4 screen → screen lines going back up the board.
  for (let i = 25; i < screens; i += 10) doc = addConnector(doc, frames[i], frames[i - 22]).doc;
  // 6 decision shapes in the gutters below rows, each wired between two screens (12 more lines).
  for (let k = 0; k < 6; k++) {
    const col = 1 + k;
    const row = k % 4;
    const d = addElement(doc, { type: 'diamond', x: col * (W + GAP) - GAP / 2 - 60, y: row * (H + GAP) + H + 20, w: 120, h: 80 });
    doc = d.doc;
    doc = addConnector(doc, frames[row * COLS + col - 1], d.id).doc;
    doc = addConnector(doc, d.id, frames[(row + 1) * COLS + col]).doc;
  }
  return doc;
}
