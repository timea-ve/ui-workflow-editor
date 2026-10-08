import type { BoardDoc, ID } from '../model/types';
import { detectFlows, framesInVariant, getStartFrame } from '../flow/ops';

/** Where Play starts in the share view: the first flow's start screen, else the first screen. */
export function playStart(doc: BoardDoc, variantId?: ID): { frameId: ID; title: string } | undefined {
  if (variantId) {
    const start = getStartFrame(doc, framesInVariant(doc, variantId).map((f) => f.id));
    return start ? { frameId: start, title: doc.variants[variantId]?.label ?? 'Option' } : undefined;
  }
  const flow = detectFlows(doc)[0] ?? detectFlows(doc, { includeSingles: true })[0];
  if (!flow) return undefined;
  return { frameId: flow.startFrameId, title: doc.flowNames?.[flow.id] || flow.name };
}

export function isEmptyDoc(doc: BoardDoc): boolean {
  return !Object.keys(doc.frames ?? {}).length && !Object.keys(doc.elements ?? {}).length;
}

/** Fill collections an older/newer snapshot may lack so renderers never see undefined maps. */
export function normalizeDoc(doc: Partial<BoardDoc> | null | undefined): BoardDoc {
  return {
    ...(doc ?? {}),
    frames: doc?.frames ?? {},
    elements: doc?.elements ?? {},
    connectors: doc?.connectors ?? {},
    links: doc?.links ?? {},
    variants: doc?.variants ?? {},
    flowNames: doc?.flowNames ?? {},
  };
}
