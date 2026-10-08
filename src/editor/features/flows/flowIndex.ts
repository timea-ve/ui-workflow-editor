// Derived, cached view of a board's flows and their options (one computation per doc snapshot).
import type { BoardDoc, ID } from '../../../model/types';
import { detectFlows, framesInVariant, getStartFrame, variantsInFlow } from '../../../flow/ops';

export interface FlowOption {
  /** undefined for a plain flow (no options yet). */
  variantId?: ID;
  label: string;
  /** "A", "B"… from "Option A"; first letter otherwise. */
  letter: string;
  frameIds: ID[];
  startFrameId: ID;
}

export interface FlowGroup {
  /** Key in doc.flowNames: the option-set id when the flow has options, else the start screen id. */
  key: ID;
  name: string;
  customName: boolean;
  options: FlowOption[];
  /** True when the options live in lanes (VariantGroups). */
  hasOptions: boolean;
  frameIds: ID[];
  startFrameId: ID;
}

export interface FlowIndex {
  /** All flows incl. single screens, top-to-bottom. */
  groups: FlowGroup[];
  /** Flows worth listing: 2+ screens or with options. */
  listed: FlowGroup[];
  groupByFrame: Map<ID, FlowGroup>;
  optionByFrame: Map<ID, FlowOption>;
  groupByKey: Map<ID, FlowGroup>;
}

export function optionLetter(label: string, index: number): string {
  const m = /^Option\s+([A-Z0-9]+)\b/i.exec(label.trim());
  if (m) return m[1].toUpperCase();
  return String.fromCharCode(65 + (index % 26));
}

const cache = new WeakMap<BoardDoc, FlowIndex>();

export function getFlowIndex(doc: BoardDoc): FlowIndex {
  const hit = cache.get(doc);
  if (hit) return hit;
  const groups: FlowGroup[] = [];
  const seenSets = new Set<ID>();
  for (const v of Object.values(doc.variants)) {
    if (seenSets.has(v.flowId)) continue;
    seenSets.add(v.flowId);
    const options: FlowOption[] = variantsInFlow(doc, v.flowId).flatMap((vg, i) => {
      const frameIds = framesInVariant(doc, vg.id).map((f) => f.id);
      const startFrameId = getStartFrame(doc, frameIds);
      return startFrameId ? [{ variantId: vg.id, label: vg.label, letter: optionLetter(vg.label, i), frameIds, startFrameId }] : [];
    });
    if (!options.length) continue;
    const custom = doc.flowNames?.[v.flowId];
    const start = doc.frames[options[0].startFrameId];
    groups.push({
      key: v.flowId, name: custom ?? `${start.name} flow`, customName: custom !== undefined, options, hasOptions: true,
      frameIds: options.flatMap((o) => o.frameIds), startFrameId: options[0].startFrameId,
    });
  }
  const inVariant = (id: ID) => { const vid = doc.frames[id]?.variantId; return !!vid && !!doc.variants[vid]; };
  for (const flow of detectFlows(doc, { includeSingles: true })) {
    const frameIds = flow.frameIds.filter((id) => !inVariant(id));
    if (!frameIds.length) continue;
    const startFrameId = frameIds.length === flow.frameIds.length ? flow.startFrameId : getStartFrame(doc, frameIds)!;
    const custom = doc.flowNames?.[startFrameId];
    groups.push({
      key: startFrameId, name: custom ?? `${doc.frames[startFrameId].name} flow`, customName: custom !== undefined,
      options: [{ label: 'Option A', letter: 'A', frameIds, startFrameId }], hasOptions: false, frameIds, startFrameId,
    });
  }
  const pos = (g: FlowGroup) => doc.frames[g.startFrameId];
  groups.sort((a, b) => pos(a).y - pos(b).y || pos(a).x - pos(b).x);
  const groupByFrame = new Map<ID, FlowGroup>();
  const optionByFrame = new Map<ID, FlowOption>();
  const groupByKey = new Map<ID, FlowGroup>();
  for (const g of groups) {
    groupByKey.set(g.key, g);
    for (const o of g.options) for (const id of o.frameIds) { groupByFrame.set(id, g); optionByFrame.set(id, o); }
  }
  const index: FlowIndex = {
    groups, listed: groups.filter((g) => g.hasOptions || g.frameIds.length > 1), groupByFrame, optionByFrame, groupByKey,
  };
  cache.set(doc, index);
  return index;
}

/** The frame a node lives in (screens resolve to themselves). */
export function frameIdOf(doc: BoardDoc, nodeId: ID): ID | undefined {
  if (doc.frames[nodeId]) return nodeId;
  const p = doc.elements[nodeId]?.parentId;
  return p && doc.frames[p] ? p : undefined;
}

/** The flow a selection points at: the first selected node inside a screen. */
export function groupForSelection(doc: BoardDoc, nodeIds: ID[]): FlowGroup | undefined {
  const idx = getFlowIndex(doc);
  for (const id of nodeIds) {
    const f = frameIdOf(doc, id);
    if (f && idx.groupByFrame.get(f)) return idx.groupByFrame.get(f);
  }
  return undefined;
}

/** Flow to act on: the selection's, else the first listed flow, else the first screen's. */
export function targetGroup(doc: BoardDoc, nodeIds: ID[]): FlowGroup | undefined {
  const idx = getFlowIndex(doc);
  return groupForSelection(doc, nodeIds) ?? idx.listed[0] ?? idx.groups[0];
}
