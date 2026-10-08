// Click-to-place for the drawing tools. Pure helpers around the ops in src/flow/ops.ts.
import type { BoardDoc, Device, ElementType, ID } from '../model/types';
import { DEVICE_SIZES } from '../model/types';
import { kitRegistry } from '../kit/registry';
import { addElement, createScreen } from '../flow/ops';
import type { ToolId } from '../chrome/tools';

export type PlacementTool = Extract<ToolId, 'screen' | 'rect' | 'diamond' | 'ellipse' | 'text' | 'sticky'>;
export const PLACEMENT_TOOLS: readonly PlacementTool[] = ['screen', 'rect', 'diamond', 'ellipse', 'text', 'sticky'];
export const isPlacementTool = (t: ToolId): t is PlacementTool => (PLACEMENT_TOOLS as readonly string[]).includes(t);

/** "Screen N" with the lowest N not used yet. */
export function nextScreenName(doc: BoardDoc): string {
  const used = new Set(Object.values(doc.frames).map((f) => f.name));
  let n = 1;
  while (used.has(`Screen ${n}`)) n++;
  return `Screen ${n}`;
}

export function shapeTypeFor(tool: Exclude<PlacementTool, 'screen'>, insideFrame: boolean): ElementType {
  if (tool === 'text') return insideFrame ? 'text' : 'label';
  return tool;
}

export interface Placed { doc: BoardDoc; id: ID; kind: 'screen' | 'element'; label: string }

/** Places a screen centred on `at` (canvas coordinates). */
export function placeScreen(doc: BoardDoc, at: { x: number; y: number }, device: Device = 'desktop'): Placed {
  const size = DEVICE_SIZES[device];
  const name = nextScreenName(doc);
  const r = createScreen(doc, { device, name, x: Math.round(at.x - size.w / 2), y: Math.round(at.y - size.h / 2) });
  return { doc: r.doc, id: r.id, kind: 'screen', label: `${name} added` };
}

/** Places a diagram shape centred on `at`; inside `frameId` (relative coords, clamped) when given. */
export function placeShape(doc: BoardDoc, tool: Exclude<PlacementTool, 'screen'>, at: { x: number; y: number }, frameId?: ID): Placed {
  const frame = frameId ? doc.frames[frameId] : undefined;
  const type = shapeTypeFor(tool, !!frame);
  const def = kitRegistry.get(type);
  const w = def?.defaultSize.w ?? 120;
  const h = def?.defaultSize.h ?? 60;
  let x = Math.round(at.x - w / 2);
  let y = Math.round(at.y - h / 2);
  if (frame) {
    x = Math.max(0, Math.min(frame.w - w, x - frame.x));
    y = Math.max(0, Math.min(frame.h - h, y - frame.y));
  }
  const r = addElement(doc, { type, x, y, ...(frame ? { parentId: frame.id } : {}) });
  return { doc: r.doc, id: r.id, kind: 'element', label: `${def?.label ?? type} added` };
}
