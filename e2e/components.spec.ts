import { expect, test, type Page } from '@playwright/test';
import { MOD, announcer, canvasBox, openSeededBoard, screens, waitSaved } from './editor.helpers';

const kitNodes = (page: Page) => page.locator('.react-flow__node-kit');
const palette = (page: Page) => page.getByRole('dialog', { name: 'Insert' });
const bar = (page: Page) => page.locator('.fs-ctx-bar');
const more = (page: Page) => page.getByRole('dialog', { name: 'More options' });

/** Reads W or H from the context bar's More popover (and closes it again). */
async function readSize(page: Page, which: 'Width' | 'Height' = 'Width') {
  await bar(page).getByRole('button', { name: 'More options' }).click();
  const v = Number(await more(page).getByLabel(which).inputValue());
  await page.keyboard.press('Escape');
  await expect(more(page)).toBeHidden();
  return v;
}

/** New board, zoomed out, with one mobile screen placed at the canvas centre (and selected). */
async function boardWithScreen(page: Page) {
  await openSeededBoard(page, `e2e-comp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  const box = await canvasBox(page);
  for (let i = 0; i < 2; i++) await page.keyboard.press(`${MOD}+Minus`);
  await page.waitForTimeout(250);
  await page.keyboard.press('f');
  await page.keyboard.press('1'); // mobile
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(screens(page)).toHaveCount(1);
  return box;
}

async function expectInside(page: Page, inner: ReturnType<Page['locator']>) {
  const s = (await screens(page).first().boundingBox())!;
  const b = (await inner.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(s.x - 1);
  expect(b.y).toBeGreaterThanOrEqual(s.y - 1);
  expect(b.x + b.width).toBeLessThanOrEqual(s.x + s.width + 1);
  expect(b.y + b.height).toBeLessThanOrEqual(s.y + s.height + 1);
}

test('F screen → / "button" → Enter inserts inside the screen; double-click renames; persists', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('/');
  await expect(palette(page)).toBeVisible();
  await page.keyboard.type('button');
  await expect(palette(page).getByRole('option').first()).toHaveText(/Button/);
  await page.keyboard.press('Enter');
  await expect(palette(page)).toBeHidden();
  await expect(kitNodes(page)).toHaveCount(1);
  await expect(announcer(page)).toContainText('Button added to Screen 1');
  await expectInside(page, kitNodes(page).first());
  // The new element is selected and focused.
  await expect(kitNodes(page).first()).toHaveClass(/selected/);
  await expect(kitNodes(page).first()).toBeFocused();

  await kitNodes(page).first().dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit text' });
  await expect(editor).toBeFocused();
  await editor.fill('Create account');
  await page.keyboard.press('Enter');
  await expect(editor).toBeHidden();
  await expect(kitNodes(page).first()).toContainText('Create account');

  // One undo step for the whole edit.
  await page.keyboard.press(`${MOD}+z`);
  await expect(kitNodes(page).first()).not.toContainText('Create account');
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(kitNodes(page).first()).toContainText('Create account');

  await waitSaved(page);
  await page.reload();
  await expect(kitNodes(page)).toHaveCount(1);
  await expect(kitNodes(page).first()).toContainText('Create account');
});

test('Esc cancels inline editing; screen names are editable in place', async ({ page }) => {
  await boardWithScreen(page);
  // Enter on the selected screen renames it.
  await screens(page).first().focus();
  await page.keyboard.press('Enter');
  const name = page.getByRole('textbox', { name: 'Screen name' });
  await expect(name).toBeFocused();
  await name.fill('Welcome');
  await page.keyboard.press('Enter');
  await expect(screens(page).first()).toContainText('Welcome');

  await page.keyboard.press('Enter');
  await name.fill('Nope');
  await page.keyboard.press('Escape');
  await expect(name).toBeHidden();
  await expect(screens(page).first()).toContainText('Welcome');
  await expect(screens(page).first()).toBeFocused();
});

test('Context bar: screen device + start screen; element props; hidden when nothing is selected', async ({ page }) => {
  await boardWithScreen(page);
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).toHaveAttribute('role', 'toolbar');
  await expect(bar(page)).toHaveAccessibleName('Screen options');
  // There is no side panel any more: the canvas gets the full width.
  await expect(page.locator('.fse-right')).toHaveCount(0);
  const before = (await screens(page).first().boundingBox())!;
  await bar(page).getByRole('button', { name: /^Device/ }).click();
  await page.getByRole('menuitemradio', { name: 'Tablet' }).click();
  await expect.poll(async () => (await screens(page).first().boundingBox())!.width).toBeGreaterThan(before.width * 1.5);
  const after = (await screens(page).first().boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  const start = bar(page).getByRole('button', { name: 'Start screen' });
  await start.click();
  await expect(start).toHaveAttribute('aria-pressed', 'true');
  await expect(announcer(page)).toContainText('start screen');

  // Esc leaves the bar and returns focus to the canvas, where "/" works again.
  await page.keyboard.press('Escape');
  await expect(screens(page).first()).toBeFocused();
  await page.keyboard.press('/');
  await page.keyboard.type('checkbox');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(1);
  await expect(bar(page)).toHaveAccessibleName('Checkbox options');
  await bar(page).getByRole('button', { name: 'More options' }).click();
  const label = more(page).getByLabel('Label', { exact: true });
  await label.fill('Keep me signed in');
  await expect(kitNodes(page).first()).toContainText('Keep me signed in');
  // Typing is a single undo step.
  await page.keyboard.press('Escape'); // close More → focus back on the bar
  await expect(more(page)).toBeHidden();
  await expect(bar(page).getByRole('button', { name: 'More options' })).toBeFocused();
  await page.keyboard.press('Escape'); // bar → canvas
  await expect(kitNodes(page).first()).toBeFocused();
  await page.keyboard.press(`${MOD}+z`);
  await expect(announcer(page)).toContainText('Undone: Edit Label');
  await expect(kitNodes(page).first()).not.toContainText('Keep me');

  // W field commits on Enter.
  await kitNodes(page).first().click();
  await bar(page).getByRole('button', { name: 'More options' }).click();
  const w = more(page).getByLabel('Width');
  await w.fill('240');
  await w.press('Enter');
  await expect(w).toHaveValue('240');

  await page.keyboard.press('Escape'); // More → bar
  await expect(bar(page).getByRole('button', { name: 'More options' })).toBeFocused();
  await page.keyboard.press('Escape'); // bar → element
  await expect(kitNodes(page).first()).toBeFocused();
  await page.keyboard.press('Escape'); // element → its screen
  await expect(bar(page).getByRole('button', { name: /^Device/ })).toBeVisible();
  await page.keyboard.press('Escape'); // screen → nothing
  await expect(bar(page)).toBeHidden();
});

test('Context bar: ⌘/Ctrl+. focuses it, arrows move between controls, button state edits undo in one step', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('/');
  await page.keyboard.type('button');
  await page.keyboard.press('Enter');
  const node = kitNodes(page).first();
  await expect(node).toBeFocused();
  await expect(bar(page)).toHaveAccessibleName('Button options');
  // The bar sits just above the selected element.
  const nb = (await node.boundingBox())!;
  const bb = (await bar(page).boundingBox())!;
  expect(bb.y + bb.height).toBeLessThanOrEqual(nb.y);
  expect(nb.y - (bb.y + bb.height)).toBeLessThan(24);

  await page.keyboard.press(`${MOD}+Period`);
  const first = bar(page).locator('[data-ctx-item]').first();
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(bar(page).locator('[data-ctx-item]').nth(1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();

  await bar(page).getByRole('button', { name: /^State/ }).click();
  if (process.env.SHOTS === '1') await page.screenshot({ path: 'docs/gates/gate-3/07-context-bar-button.png' });
  await page.getByRole('menuitemradio', { name: 'Disabled' }).click();
  await expect(bar(page).getByRole('button', { name: 'State: Disabled' })).toBeVisible();
  await expect(node.getByRole('img')).toHaveAttribute('aria-label', /disabled/i);
  await page.keyboard.press('Escape'); // bar → canvas
  await expect(node).toBeFocused();
  await page.keyboard.press(`${MOD}+z`);
  await expect(announcer(page)).toContainText('Undone: Edit State');
  await expect(node.getByRole('img')).not.toHaveAttribute('aria-label', /disabled/i);
  await expect(bar(page).getByRole('button', { name: 'State: Default' })).toBeVisible();
});

test('Context bar: edit Tabs items in the list editor (rename, add, reorder, remove)', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('/');
  await page.keyboard.type('tabs');
  await page.keyboard.press('Enter');
  const node = kitNodes(page).first();
  await expect(bar(page)).toHaveAccessibleName('Tabs options');
  await bar(page).getByRole('button', { name: /^Edit tabs/ }).click();
  const pop = page.getByRole('dialog', { name: 'Tabs' });
  const first = pop.getByRole('textbox', { name: 'Tabs 1' });
  await expect(first).toBeFocused();
  await first.fill('Inbox');
  await expect(node).toContainText('Inbox');
  // Enter adds a row below; type a new one.
  const rows0 = await pop.getByRole('textbox').count();
  await page.keyboard.press('Enter');
  await expect(pop.getByRole('textbox')).toHaveCount(rows0 + 1);
  await expect(pop.getByRole('textbox', { name: 'Tabs 2' })).toBeFocused();
  await page.keyboard.type('Starred');
  await expect(node).toContainText('Starred');
  // Alt+↑ moves it to the top.
  await page.keyboard.press('Alt+ArrowUp');
  await expect(pop.getByRole('textbox', { name: 'Tabs 1' })).toHaveValue('Starred');
  await expect(pop.getByRole('textbox', { name: 'Tabs 2' })).toHaveValue('Inbox');
  // Remove the last row.
  const n = await pop.getByRole('textbox').count();
  const lastValue = await pop.getByRole('textbox', { name: `Tabs ${n}` }).inputValue();
  await pop.getByRole('button', { name: `Remove ${lastValue}` }).click();
  await expect(pop.getByRole('textbox')).toHaveCount(n - 1);
  await expect(node).not.toContainText(lastValue);
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(node.getByRole('img')).toHaveAttribute('aria-label', /Starred.*Inbox/);
  // "Active tab" picks by name, not by a 0-based number.
  await bar(page).getByRole('button', { name: 'Active tab: Starred' }).click();
  if (process.env.SHOTS === '1') await page.screenshot({ path: 'docs/gates/gate-3/08-context-bar-tabs.png' });
  await page.getByRole('menuitemradio', { name: 'Inbox' }).click();
  await expect(bar(page).getByRole('button', { name: 'Active tab: Inbox' })).toBeVisible();
});

test('Context bar: multi-select → align left', async ({ page }) => {
  await boardWithScreen(page);
  for (const q of ['button', 'input']) {
    await page.keyboard.press('Escape');
    await screens(page).first().click({ position: { x: 20, y: 300 } });
    await page.keyboard.press('/');
    await page.keyboard.type(q);
    await page.keyboard.press('Enter');
  }
  await expect(kitNodes(page)).toHaveCount(2);
  // Nudge the second one right so they are not aligned.
  await kitNodes(page).nth(1).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight');
  // Clear the selection first: the bar above the input would cover the button.
  const cb = await canvasBox(page);
  await page.mouse.click(cb.x + cb.width - 60, cb.y + cb.height / 2);
  await expect(bar(page)).toBeHidden();
  await kitNodes(page).nth(0).click();
  await kitNodes(page).nth(1).click({ modifiers: ['Shift'] });
  await expect(bar(page)).toHaveAccessibleName('2 items options');
  await expect(bar(page).getByRole('button', { name: /Distribute horizontally/ })).toBeDisabled();
  const x0 = (await kitNodes(page).nth(0).boundingBox())!.x;
  const x1 = (await kitNodes(page).nth(1).boundingBox())!.x;
  expect(Math.abs(x0 - x1)).toBeGreaterThan(5);
  await bar(page).getByRole('button', { name: 'Align left' }).click();
  await expect.poll(async () => {
    const [a, b] = [(await kitNodes(page).nth(0).boundingBox())!.x, (await kitNodes(page).nth(1).boundingBox())!.x];
    return Math.abs(a - b);
  }).toBeLessThan(1);
  await expect(announcer(page)).toContainText('Align left: 2 items');
});

test('dragging snaps to the 8px grid (Alt turns snapping off)', async ({ page }) => {
  await openSeededBoard(page, `e2e-grid-${Date.now().toString(36)}`);
  const box = await canvasBox(page);
  await page.keyboard.press('r');
  await page.mouse.click(box.x + 200, box.y + 200);
  const node = page.locator('.react-flow__node').first();
  await expect(node).toHaveCount(1);
  const pos = async () => page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.react-flow__node');
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el?.style.transform ?? '');
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  });
  for (const [dx, dy] of [[37, 21], [13, -29], [-51, 45]]) {
    const b = (await node.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 6 });
    await page.mouse.up();
    const p = (await pos())!;
    expect(p.x % 8).toBe(0);
    expect(p.y % 8).toBe(0);
  }
  // Alt: free placement.
  const b = (await node.boundingBox())!;
  await page.keyboard.down('Alt');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 13, b.y + b.height / 2 + 5, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const p = (await pos())!;
  expect(p.x % 8 !== 0 || p.y % 8 !== 0).toBe(true);
});

test('insert palette: icons section inserts an Icon; "arrow" finds the Arrow tool', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('/');
  await expect(palette(page).getByRole('listbox').getByText('Buttons & actions')).toBeVisible();
  await page.keyboard.type('arrow');
  await expect(palette(page).getByRole('option').first()).toHaveText(/Arrow \(connector\)/);
  await expect(palette(page).getByRole('option', { name: 'Arrow left' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.fs-flow-canvas.fs-tool-arrow')).toBeVisible();
  await page.keyboard.press('Escape');
  await screens(page).first().click({ position: { x: 20, y: 300 } });
  await page.keyboard.press('/');
  await page.keyboard.type('bell');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(1);
  await expect(kitNodes(page).first().getByRole('img')).toHaveAttribute('aria-label', /bell/);
  // The icon picker on the bar changes it.
  await bar(page).getByRole('button', { name: /^Icon/ }).click();
  await page.getByRole('searchbox', { name: 'Search icons' }).fill('heart');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page).first().getByRole('img')).toHaveAttribute('aria-label', /heart/);
});

test('resize an element with its corner handle (snaps to 8px, one undo step)', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('/');
  await page.keyboard.type('input');
  await page.keyboard.press('Enter');
  const node = kitNodes(page).first();
  await expect(node).toHaveCount(1);
  const w0 = await readSize(page);
  const handle = node.locator('.fs-resize-handle--se');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x - 30, hb.y + 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => readSize(page)).toBeLessThan(w0);
  const w1 = await readSize(page);
  expect(w1 % 8).toBe(0);
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(() => readSize(page)).toBe(w0);
});

test('drag a component from the palette into a screen', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await page.keyboard.type('toggle');
  const item = page.getByRole('option', { name: /Toggle/ }).first();
  const s = (await screens(page).first().boundingBox())!;
  await item.dragTo(screens(page).first(), { targetPosition: { x: s.width / 2, y: s.height / 2 } });
  await expect(kitNodes(page)).toHaveCount(1);
  await expect(palette(page)).toBeHidden();
  await expectInside(page, kitNodes(page).first());
  await expect(announcer(page)).toContainText('Toggle added to Screen 1');
});

test('keyboard only: place a screen, insert, edit text, resize', async ({ page }) => {
  await openSeededBoard(page, `e2e-kbd-${Date.now().toString(36)}`);
  for (let i = 0; i < 2; i++) await page.keyboard.press(`${MOD}+Minus`);
  await page.keyboard.press('f');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(screens(page)).toHaveCount(1);
  await page.keyboard.press('/');
  await page.keyboard.type('head');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(1);
  await expect(kitNodes(page).first()).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.type('Pick a plan');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page).first()).toContainText('Pick a plan');
  const w0 = await readSize(page);
  await kitNodes(page).first().focus();
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await expect.poll(() => readSize(page)).toBe(w0 - 8);
});

test('elements can be dragged out of a screen onto the canvas (re-parent)', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('/');
  await page.keyboard.type('button');
  await page.keyboard.press('Enter');
  const node = kitNodes(page).first();
  const s = (await screens(page).first().boundingBox())!;
  const b = (await node.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width + 120, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
  const after = (await node.boundingBox())!;
  expect(after.x).toBeGreaterThan(s.x + s.width);
  // Dragging the screen no longer carries the element along.
  await screens(page).first().click({ position: { x: 20, y: s.height - 20 } });
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  const after2 = (await node.boundingBox())!;
  expect(Math.abs(after2.x - after.x)).toBeLessThan(1);
});

test('T and N placements start editing immediately', async ({ page }) => {
  await openSeededBoard(page, `e2e-tn-${Date.now().toString(36)}`);
  const box = await canvasBox(page);
  await page.keyboard.press('n');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const ed = page.getByRole('textbox', { name: /Edit text/ });
  await expect(ed).toBeFocused();
  await page.keyboard.type('Idea one');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('line two');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page).first()).toContainText('Idea one');
  await expect(kitNodes(page).first()).toContainText('line two');

  await page.keyboard.press('t');
  await page.mouse.click(box.x + 120, box.y + 120);
  await expect(ed).toBeFocused();
  await page.keyboard.type('Note');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__node-kit', { hasText: 'Note' })).toBeVisible();
});
