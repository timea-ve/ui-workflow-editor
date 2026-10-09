import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kitRegistry } from '../kit/registry';
import { detectFlows } from '../flow/ops';
import type { BoardDoc } from '../model/types';
import { KIT_TYPES, NOT_LINKABLE, TYPE_ALIASES, parseFlowSpec, resolveType, validateFlowSpec, type FlowSpec, type NormFlowSpec } from './flowSpec';
import { buildFlowBoard } from './flowSpecBoard';
import { decodeFlowLink, encodeFlowSpec, flowLinkPath, flowLinkUrl, LIVE_APP_URL } from './flowLink';
import { decodeShare } from '../share/link';

const ok = (input: unknown): NormFlowSpec => {
  const r = validateFlowSpec(input);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.spec;
};
const errorsOf = (input: unknown): string[] => {
  const r = validateFlowSpec(input);
  if (r.ok) throw new Error('expected errors');
  return r.errors;
};
const build = (input: unknown) => buildFlowBoard(ok(input)).doc;
const textOf = (doc: BoardDoc, frameName: string) => {
  const f = Object.values(doc.frames).find((x) => x.name === frameName)!;
  return Object.values(doc.elements).filter((e) => e.parentId === f.id);
};

/** Template-like specs: the five starter templates' shapes, written as specs. */
const TEMPLATE_SPECS: FlowSpec[] = [
  {
    name: 'Sign-up', screens: [
      { id: 'welcome', name: 'Welcome', components: [{ type: 'image', text: 'Product illustration' }, { type: 'title', text: 'Plan flows together' }, { type: 'text', text: 'Create a free account.' }, { type: 'button', text: 'Create account', goTo: 'signup' }] },
      { id: 'signup', name: 'Sign up', components: [{ type: 'header', text: 'Sign up' }, { type: 'input', label: 'Name' }, { type: 'input', label: 'Email' }, { type: 'input', label: 'Password' }, { type: 'checkbox', label: 'I agree to the terms' }, { type: 'button', text: 'Create account', goTo: 'available' }] },
      { id: 'done', name: 'Account created', components: [{ type: 'icon', glyph: 'check' }, { type: 'title', text: "You're all set" }, { type: 'button', text: 'Get started' }] },
      { id: 'taken', name: 'Email taken', components: [{ type: 'header', text: 'Sign up' }, { type: 'input', label: 'Email', state: 'error' }, { type: 'button', text: 'Try again', goTo: 'signup' }] },
    ],
    decisions: [{ id: 'available', text: 'Email available?', yes: 'done', no: 'taken' }],
  },
  {
    name: 'Onboarding', screens: [
      { id: 's1', name: 'Intro 1', components: [{ type: 'image' }, { type: 'title', text: 'Sketch fast' }, { type: 'button', text: 'Next', goTo: 's2' }, { type: 'link', text: 'Skip', goTo: 'home' }] },
      { id: 's2', name: 'Intro 2', components: [{ type: 'image' }, { type: 'title', text: 'Share flows' }, { type: 'button', text: 'Next', goTo: 'interests' }] },
      { id: 'interests', name: 'Pick interests', components: [{ type: 'title', text: 'What do you design?' }, { type: 'chip', text: 'Mobile' }, { type: 'chip', text: 'Web' }, { type: 'button', text: 'Continue', goTo: 'home' }] },
      { id: 'home', name: 'Home', components: [{ type: 'header', text: 'Home', leading: 'menu' }, { type: 'list', items: ['Recent', 'Shared', 'Starred'] }, { type: 'tab-bar', items: ['Home', 'Search', 'Profile'] }] },
    ],
  },
  {
    name: 'Checkout', device: 'desktop', screens: [
      { id: 'cart', name: 'Cart', components: [{ type: 'header', text: 'Shop' }, { type: 'table', columns: 'Item, Qty, Price' }, { type: 'button', text: 'Checkout', goTo: 'shipping' }] },
      { id: 'shipping', name: 'Shipping', components: [{ type: 'input', label: 'Address' }, { type: 'radio', items: ['Standard', 'Express'] }, { type: 'button', text: 'Continue to payment', goTo: 'payment' }] },
      { id: 'payment', name: 'Payment', components: [{ type: 'input', label: 'Card number' }, { type: 'datepicker', label: 'Expiry' }, { type: 'button', text: 'Pay now', goTo: 'confirm' }] },
      { id: 'confirm', name: 'Order confirmed', components: [{ type: 'title', text: 'Thanks!' }, { type: 'toast', text: 'Order placed' }] },
    ],
  },
  {
    name: 'Settings', device: 'tablet', screens: [
      { id: 'settings', name: 'Settings', components: [{ type: 'header', text: 'Settings' }, { type: 'list', items: 'Account, Notifications, Log out', goTo: 'account' }, { type: 'link', text: 'Notifications', goTo: 'notifications' }, { type: 'button', text: 'Log out', goTo: 'logout' }] },
      { id: 'account', name: 'Account', components: [{ type: 'header', text: 'Account' }, { type: 'input', label: 'Name' }, { type: 'select', label: 'Language', items: ['English', 'Deutsch'] }] },
      { id: 'notifications', name: 'Notifications', components: [{ type: 'switch', label: 'Email' }, { type: 'switch', label: 'Push' }] },
      { id: 'logout', name: 'Log out', components: [{ type: 'dialog', title: 'Log out?', text: 'You can log back in anytime.' }] },
    ],
  },
  {
    name: 'Search', screens: [
      { id: 'search', name: 'Search', components: [{ type: 'search-bar', text: 'Search articles', goTo: 'results' }, { type: 'chip', text: 'Recent' }] },
      { id: 'results', name: 'Results', components: [{ type: 'search', text: 'design' }, { type: 'icon-button', icon: 'filter', goTo: 'filters' }, { type: 'card', title: 'How to sketch', text: '5 min read', goTo: 'article' }] },
      { id: 'article', name: 'Article', components: [{ type: 'header', text: 'Article' }, { type: 'image' }, { type: 'paragraph', text: 'Lorem ipsum dolor sit amet.' }] },
      { id: 'filters', name: 'Filters', components: [{ type: 'header', text: 'Filters' }, { type: 'checkbox', label: 'Articles' }, { type: 'slider', label: 'Length' }, { type: 'button', text: 'Apply', goTo: 'results' }] },
    ],
  },
];

/** Vitest runs from the repo root. */
const FLOWS_DIR = join(process.cwd(), 'flows');
const example = JSON.parse(readFileSync(join(FLOWS_DIR, 'password-reset.json'), 'utf8')) as FlowSpec;

describe('flow spec: kit types', () => {
  it('lists every kit item and matches the registry linkable flags', () => {
    expect([...KIT_TYPES].sort()).toEqual([...kitRegistry.keys()].sort());
    for (const [type, def] of kitRegistry) expect(NOT_LINKABLE.has(type), type).toBe(!def.linkable);
  });

  it('maps aliases to registered types', () => {
    for (const [alias, type] of Object.entries(TYPE_ALIASES)) expect(kitRegistry.has(type), alias).toBe(true);
    expect(resolveType('Title')).toBe('heading');
    expect(resolveType('Text Field')).toBe('input');
    expect(resolveType('icon_button')).toBe('icon-button');
    expect(resolveType('image')).toBe('image');
    expect(resolveType('list')).toBe('list');
    expect(resolveType('hologram')).toBeUndefined();
  });

  it('builds every kit type without crashing', () => {
    const screens = Array.from({ length: Math.ceil(KIT_TYPES.length / 3) }, (_, i) => ({
      id: `s${i}`, components: KIT_TYPES.slice(i * 3, i * 3 + 3).map((type) => ({ type, text: 'Hello', items: ['A', 'B'] })),
    }));
    const doc = build({ name: 'All', screens });
    expect(Object.keys(doc.elements)).toHaveLength(KIT_TYPES.length);
    for (const e of Object.values(doc.elements)) expect(kitRegistry.has(e.type)).toBe(true);
  });
});

describe.each([...TEMPLATE_SPECS.map((s) => [s.name, s] as const), ['example: password-reset', example] as const])('flow spec → board: %s', (_name, spec) => {
  const { doc, warnings } = buildFlowBoard(ok(spec));
  const frames = Object.values(doc.frames);
  const all = [spec, ...(spec.options ?? [])];

  it('builds one screen per spec screen, named, no warnings', () => {
    expect(frames).toHaveLength(all.reduce((n, l) => n + l.screens.length, 0));
    for (const f of frames) expect(f.name.trim()).not.toBe('');
    expect(warnings).toEqual([]);
  });

  it('turns every goTo into a playable link from a linkable element', () => {
    const goTos = all.flatMap((l) => l.screens.flatMap((s) => s.components ?? [])).filter((c) => c.goTo).length;
    expect(Object.keys(doc.links)).toHaveLength(goTos);
    for (const l of Object.values(doc.links)) {
      expect(doc.frames[l.targetFrameId]).toBeDefined();
      expect(doc.connectors[l.connectorId!]).toBeDefined();
      expect(kitRegistry.get(doc.elements[l.sourceElementId].type)!.linkable).toBe(true);
    }
    for (const c of Object.values(doc.connectors)) {
      expect(doc.frames[c.from.nodeId] ?? doc.elements[c.from.nodeId]).toBeDefined();
      expect(doc.frames[c.to.nodeId] ?? doc.elements[c.to.nodeId]).toBeDefined();
    }
  });

  it('keeps every component inside its screen and screens apart', () => {
    for (const e of Object.values(doc.elements)) {
      if (!e.parentId) continue;
      const f = doc.frames[e.parentId];
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.x + e.w, `${e.type} right`).toBeLessThanOrEqual(f.w);
      expect(e.y + e.h, `${e.type} bottom`).toBeLessThanOrEqual(f.h);
    }
    const free = Object.values(doc.elements).filter((e) => !e.parentId);
    const boxes = [...frames, ...free];
    for (const a of boxes) for (const b of boxes) {
      if (a === b) continue;
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
    }
  });

  it('forms one flow starting on the first screen, named after the spec', () => {
    const flows = detectFlows(doc);
    expect(flows).toHaveLength(1);
    expect(flows[0].frameIds).toHaveLength(frames.length);
    expect(doc.frames[flows[0].startFrameId].name).toBe(spec.screens[0].name);
    expect(doc.flowNames[flows[0].id]).toBe(spec.name);
  });

  it('lays out left→right in flow order', () => {
    const first = frames.find((f) => f.name === spec.screens[0].name)!;
    expect(first.x).toBe(Math.min(...frames.map((f) => f.x)));
    expect(first.y).toBe(Math.min(...frames.map((f) => f.y)));
  });
});

describe('flow spec → board: details', () => {
  it('places the example decision under "Reset password" with Yes/No arrows and a note above its screen', () => {
    const doc = build(example);
    const diamond = Object.values(doc.elements).find((e) => e.type === 'diamond')!;
    const reset = Object.values(doc.frames).find((f) => f.name === 'Reset password')!;
    expect(diamond.props.label).toBe('Email found?');
    expect(diamond.y).toBeGreaterThan(reset.y + reset.h);
    expect(diamond.x).toBeGreaterThan(reset.x);
    expect(diamond.x + diamond.w).toBeLessThan(reset.x + reset.w);
    const labels = Object.values(doc.connectors).filter((c) => c.from.nodeId === diamond.id).map((c) => c.label).sort();
    expect(labels).toEqual(['No', 'Yes']);
    const sticky = Object.values(doc.elements).find((e) => e.type === 'sticky')!;
    const notFound = Object.values(doc.frames).find((f) => f.name === 'Email not found')!;
    expect(sticky.y + sticky.h).toBeLessThanOrEqual(notFound.y);
    // Branches: "Check your inbox" and "Email not found" share a column, on two rows.
    const sent = Object.values(doc.frames).find((f) => f.name === 'Check your inbox')!;
    expect(sent.x).toBe(notFound.x);
    expect(notFound.y).toBeGreaterThan(sent.y);
  });

  it('maps text, items and known props; drops invalid select values', () => {
    const doc = build({
      name: 'Props', screens: [{ id: 'a', components: [
        { type: 'title', text: 'Hi', level: 'H2' },
        { type: 'button', text: 'Go' },
        { type: 'button', text: 'Later' },
        { type: 'tabs', items: ['One', 'Two'] },
        { type: 'input', label: 'Name', state: 'wobbly' },
      ] }],
    });
    const [h, b1, b2, tabs, input] = textOf(doc, 'A').sort((x, y) => x.z < y.z ? -1 : 1);
    expect(h.props).toMatchObject({ text: 'Hi', level: 'H2' });
    expect(b1.props).toMatchObject({ label: 'Go', variant: 'primary' });
    expect(b2.props).toMatchObject({ label: 'Later', variant: 'secondary' });
    expect(tabs.props.tabs).toBe('One, Two');
    expect(input.props).toMatchObject({ label: 'Name', placeholder: '', state: 'default' });
  });

  it('tolerates unknown component types as a text placeholder', () => {
    const r = validateFlowSpec({ name: 'X', screens: [{ id: 'a', components: [{ type: 'hologram', text: '3D logo' }, { type: 'spaceship' }] }] });
    expect(r.ok).toBe(true);
    expect(r.warnings.join('\n')).toMatch(/unknown type "hologram"/);
    const doc = buildFlowBoard((r as { spec: NormFlowSpec }).spec).doc;
    const texts = Object.values(doc.elements).map((e) => [e.type, e.props.text]);
    expect(texts).toEqual([['text', '3D logo'], ['text', '[spaceship]']]);
  });

  it('is forgiving: ids from names, references by name, strings as text', () => {
    const doc = build({ name: 'Loose', screens: [
      { name: 'Home', components: ['Hello there', { type: 'Button', label: 'Next', goTo: 'Second step' }] },
      { name: 'Second step', components: [] },
    ] });
    expect(Object.keys(doc.links)).toHaveLength(1);
    expect(Object.values(doc.frames).map((f) => f.name).sort()).toEqual(['Home', 'Second step']);
  });

  it('screen "next" draws an arrow, a goTo to a decision plays the yes path', () => {
    const doc = build({ name: 'N', screens: [
      { id: 'a', components: [{ type: 'button', text: 'Pay', goTo: 'ok' }] },
      { id: 'b', next: 'c', nextLabel: 'after 3s' },
      { id: 'c' },
    ], decisions: [{ id: 'ok', text: 'Paid?', yes: 'b', no: 'a' }] });
    const b = Object.values(doc.frames).find((f) => f.name === 'B')!;
    expect(Object.values(doc.links)[0].targetFrameId).toBe(b.id);
    expect(Object.values(doc.connectors).some((c) => c.label === 'after 3s' && c.from.nodeId === b.id)).toBe(true);
  });

  it('squeezes crowded screens and warns when they still overflow', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ type: 'input', label: `Field ${i}` }));
    const r = buildFlowBoard(ok({ name: 'Crowded', screens: [{ id: 'a', components: many }] }));
    expect(r.warnings.join()).toMatch(/more components than fit/);
    for (const e of Object.values(r.doc.elements)) expect(e.y + e.h).toBeLessThanOrEqual(812);
  });

  it('builds options as lanes (Option A / Option B) of one flow', () => {
    const doc = build({
      name: 'Sign-in', label: 'Option A · password',
      screens: [{ id: 'a', components: [{ type: 'button', text: 'Log in', goTo: 'b' }] }, { id: 'b' }],
      options: [{ screens: [{ id: 'a', name: 'Magic link', components: [{ type: 'button', text: 'Send link', goTo: 'b' }] }, { id: 'b', name: 'Check inbox' }], notes: ['No passwords'] }],
    });
    const variants = Object.values(doc.variants);
    expect(variants.map((v) => v.label)).toEqual(['Option A · password', 'Option B']);
    expect(new Set(variants.map((v) => v.flowId)).size).toBe(1);
    expect(doc.flowNames[variants[0].flowId]).toBe('Sign-in');
    const laneA = Object.values(doc.frames).filter((f) => f.variantId === variants[0].id);
    const laneB = Object.values(doc.frames).filter((f) => f.variantId === variants[1].id);
    expect(laneA).toHaveLength(2);
    expect(laneB).toHaveLength(2);
    expect(Math.min(...laneB.map((f) => f.y))).toBeGreaterThan(Math.max(...laneA.map((f) => f.y + f.h)));
    for (const l of Object.values(doc.links)) {
      const src = doc.elements[l.sourceElementId];
      expect(doc.frames[l.targetFrameId].variantId).toBe(src.variantId);
    }
  });
});

describe('flow spec: readable errors', () => {
  it('rejects non-objects and missing screens', () => {
    expect(errorsOf(null)[0]).toMatch(/JSON object/);
    expect(errorsOf({ name: 'x' })[0]).toMatch(/"screens" must be a list/);
    expect(parseFlowSpec('{ nope').ok).toBe(false);
    expect((parseFlowSpec('{ nope') as { errors: string[] }).errors[0]).toMatch(/isn't valid JSON/);
  });

  it('names the screen, component and unknown target, and lists known ids', () => {
    const errs = errorsOf({ name: 'x', screens: [{ id: 'login', name: 'Log in', components: [{ type: 'button', text: 'Forgot password?', goTo: 'reset2' }] }, { id: 'reset' }] });
    expect(errs).toEqual([
      'Screen "Log in", component 1 (button "Forgot password?"): "goTo" "reset2" doesn\'t match any screen or decision id. Known ids: "login", "reset".',
    ]);
  });

  it('reports duplicate ids, incomplete and unconnected decisions', () => {
    const errs = errorsOf({ name: 'x', screens: [{ id: 'a' }, { id: 'a' }], decisions: [{ id: 'd', text: 'Ok?', yes: 'a' }] });
    expect(errs.some((e) => /"a" is used twice/.test(e))).toBe(true);
    expect(errs.some((e) => /needs a "no" screen id/.test(e))).toBe(true);
    const lonely = errorsOf({ name: 'x', screens: [{ id: 'a' }, { id: 'b' }], decisions: [{ id: 'd', text: 'Ok?', yes: 'a', no: 'b' }] });
    expect(lonely[0]).toMatch(/isn't connected to any screen/);
  });

  it('warns (not fails) about ignorable things', () => {
    const r = validateFlowSpec({ device: 'watch', screens: [{ id: 'a', components: [{ type: 'checkbox', label: 'x', goTo: 'b' }] }, { id: 'b' }] });
    expect(r.ok).toBe(true);
    expect(r.warnings.join('\n')).toMatch(/no "name"/);
    expect(r.warnings.join('\n')).toMatch(/"device" must be/);
    expect(r.warnings.join('\n')).toMatch(/checkbox can't be tapped/);
  });

  it('caps sizes', () => {
    const screens = Array.from({ length: 41 }, (_, i) => ({ id: `s${i}` }));
    expect(errorsOf({ name: 'big', screens })[0]).toMatch(/At most 40 screens/);
  });
});

describe('flow links', () => {
  it('round-trips a spec through the link and rejects share links / garbage', async () => {
    const data = await encodeFlowSpec(example);
    expect(flowLinkPath(data)).toBe(`new/v1#${data}`);
    expect(flowLinkUrl(LIVE_APP_URL, data)).toBe(`https://timea-ve.github.io/ui-workflow-editor/new/v1#${data}`);
    expect(flowLinkUrl('http://localhost:5173', data)).toBe(`http://localhost:5173/new/v1#${data}`);
    const r = await decodeFlowLink(data);
    expect(r.ok && r.spec.name).toBe('Password reset');
    await expect(decodeFlowLink(data.slice(0, data.length / 2))).rejects.toThrow();
    await expect(decodeFlowLink('')).rejects.toThrow();
    // The shared codec still reads share links (no behaviour change).
    await expect(decodeShare(data)).rejects.toThrow('invalid board');
  });

  it('every file in flows/ is a valid spec', () => {
    const files = readdirSync(FLOWS_DIR).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const r = parseFlowSpec(readFileSync(join(FLOWS_DIR, f), 'utf8'));
      expect(r.ok ? [] : r.errors, f).toEqual([]);
    }
  });
});
