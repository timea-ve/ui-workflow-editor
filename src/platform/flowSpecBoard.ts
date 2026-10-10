// Flow spec → BoardDoc. Same approach as the starter templates: every mutation goes through the pure
// ops in src/flow/ops.ts, then a simple auto layout places screens, decisions and notes.
//
// Layout: screens run left→right in flow order (breadth-first from the first screen); branches go on
// new rows. Decisions sit in the gap under the screen they follow; notes sit above their screen.
// Components stack top→bottom inside each screen (headers pinned to the top, tab bars to the bottom,
// and on phones/tablets the closing buttons/links to the bottom, like the templates). On desktop a
// `sidebar` pins to the left under the header and the rest stacks in a wider column beside it.
import { nanoid } from 'nanoid';
import { DEVICE_SIZES, type BoardDoc, type Device, type ElementType, type ID } from '../model/types';
import { LANE_GAP, SCREEN_GAP, addConnector, addElement, boundsOf, createScreen, emptyDoc, linkElementToScreen, zAfter } from '../flow/ops';
import { kitRegistry } from '../kit/registry';
import type { KitItemDef } from '../kit/types';
import type { NormComponent, NormDecision, NormFlowSpec, NormLane, NormScreen } from './flowSpec';

const LAYOUT: Record<Device, { top: number; bottom: number; margin: number; maxW: number }> = {
  mobile: { top: 44, bottom: 24, margin: 24, maxW: 327 },
  tablet: { top: 28, bottom: 20, margin: 48, maxW: 672 },
  desktop: { top: 44, bottom: 0, margin: 64, maxW: 560 },
};
const GAP = 16;
const SIDEBAR_W = 240;
const SIDEBAR_GUTTER = 48;
const SIDEBAR_CONTENT_MAX_W = 880;
const TIGHT_GAP = 8;
const EDGE = 24;
const DIAMOND = { w: 160, h: 110, gap: 20, top: 40 };
/** `groupLabel`: extra room so notes clear an option group's label chip. */
const STICKY = { w: 180, h: 140, gap: 20, above: 20, groupLabel: 40 };
/** Vertical room between rows: decisions (top band) and notes for the next row (bottom band). */
const ROW_GAP_PLAIN = 200;
const ROW_GAP_ANNOTATED = 360;
const LIST_KEYS = ['items', 'tabs', 'options', 'columns', 'series', 'links'] as const;
const BODY_KEYS = ['body', 'message', 'subtitle'] as const;
const MAIN_KEYS = ['text', 'label', 'title', 'name'] as const;
const SECONDARY_KEYS = ['body', 'description', 'subtitle', 'text', 'message'] as const;

export interface BuiltFlow { doc: BoardDoc; warnings: string[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Def = KitItemDef<any>;

const defOf = (type: ElementType): Def => kitRegistry.get(type) ?? kitRegistry.get('text')!;
const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.trim() || undefined : typeof v === 'number' ? String(v) : undefined;
const listText = (v: unknown): string | undefined =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).join(', ') || undefined : str(v);
const countItems = (s: unknown) => (typeof s === 'string' ? s.split(',').filter((x) => x.trim()).length : 0);

/** Builds a fresh board (new ids every call) from a validated spec. */
export function buildFlowBoard(spec: NormFlowSpec): BuiltFlow {
  const warnings: string[] = [];
  let doc = emptyDoc();
  const multi = spec.lanes.length > 1;
  const flowId = nanoid();
  let firstVariant: ID | undefined;
  let laneTop = 0;
  let order: string | null = null;
  let firstStart: ID | undefined;

  for (const lane of spec.lanes) {
    let variantId: ID | undefined;
    if (multi) {
      variantId = nanoid();
      order = zAfter(order);
      doc = {
        ...doc,
        variants: {
          ...doc.variants,
          [variantId]: { id: variantId, flowId, label: lane.label, order, ...(firstVariant ? { duplicatedFromId: firstVariant } : {}) },
        },
      };
      firstVariant ??= variantId;
    }
    const notesAbove = lane.notes.length ? STICKY.h + STICKY.above + (variantId ? STICKY.groupLabel : 0) : 0;
    const r = buildLane(doc, lane, spec.device, laneTop + notesAbove, variantId, multi ? `${lane.label}: ` : '', warnings);
    doc = r.doc;
    firstStart ??= r.startId;
    const b = boundsOf([
      ...r.frameIds.map((id) => doc.frames[id]),
      ...r.freeIds.map((id) => doc.elements[id]),
    ]);
    laneTop = (b ? b.y + b.h : laneTop) + LANE_GAP;
  }

  const key = multi ? flowId : firstStart;
  if (key) doc = { ...doc, flowNames: { ...doc.flowNames, [key]: spec.name } };
  return { doc, warnings };
}

interface Cell { col: number; row: number }

/** Column/row per screen: BFS depth → column; siblings → first free row at or below the parent's. */
function gridFor(lane: NormLane): Map<string, Cell> {
  const decisions = new Map(lane.decisions.map((d) => [d.id, d]));
  const viaRef = (ref: string | undefined): string[] => {
    if (!ref) return [];
    const d = decisions.get(ref);
    return d ? [d.yes, d.no] : [ref];
  };
  const out = new Map<string, string[]>();
  for (const s of lane.screens) {
    const targets = [
      ...s.components.flatMap((c) => viaRef(c.goTo)),
      ...viaRef(s.next),
      ...lane.decisions.filter((d) => d.after.includes(s.id)).flatMap((d) => [d.yes, d.no]),
    ];
    out.set(s.id, [...new Set(targets)].filter((t) => t && t !== s.id));
  }

  const cells = new Map<string, Cell>();
  const used = new Map<number, Set<number>>();
  const take = (col: number, minRow: number) => {
    const rows = used.get(col) ?? new Set<number>();
    let row = minRow;
    while (rows.has(row)) row++;
    rows.add(row);
    used.set(col, rows);
    return row;
  };
  let maxRow = -1;
  for (const root of lane.screens) {
    if (cells.has(root.id)) continue;
    const startRow = maxRow + 1;
    const row = take(0, startRow);
    cells.set(root.id, { col: 0, row });
    maxRow = Math.max(maxRow, row);
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift()!;
      const at = cells.get(id)!;
      for (const t of out.get(id) ?? []) {
        if (cells.has(t)) continue;
        const r = take(at.col + 1, at.row);
        cells.set(t, { col: at.col + 1, row: r });
        maxRow = Math.max(maxRow, r);
        queue.push(t);
      }
    }
  }
  return cells;
}

function buildLane(
  start: BoardDoc, lane: NormLane, device: Device, top: number, variantId: ID | undefined, at: string, warnings: string[],
): { doc: BoardDoc; startId?: ID; frameIds: ID[]; freeIds: ID[] } {
  let doc = start;
  const size = DEVICE_SIZES[device];
  const colStep = size.w + SCREEN_GAP;
  const annotated = lane.decisions.length > 0 || lane.notes.length > 0;
  const rowStep = size.h + (annotated ? ROW_GAP_ANNOTATED : ROW_GAP_PLAIN);
  const cells = gridFor(lane);

  // Screens.
  const frameOf = new Map<string, ID>();
  lane.screens.forEach((s, i) => {
    const cell = cells.get(s.id)!;
    const r = createScreen(doc, {
      device, name: s.name, x: cell.col * colStep, y: top + cell.row * rowStep, isStart: i === 0, variantId,
    });
    doc = r.doc;
    frameOf.set(s.id, r.id);
  });

  // Components.
  const pending: { el: ID; goTo: string; label?: string }[] = [];
  for (const s of lane.screens) {
    const frame = frameOf.get(s.id)!;
    const placed = placeComponents(s, device, at, warnings);
    for (const p of placed) {
      const r = addElement(doc, { type: p.type, parentId: frame, x: p.x, y: p.y, w: p.w, h: p.h, props: p.props });
      doc = r.doc;
      if (p.goTo) pending.push({ el: r.id, goTo: p.goTo, label: p.linkLabel });
    }
  }

  // Decisions: diamonds in the gap under the (first) screen they follow.
  const decisions = new Map(lane.decisions.map((d) => [d.id, d]));
  const diamondOf = new Map<string, ID>();
  const under = new Map<string, NormDecision[]>();
  for (const d of lane.decisions) {
    const host = d.after[0];
    under.set(host, [...(under.get(host) ?? []), d]);
  }
  const freeIds: ID[] = [];
  for (const [host, list] of under) {
    const f = doc.frames[frameOf.get(host)!];
    const total = list.length * DIAMOND.w + (list.length - 1) * DIAMOND.gap;
    list.forEach((d, i) => {
      const r = addElement(doc, {
        type: 'diamond', x: f.x + (f.w - total) / 2 + i * (DIAMOND.w + DIAMOND.gap), y: f.y + f.h + DIAMOND.top,
        w: DIAMOND.w, h: DIAMOND.h, props: { label: d.text },
      });
      doc = r.doc;
      diamondOf.set(d.id, r.id);
      freeIds.push(r.id);
    });
  }

  // Prototype links (playable). A link to a decision plays the "yes" path.
  const intoDecision = new Map<string, Map<string, string | undefined>>();
  const noteInto = (d: string, screen: string, label?: string) => {
    const m = intoDecision.get(d) ?? new Map<string, string | undefined>();
    if (!m.has(screen) || (label && !m.get(screen))) m.set(screen, label);
    intoDecision.set(d, m);
  };
  for (const s of lane.screens) {
    for (const c of s.components) if (c.goTo && decisions.has(c.goTo)) noteInto(c.goTo, s.id, c.linkLabel);
    if (s.next && decisions.has(s.next)) noteInto(s.next, s.id, s.nextLabel);
  }
  for (const d of lane.decisions) for (const a of d.after) noteInto(d.id, a);

  for (const p of pending) {
    const d = decisions.get(p.goTo);
    const target = frameOf.get(d ? d.yes : p.goTo);
    if (!target) continue;
    doc = linkElementToScreen(doc, p.el, target, d ? {} : { ...(p.label ? { label: p.label } : {}) }).doc;
  }

  // Screen → screen arrows from `next`.
  for (const s of lane.screens) {
    if (!s.next || decisions.has(s.next)) continue;
    doc = addConnector(doc, frameOf.get(s.id)!, frameOf.get(s.next)!, s.nextLabel ? { label: s.nextLabel } : {}).doc;
  }

  // Decision arrows: screen(s) → diamond → yes / no.
  for (const d of lane.decisions) {
    const diamond = diamondOf.get(d.id)!;
    for (const [screen, label] of intoDecision.get(d.id) ?? []) {
      const below = screen === d.after[0];
      doc = addConnector(doc, frameOf.get(screen)!, diamond, {
        ...(label ? { label } : {}), ...(below ? { fromAnchor: 'bottom', toAnchor: 'top' } : {}),
      }).doc;
    }
    doc = addConnector(doc, diamond, frameOf.get(d.yes)!, { label: d.yesLabel }).doc;
    doc = addConnector(doc, diamond, frameOf.get(d.no)!, { label: d.noLabel }).doc;
  }

  // Notes: sticky notes above their screen (or the first one).
  const notesAt = new Map<string, string[]>();
  for (const n of lane.notes) {
    const near = n.near ?? lane.screens[0].id;
    notesAt.set(near, [...(notesAt.get(near) ?? []), n.text]);
  }
  const above = STICKY.above + (variantId ? STICKY.groupLabel : 0);
  for (const [near, texts] of notesAt) {
    const f = doc.frames[frameOf.get(near)!];
    texts.forEach((text, i) => {
      const r = addElement(doc, {
        type: 'sticky', x: f.x + i * (STICKY.w + STICKY.gap), y: f.y - above - STICKY.h, w: STICKY.w, h: STICKY.h, props: { text },
      });
      doc = r.doc;
      freeIds.push(r.id);
    });
  }

  // Options: arrows inside this lane belong to its option group, like "Duplicate as option" does.
  const frameIds = [...frameOf.values()];
  if (variantId) {
    const inLane = new Set<ID>(frameIds);
    for (const e of Object.values(doc.elements)) if (e.parentId && inLane.has(e.parentId)) inLane.add(e.id);
    const connectors = { ...doc.connectors };
    for (const c of Object.values(connectors)) {
      if (!c.variantId && inLane.has(c.from.nodeId) && inLane.has(c.to.nodeId)) connectors[c.id] = { ...c, variantId };
    }
    doc = { ...doc, connectors };
  }

  return { doc, startId: frameOf.get(lane.screens[0].id), frameIds, freeIds };
}

// ---------- components inside a screen ----------

interface Placed { type: ElementType; x: number; y: number; w: number; h: number; props: Record<string, unknown>; goTo?: string; linkLabel?: string }

function placeComponents(screen: NormScreen, device: Device, at: string, warnings: string[]): Placed[] {
  const frame = DEVICE_SIZES[device];
  const L = LAYOUT[device];
  // Desktop app layout: a sidebar pins to the left under the header; content fills a wider column on the right.
  const hasSidebar = device === 'desktop' && screen.components.some((c) => c.type === 'sidebar');
  const contentLeft = hasSidebar ? SIDEBAR_W + SIDEBAR_GUTTER : 0;
  const cw = hasSidebar
    ? Math.min(frame.w - contentLeft - SIDEBAR_GUTTER, SIDEBAR_CONTENT_MAX_W)
    : Math.min(frame.w - 2 * L.margin, L.maxW);
  const cx = hasSidebar ? contentLeft : Math.round((frame.w - cw) / 2);

  let primaryUsed = false;
  const items = screen.components.map((c) => {
    const def = defOf(c.type);
    const props = propsFor(c, def, device);
    if (c.type === 'button' && c.fields.variant === undefined) {
      props.variant = primaryUsed ? 'secondary' : 'primary';
      primaryUsed = true;
    }
    const s = sizeFor(c.type, def, props, cw, frame.w);
    return { c, def, props, ...s, x: 0, y: 0 };
  });

  const headerIdx = items.findIndex((i) => i.c.type === 'header');
  const navIdx = items.findIndex((i) => i.c.type === 'nav');
  let bodyTop = L.top + EDGE;
  if (headerIdx >= 0) {
    const h = items[headerIdx];
    Object.assign(h, { x: 0, y: L.top, w: frame.w });
    bodyTop = L.top + h.h + EDGE;
  }
  let bodyBottom = frame.h - L.bottom - EDGE;
  if (navIdx >= 0) {
    const n = items[navIdx];
    Object.assign(n, { x: 0, w: frame.w, y: frame.h - L.bottom - n.h });
    bodyBottom = n.y - EDGE;
  }

  const sidebarIdx = hasSidebar ? items.findIndex((i) => i.c.type === 'sidebar') : -1;
  if (sidebarIdx >= 0) {
    const sb = items[sidebarIdx];
    const top = headerIdx >= 0 ? bodyTop - EDGE : L.top;
    Object.assign(sb, { x: 0, y: top, w: SIDEBAR_W, h: frame.h - L.bottom - top });
  }

  const flow = items.filter((_, i) => i !== headerIdx && i !== navIdx && i !== sidebarIdx);
  // Closing actions (a trailing run of buttons/links) go to the bottom on phones and tablets.
  let footer: typeof flow = [];
  if (device !== 'desktop') {
    let k = flow.length;
    while (k > 0 && (flow[k - 1].c.type === 'button' || flow[k - 1].c.type === 'link')) k--;
    if (k > 0 && k < flow.length) footer = flow.slice(k);
  }
  const height = (list: typeof flow, gap: number) => list.reduce((s, i) => s + i.h, 0) + Math.max(0, list.length - 1) * gap;
  const avail = bodyBottom - bodyTop;

  let gap = GAP;
  let stack = flow.slice(0, flow.length - footer.length);
  if (height(stack, gap) + (footer.length ? gap + height(footer, gap) : 0) > avail) { stack = flow; footer = []; }
  if (height(stack, gap) > avail) gap = TIGHT_GAP;
  let over = height(stack, gap) - avail;
  if (over > 0) {
    // Shrink stretchable items toward their minimum height, proportionally to their slack.
    const slack = stack.map((i) => (i.def.resize === 'both' || i.def.resize === 'vertical' ? Math.max(0, i.h - Math.max(i.def.minSize.h, 24)) : 0));
    const total = slack.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const f = Math.min(1, over / total);
      stack.forEach((i, k) => { i.h = Math.round(i.h - slack[k] * f); });
    }
    over = height(stack, gap) - avail;
    if (over > 0) warnings.push(`${at}Screen "${screen.name}" has more components than fit; some overlap. Split it into two screens.`);
  }

  let y = bodyTop;
  for (const i of stack) {
    i.y = Math.min(y, frame.h - L.bottom - i.h);
    i.x = i.centered ? cx + Math.round((cw - i.w) / 2) : cx;
    y += i.h + gap;
  }
  let fy = bodyBottom - height(footer, TIGHT_GAP + 4);
  for (const i of footer) {
    i.y = fy;
    i.x = i.centered ? Math.round((frame.w - i.w) / 2) : cx;
    fy += i.h + TIGHT_GAP + 4;
  }

  return items.map((i) => ({
    type: i.c.type, x: Math.max(0, i.x), y: Math.max(0, i.y), w: i.w, h: i.h, props: i.props,
    ...(i.c.goTo ? { goTo: i.c.goTo } : {}), ...(i.c.linkLabel ? { linkLabel: i.c.linkLabel } : {}),
  }));
}

function sizeFor(type: ElementType, def: Def, props: Record<string, unknown>, cw: number, fw: number): { w: number; h: number; centered: boolean } {
  const d = def.defaultSize;
  const wide = type === 'button' || d.w >= 200;
  const w = type === 'header' || type === 'nav' ? fw : Math.min(wide ? cw : d.w, cw);
  const textLen = (k: string) => (typeof props[k] === 'string' ? (props[k] as string).length : 0);
  const lines = (len: number, charW: number) => Math.max(1, Math.ceil((len * charW) / w));
  let h = d.h;
  switch (type) {
    case 'text': {
      const sm = props.size === 'sm';
      h = Math.min(220, lines(textLen('text'), sm ? 7 : 8) * (sm ? 20 : 24) + 4);
      break;
    }
    case 'caption': h = Math.min(120, lines(textLen('text'), 7) * 18); break;
    case 'heading': {
      const lvl = props.level === 'H3' ? 2 : props.level === 'H2' ? 1 : 0;
      h = Math.min(160, lines(textLen('text'), [15, 12, 10][lvl]) * [40, 32, 28][lvl]);
      break;
    }
    case 'link': h = 24; break;
    case 'icon': return { w: 64, h: 64, centered: true };
    case 'button': h = 48; break;
    case 'input': h = typeof props.helper === 'string' && props.helper.trim() ? 88 : d.h; break;
    case 'list': h = Math.max(56, Math.min(448, (countItems(props.items) || Number(props.count) || 4) * 56)); break;
    case 'radio': h = Math.max(28, (countItems(props.items) || 3) * 28); break;
    case 'menu': h = Math.max(48, (countItems(props.items) || 4) * 40 + 5); break;
    default: break;
  }
  const centered = ['icon', 'spinner', 'fab', 'icon-button', 'diamond', 'ellipse'].includes(type) || (w < cw && type === 'image');
  return { w, h, centered };
}

/** Spec fields → kit props: known props (type-checked, select values validated), main text, list items. */
function propsFor(c: NormComponent, def: Def, device: Device): Record<string, unknown> {
  const dp = def.defaultProps as Record<string, unknown>;
  const f = c.fields;
  const props: Record<string, unknown> = {};

  if (c.unknownType) {
    const main = str(f.text) ?? str(f.label) ?? str(f.title) ?? str(f.name);
    return { text: main ?? `[${c.unknownType}]`, tone: 'muted', size: 'sm' };
  }

  for (const [key, value] of Object.entries(f)) {
    if (!(key in dp)) continue;
    const v = coerce(value, dp[key]);
    if (v === undefined) continue;
    const select = def.editableProps.find((p) => p.key === key && p.kind === 'select' && p.options);
    if (select) {
      const match = select.options!.find((o) => o.toLowerCase() === String(v).toLowerCase());
      if (match) props[key] = match;
    } else props[key] = v;
  }

  const textKey = def.textProp ?? ('name' in dp ? 'name' : 'items' in dp ? 'items' : undefined);
  let mainKey: string | undefined = textKey;
  if (textKey && props[textKey] === undefined) {
    mainKey = MAIN_KEYS.find((k) => str(f[k]));
    if (mainKey) props[textKey] = str(f[mainKey]);
  }

  const items = listText(f.items) ?? listText(f.options);
  const listKey = LIST_KEYS.find((k) => k in dp && k !== textKey) ?? LIST_KEYS.find((k) => k in dp);
  if (items && listKey && (props[listKey] === undefined || listKey === textKey)) props[listKey] = items;
  if (items && 'count' in dp && props.count === undefined) props.count = countItems(items);

  // Secondary copy (card/modal body, toast message) from whichever text field wasn't the main one.
  const bodyKey = BODY_KEYS.find((k) => k in dp);
  if (bodyKey && props[bodyKey] === undefined) {
    const body = SECONDARY_KEYS.filter((k) => k !== mainKey && !(k in dp)).map((k) => str(f[k])).find(Boolean);
    if (body) props[bodyKey] = body;
  }

  // Avoid leftover sample text from kit defaults where the spec gave a different label.
  if (c.type === 'input' && props.placeholder === undefined) props.placeholder = /mail/i.test(String(props.label ?? '')) ? 'you@example.com' : '';
  if (c.type === 'dropdown' && props.value === undefined && items) props.value = items.split(',')[0].trim();
  if (c.type === 'header' && device === 'desktop' && props.variant === undefined) props.variant = 'web';
  return props;
}

function coerce(value: unknown, sample: unknown): unknown {
  switch (typeof sample) {
    case 'string': return Array.isArray(value) ? listText(value) ?? '' : typeof value === 'number' ? String(value) : typeof value === 'string' ? value : undefined;
    case 'number': {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean': return typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined;
    default: return undefined;
  }
}
