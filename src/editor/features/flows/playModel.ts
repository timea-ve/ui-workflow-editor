// Pure Play-mode logic: history, screen order, option switching and hotspots.
import type { BoardDoc, ID } from '../../../model/types';
import { kitRegistry } from '../../../kit/registry';
import { getLinksFromFrame } from '../../../flow/ops';

export interface PlayHistory { start: ID; stack: ID[] }

export const playStart = (start: ID): PlayHistory => ({ start, stack: [start] });
export const playCurrent = (h: PlayHistory) => h.stack[h.stack.length - 1];
export const playGo = (h: PlayHistory, frameId: ID): PlayHistory =>
  playCurrent(h) === frameId ? h : { ...h, stack: [...h.stack, frameId] };
export const playBack = (h: PlayHistory): PlayHistory => (h.stack.length > 1 ? { ...h, stack: h.stack.slice(0, -1) } : h);
export const playRestart = (h: PlayHistory): PlayHistory => playStart(h.start);
export const canGoBack = (h: PlayHistory) => h.stack.length > 1;

export interface Hotspot { elementId: ID; targetFrameId: ID; x: number; y: number; w: number; h: number }

/** Clickable areas on a screen: only links (connectors never make hotspots), from linkable components, to existing screens. */
export function hotspots(doc: BoardDoc, frameId: ID): Hotspot[] {
  return getLinksFromFrame(doc, frameId).flatMap((l) => {
    const el = doc.elements[l.sourceElementId];
    if (!el || !doc.frames[l.targetFrameId]) return [];
    if (kitRegistry.get(el.type)?.linkable === false) return [];
    return [{ elementId: el.id, targetFrameId: l.targetFrameId, x: el.x, y: el.y, w: el.w, h: el.h }];
  }).sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Links whose target screen was deleted. */
export function brokenLinks(doc: BoardDoc, frameId: ID): ID[] {
  return getLinksFromFrame(doc, frameId).filter((l) => !doc.frames[l.targetFrameId]).map((l) => l.sourceElementId);
}

/** Reading order of a flow for "Screen x of y": breadth-first along links from the start, then the rest by position. */
export function flowOrder(doc: BoardDoc, frameIds: ID[], startFrameId: ID): ID[] {
  const inFlow = new Set(frameIds.filter((id) => doc.frames[id]));
  const order: ID[] = [];
  const seen = new Set<ID>();
  const queue = inFlow.has(startFrameId) ? [startFrameId] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const h of hotspots(doc, id)) if (inFlow.has(h.targetFrameId) && !seen.has(h.targetFrameId)) queue.push(h.targetFrameId);
  }
  const rest = [...inFlow].filter((id) => !seen.has(id))
    .sort((a, b) => doc.frames[a].x - doc.frames[b].x || doc.frames[a].y - doc.frames[b].y);
  return [...order, ...rest];
}

/** When switching options mid-play: the same-named screen, else the one at the same position in the flow, else the start. */
export function correspondingFrame(
  doc: BoardDoc, from: { frameIds: ID[]; startFrameId: ID }, to: { frameIds: ID[]; startFrameId: ID }, frameId: ID,
): ID {
  const name = doc.frames[frameId]?.name;
  const byName = to.frameIds.filter((id) => doc.frames[id]?.name === name);
  if (name && byName.length === 1) return byName[0];
  const fromOrder = flowOrder(doc, from.frameIds, from.startFrameId);
  const toOrder = flowOrder(doc, to.frameIds, to.startFrameId);
  const i = fromOrder.indexOf(frameId);
  if (i >= 0 && toOrder[i]) return toOrder[i];
  return to.startFrameId;
}

/** Uniform scale that fits a screen into the stage (never upscales). */
export function fitScale(frame: { w: number; h: number }, stage: { w: number; h: number }, pad = 32): number {
  const s = Math.min((stage.w - pad * 2) / frame.w, (stage.h - pad * 2) / frame.h, 1);
  return Math.max(0.1, Number.isFinite(s) ? s : 1);
}
