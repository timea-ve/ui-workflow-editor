// Flow spec: a small, forgiving JSON format that Copilot (or a person) writes to describe a flow.
// `validateFlowSpec` checks it and returns a normalized copy plus readable messages; building the
// board from it lives in flowSpecBoard.ts. Format reference: flows/README.md and docs/AGENT-FLOWS.md.
//
// Pure module (no React, no kit renderers, no Vite env) so the `npm run flow` CLI can reuse it.
import type { Device, ElementType } from '../model/types.ts';

// ---------- the format (what gets written) ----------

export interface FlowSpecComponent {
  /** Kit id ("button", "input", …) or a friendly alias ("title", "image", "textfield", …). */
  type: string;
  /** Main text of the component (button label, heading text, input label, …). `label`/`title` work too. */
  text?: string;
  label?: string;
  title?: string;
  /** Items for lists, tabs, navs, menus, dropdowns, radios, tables (array or comma-separated string). */
  items?: string[] | string;
  /** Id of a screen (or decision) this component leads to when tapped. Makes it clickable in Play. */
  goTo?: string;
  /** Optional label on the arrow drawn for `goTo`. */
  linkLabel?: string;
  /** Any other kit prop (e.g. "placeholder", "variant", "level"). Unknown props are ignored. */
  [prop: string]: unknown;
}

export interface FlowSpecScreen {
  id: string;
  name?: string;
  components?: FlowSpecComponent[];
  /** Draws an arrow to the next screen (or decision) without a specific button. Not clickable in Play. */
  next?: string;
  nextLabel?: string;
}

export interface FlowSpecDecision {
  id: string;
  /** The question, e.g. "Email found?" */
  text: string;
  /** Screen id when the answer is yes / no. */
  yes: string;
  no: string;
  /** Screen the decision follows. Optional when a component's `goTo` or a screen's `next` points at the decision. */
  after?: string;
  yesLabel?: string;
  noLabel?: string;
}

export interface FlowSpecNote {
  text: string;
  /** Screen id the sticky note sits above. Defaults to the first screen. */
  near?: string;
}

export interface FlowSpecOption {
  /** Lane label, e.g. "Option B · one-page form". Defaults to "Option B", "Option C", … */
  label?: string;
  screens: FlowSpecScreen[];
  decisions?: FlowSpecDecision[];
  notes?: FlowSpecNote[];
}

export interface FlowSpec {
  name: string;
  /** "mobile" (default), "tablet" or "desktop". */
  device?: Device;
  /** Label for the main flow when `options` are given. Defaults to "Option A". */
  label?: string;
  screens: FlowSpecScreen[];
  decisions?: FlowSpecDecision[];
  notes?: FlowSpecNote[];
  /** Alternative versions of the same flow, shown as Option B, C, … lanes below the main one. */
  options?: FlowSpecOption[];
}

// ---------- normalized form (what the builder consumes) ----------

export interface NormComponent {
  type: ElementType;
  /** Spec fields minus the structural ones (`type`, `goTo`, `linkLabel`), for prop mapping. */
  fields: Record<string, unknown>;
  goTo?: string;
  linkLabel?: string;
  /** The type as written, when it wasn't recognised (rendered as a text placeholder). */
  unknownType?: string;
}

export interface NormScreen { id: string; name: string; components: NormComponent[]; next?: string; nextLabel?: string }
export interface NormDecision { id: string; text: string; yes: string; no: string; after: string[]; yesLabel: string; noLabel: string }
export interface NormNote { text: string; near?: string }
export interface NormLane { label: string; screens: NormScreen[]; decisions: NormDecision[]; notes: NormNote[] }
export interface NormFlowSpec { name: string; device: Device; lanes: NormLane[] }

export type FlowSpecResult =
  | { ok: true; spec: NormFlowSpec; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

// ---------- kit types ----------

/** Every kit item id (src/kit/registry.ts; a unit test keeps this list in sync). */
export const KIT_TYPES = [
  'header', 'nav', 'button', 'input', 'checkbox', 'toggle', 'dropdown', 'card', 'list', 'table', 'image', 'text',
  'heading', 'modal', 'tabs', 'icon', 'caption', 'link', 'icon-button', 'fab', 'textarea', 'search', 'radio', 'slider',
  'datepicker', 'sidebar', 'menu', 'breadcrumbs', 'pagination', 'video', 'avatar', 'calendar', 'line-chart',
  'stacked-chart', 'divider', 'tooltip', 'toast', 'badge', 'progress', 'spinner',
  'rect', 'diamond', 'ellipse', 'sticky', 'label',
] as const satisfies readonly ElementType[];

/** Kit items that can't be the source of a prototype link (registry `linkable: false`; kept in sync by a test). */
export const NOT_LINKABLE: ReadonlySet<ElementType> = new Set<ElementType>([
  'calendar', 'caption', 'checkbox', 'divider', 'heading', 'line-chart', 'progress', 'radio', 'slider', 'spinner',
  'stacked-chart', 'table', 'toast', 'toggle', 'tooltip', 'rect', 'diamond', 'ellipse', 'sticky', 'label',
]);

/** Friendly names → kit ids. Keys are normalized (lower-case, spaces/underscores → hyphens). */
export const TYPE_ALIASES: Readonly<Record<string, ElementType>> = {
  title: 'heading', headline: 'heading', h1: 'heading', h2: 'heading', h3: 'heading', 'page-title': 'heading',
  paragraph: 'text', body: 'text', description: 'text', copy: 'text', p: 'text', subtitle: 'text', message: 'text', 'body-text': 'text',
  small: 'caption', helper: 'caption', hint: 'caption', footnote: 'caption', 'helper-text': 'caption',
  img: 'image', photo: 'image', picture: 'image', illustration: 'image', hero: 'image', thumbnail: 'image', map: 'image', placeholder: 'image',
  textfield: 'input', 'text-field': 'input', field: 'input', 'form-field': 'input', textbox: 'input', 'text-input': 'input',
  email: 'input', password: 'input', 'input-field': 'input',
  'text-area': 'textarea', multiline: 'textarea', comment: 'textarea',
  btn: 'button', cta: 'button', 'primary-button': 'button', 'secondary-button': 'button',
  hyperlink: 'link', 'text-link': 'link', textlink: 'link', anchor: 'link',
  select: 'dropdown', picker: 'dropdown', combobox: 'dropdown', combo: 'dropdown',
  switch: 'toggle', tickbox: 'checkbox', check: 'checkbox',
  'radio-group': 'radio', radios: 'radio', 'radio-buttons': 'radio', choice: 'radio',
  range: 'slider', date: 'datepicker', 'date-picker': 'datepicker',
  appbar: 'header', 'app-bar': 'header', topbar: 'header', 'top-bar': 'header', toolbar: 'header', navbar: 'header', 'nav-bar': 'header',
  'title-bar': 'header', 'top-nav': 'header',
  tabbar: 'nav', 'tab-bar': 'nav', 'bottom-nav': 'nav', 'bottom-navigation': 'nav', 'bottom-bar': 'nav', navigation: 'nav',
  segmented: 'tabs', 'segmented-control': 'tabs', tab: 'tabs',
  tile: 'card', 'product-card': 'card',
  'list-view': 'list', rows: 'list', 'item-list': 'list', items: 'list',
  grid: 'table', 'data-table': 'table',
  dialog: 'modal', popup: 'modal', 'pop-up': 'modal', sheet: 'modal', 'bottom-sheet': 'modal', 'alert-dialog': 'modal',
  snackbar: 'toast', alert: 'toast', notification: 'toast', banner: 'toast',
  loader: 'spinner', loading: 'spinner', 'progress-bar': 'progress', stepper: 'progress', steps: 'progress',
  chip: 'badge', tag: 'badge', pill: 'badge',
  'profile-picture': 'avatar', 'profile-pic': 'avatar', user: 'avatar', profile: 'avatar',
  chart: 'line-chart', graph: 'line-chart', 'bar-chart': 'stacked-chart',
  separator: 'divider', hr: 'divider', line: 'divider',
  'search-bar': 'search', searchbar: 'search', 'search-field': 'search', 'search-box': 'search',
  'floating-button': 'fab', 'floating-action-button': 'fab',
  'icon-btn': 'icon-button', iconbutton: 'icon-button',
  'side-nav': 'sidebar', drawer: 'sidebar', 'side-menu': 'sidebar',
  'dropdown-menu': 'menu', 'context-menu': 'menu',
  breadcrumb: 'breadcrumbs', pager: 'pagination', 'video-player': 'video', player: 'video',
  note: 'sticky', decision: 'diamond', box: 'rect',
};

const KIT_SET = new Set<string>(KIT_TYPES);

/** Kit id for a written type (exact id, alias, or undefined if unknown). */
export function resolveType(raw: string): ElementType | undefined {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (KIT_SET.has(key)) return key as ElementType;
  return TYPE_ALIASES[key];
}

// ---------- validation ----------

export const LIMITS = { screens: 40, components: 30, decisions: 40, notes: 40, options: 4, text: 400 } as const;
const DEVICES: Device[] = ['mobile', 'tablet', 'desktop'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Keys that steer layout/links rather than becoming kit props. */
const STRUCTURAL = new Set(['type', 'goTo', 'goto', 'linkLabel']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v.trim() || undefined : typeof v === 'number' ? String(v) : undefined;
const quote = (s: string) => `"${s}"`;

function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Checks a parsed spec (any JSON value) and returns a normalized copy, or every problem found.
 * Forgiving where intent is clear (missing ids/names, aliases, references by screen name,
 * unknown component types); strict where the flow would be wrong (unknown targets, duplicates).
 */
export function validateFlowSpec(input: unknown): FlowSpecResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(input)) {
    return { ok: false, errors: ['The flow file must be a JSON object like { "name": …, "screens": [ … ] }.'], warnings };
  }

  const name = str(input.name) ?? str(input.title);
  if (!name) warnings.push('The flow has no "name"; using "Untitled flow".');

  let device: Device = 'mobile';
  if (input.device !== undefined) {
    const d = str(input.device)?.toLowerCase();
    if (d && (DEVICES as string[]).includes(d)) device = d as Device;
    else warnings.push(`"device" must be "mobile", "tablet" or "desktop" (got ${JSON.stringify(input.device)}); using "mobile".`);
  }

  const lanes: NormLane[] = [];
  const main = lane(input, '', errors, warnings);
  if (main) lanes.push({ ...main, label: str(input.label) ?? 'Option A' });

  if (input.options !== undefined) {
    if (!Array.isArray(input.options)) errors.push('"options" must be a list of alternative flows.');
    else {
      if (input.options.length > LIMITS.options) errors.push(`At most ${LIMITS.options} options are supported (got ${input.options.length}).`);
      input.options.slice(0, LIMITS.options).forEach((o, i) => {
        const fallback = `Option ${LETTERS[i + 1]}`;
        if (!isObj(o)) { errors.push(`options[${i}] must be an object with its own "screens".`); return; }
        const l = lane(o, `${fallback}: `, errors, warnings);
        if (l) lanes.push({ ...l, label: str(o.label) ?? str(o.name) ?? fallback });
      });
    }
  }

  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, spec: { name: name ?? 'Untitled flow', device, lanes }, warnings };
}

/** One lane: the main flow, or one entry of `options`. `at` prefixes messages ("Option B: "). */
function lane(src: Record<string, unknown>, at: string, errors: string[], warnings: string[]): Omit<NormLane, 'label'> | undefined {
  const errorsBefore = errors.length;
  if (!Array.isArray(src.screens) || src.screens.length === 0) {
    errors.push(`${at}"screens" must be a list with at least one screen.`);
    return undefined;
  }
  if (src.screens.length > LIMITS.screens) errors.push(`${at}At most ${LIMITS.screens} screens per flow (got ${src.screens.length}).`);

  const ids = new Map<string, 'screen' | 'decision'>();
  const claim = (id: string, kind: 'screen' | 'decision', where: string) => {
    if (ids.has(id)) { errors.push(`${at}${where}: the id ${quote(id)} is used twice. Every screen and decision needs its own id.`); return; }
    ids.set(id, kind);
  };

  // Screens (first pass: ids + names, so references can be checked afterwards).
  const rawScreens = src.screens.slice(0, LIMITS.screens);
  const screens: NormScreen[] = [];
  const pairs: { raw: Record<string, unknown>; norm: NormScreen }[] = [];
  rawScreens.forEach((s, i) => {
    const where = `Screen ${i + 1}`;
    if (!isObj(s)) { errors.push(`${at}${where} must be an object like { "id": "home", "name": "Home", "components": [ … ] }.`); return; }
    const sName = str(s.name) ?? str(s.title);
    let id = str(s.id) ?? (sName ? slug(sName) : undefined);
    if (!id) { id = `screen-${i + 1}`; warnings.push(`${at}${where} has no "id" or "name"; calling it ${quote(id)}.`); }
    claim(id, 'screen', `${where} (${quote(sName ?? id)})`);
    const norm: NormScreen = {
      id, name: clip(sName ?? titleCase(id), at, warnings), components: [],
      ...(str(s.next) ? { next: str(s.next) } : {}), ...(str(s.nextLabel) ? { nextLabel: str(s.nextLabel) } : {}),
    };
    screens.push(norm);
    pairs.push({ raw: s, norm });
  });

  // Decisions.
  const decisions: NormDecision[] = [];
  if (src.decisions !== undefined && !Array.isArray(src.decisions)) errors.push(`${at}"decisions" must be a list.`);
  const rawDecisions = Array.isArray(src.decisions) ? src.decisions.slice(0, LIMITS.decisions) : [];
  rawDecisions.forEach((d, i) => {
    const where = `Decision ${i + 1}`;
    if (!isObj(d)) { errors.push(`${at}${where} must be an object like { "id": "found", "text": "Email found?", "yes": "…", "no": "…" }.`); return; }
    const text = str(d.text) ?? str(d.question) ?? str(d.label);
    const id = str(d.id) ?? (text ? slug(text) : `decision-${i + 1}`);
    const desc = `${where} (${quote(text ?? id)})`;
    if (!text) errors.push(`${at}${desc} needs a "text", e.g. "Email found?".`);
    claim(id, 'decision', desc);
    const yes = str(d.yes);
    const no = str(d.no);
    if (!yes) errors.push(`${at}${desc} needs a "yes" screen id.`);
    if (!no) errors.push(`${at}${desc} needs a "no" screen id.`);
    const after = str(d.after);
    decisions.push({
      id, text: clip(text ?? '', at, warnings), yes: yes ?? '', no: no ?? '', after: after ? [after] : [],
      yesLabel: str(d.yesLabel) ?? 'Yes', noLabel: str(d.noLabel) ?? 'No',
    });
  });

  // References may use an id or (forgivingly) a screen name, any case.
  const byLower = new Map<string, string>();
  for (const id of ids.keys()) byLower.set(id.toLowerCase(), id);
  for (const s of screens) if (!byLower.has(s.name.toLowerCase())) byLower.set(s.name.toLowerCase(), s.id);
  for (const s of screens) if (!byLower.has(slug(s.name))) byLower.set(slug(s.name), s.id);
  const known = () => [...ids.keys()].map(quote).join(', ');
  const resolve = (ref: string, where: string, field: string, kinds: ('screen' | 'decision')[]): string | undefined => {
    const id = ids.has(ref) ? ref : byLower.get(ref.toLowerCase()) ?? byLower.get(slug(ref));
    if (!id || !kinds.includes(ids.get(id)!)) {
      const what = kinds.length === 1 ? 'screen' : 'screen or decision';
      errors.push(`${at}${where}: ${field} ${quote(ref)} doesn't match any ${what} id. Known ids: ${known()}.`);
      return undefined;
    }
    return id;
  };

  // Screens (second pass: components and `next`).
  for (const { raw: s, norm } of pairs) {
    const sWhere = `Screen ${quote(norm.name)}`;
    if (norm.next) norm.next = resolve(norm.next, sWhere, '"next"', ['screen', 'decision']);
    if (!norm.next) delete norm.next;
    if (s.components === undefined) { warnings.push(`${at}${sWhere} has no components; it will be an empty screen.`); continue; }
    if (!Array.isArray(s.components)) { errors.push(`${at}${sWhere}: "components" must be a list.`); continue; }
    if (s.components.length > LIMITS.components) errors.push(`${at}${sWhere}: at most ${LIMITS.components} components per screen (got ${s.components.length}). Split it into more screens.`);
    s.components.slice(0, LIMITS.components).forEach((c, k) => {
      const cRaw = typeof c === 'string' ? { type: 'text', text: c } : c;
      const cWhere = `${sWhere}, component ${k + 1}`;
      if (!isObj(cRaw)) { errors.push(`${at}${cWhere} must be an object like { "type": "button", "text": "Continue" }.`); return; }
      const written = str(cRaw.type);
      const label = str(cRaw.text) ?? str(cRaw.label) ?? str(cRaw.title);
      const cDesc = `${cWhere} (${written ?? 'no type'}${label ? ` ${quote(label)}` : ''})`;
      let type = written ? resolveType(written) : undefined;
      let unknownType: string | undefined;
      if (!type) {
        unknownType = written ?? 'component';
        type = 'text';
        warnings.push(`${at}${cDesc}: unknown type ${quote(unknownType)}; drawn as a text placeholder (see flows/README.md for the types).`);
      }
      const fields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(cRaw)) {
        if (STRUCTURAL.has(key)) continue;
        fields[key] = typeof value === 'string' ? clip(value, at, warnings) : value;
      }
      if (written && resolveType(written) === 'button' && /secondary/i.test(written) && fields.variant === undefined) fields.variant = 'secondary';
      const comp: NormComponent = { type, fields, ...(unknownType ? { unknownType } : {}) };
      const goToRaw = str(cRaw.goTo) ?? str(cRaw.goto);
      if (goToRaw) {
        if (NOT_LINKABLE.has(type)) {
          warnings.push(`${at}${cDesc}: a ${type} can't be tapped to go somewhere, so its "goTo" is ignored. Use a button or link.`);
        } else {
          const target = resolve(goToRaw, cDesc, '"goTo"', ['screen', 'decision']);
          if (target) {
            if (target === norm.id) warnings.push(`${at}${cDesc}: "goTo" points at its own screen; ignored.`);
            else {
              comp.goTo = target;
              const ll = str(cRaw.linkLabel);
              if (ll) comp.linkLabel = ll;
            }
          }
        }
      }
      norm.components.push(comp);
    });
  }

  // Decisions: resolve targets; `after` defaults to whatever points at the decision.
  for (const d of decisions) {
    const dWhere = `Decision ${quote(d.text || d.id)}`;
    if (d.yes) d.yes = resolve(d.yes, dWhere, '"yes"', ['screen']) ?? '';
    if (d.no) d.no = resolve(d.no, dWhere, '"no"', ['screen']) ?? '';
    if (d.after.length) {
      const a = resolve(d.after[0], dWhere, '"after"', ['screen']);
      d.after = a ? [a] : [];
    } else {
      const from = new Set<string>();
      for (const s of screens) {
        if (s.next === d.id || s.components.some((c) => c.goTo === d.id)) from.add(s.id);
      }
      d.after = [...from];
      if (!d.after.length && errors.length === errorsBefore) {
        errors.push(`${at}${dWhere} isn't connected to any screen. Add "after": "<screen id>", or point a button's "goTo" at ${quote(d.id)}.`);
      }
    }
  }

  // Notes.
  const notes: NormNote[] = [];
  if (src.notes !== undefined && !Array.isArray(src.notes)) errors.push(`${at}"notes" must be a list.`);
  const rawNotes = Array.isArray(src.notes) ? src.notes.slice(0, LIMITS.notes) : [];
  rawNotes.forEach((n, i) => {
    const note = typeof n === 'string' ? { text: n } : n;
    if (!isObj(note) || !str(note.text)) { errors.push(`${at}Note ${i + 1} needs a "text".`); return; }
    const near = str(note.near);
    const target = near ? resolve(near, `Note ${i + 1}`, '"near"', ['screen']) : undefined;
    notes.push({ text: clip(str(note.text)!, at, warnings), ...(target ? { near: target } : {}) });
  });

  return { screens, decisions, notes };
}

function clip(s: string, at: string, warnings: string[]): string {
  if (s.length <= LIMITS.text) return s;
  warnings.push(`${at}Text shortened to ${LIMITS.text} characters: ${quote(s.slice(0, 40))}…`);
  return `${s.slice(0, LIMITS.text - 1)}…`;
}

function titleCase(id: string): string {
  const s = id.replace(/[-_]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : id;
}

/** Parses JSON text and validates it; JSON syntax errors become a readable message. */
export function parseFlowSpec(text: string): FlowSpecResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`The file isn't valid JSON: ${(e as Error).message}`], warnings: [] };
  }
  return validateFlowSpec(value);
}
