import { expect, test, type Page } from '@playwright/test';
import { MOD, announcer, canvasBox, openSeededBoard, screens, waitSaved } from './editor.helpers';

const kitNodes = (page: Page) => page.locator('.react-flow__node-kit');
const palette = (page: Page) => page.getByRole('dialog', { name: 'Insert' });
const inspector = (page: Page) => page.locator('.fse-right');

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

test('Inspector: screen device + start screen; element props; hidden when nothing is selected', async ({ page }) => {
  await boardWithScreen(page);
  await expect(inspector(page)).toBeVisible();
  await expect(inspector(page)).toContainText('Screen');
  const before = (await screens(page).first().boundingBox())!;
  await inspector(page).getByLabel('Device').selectOption('tablet');
  await expect.poll(async () => (await screens(page).first().boundingBox())!.width).toBeGreaterThan(before.width * 1.5);
  const after = (await screens(page).first().boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  await inspector(page).getByLabel('Start screen').check();
  await expect(announcer(page)).toContainText('start screen');

  // Esc leaves the panel and returns focus to the canvas, where "/" works again.
  await page.keyboard.press('Escape');
  await expect(screens(page).first()).toBeFocused();
  await page.keyboard.press('/');
  await page.keyboard.type('checkbox');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(1);
  await expect(inspector(page)).toContainText('Checkbox');
  const label = inspector(page).getByLabel('Label', { exact: true });
  await label.fill('Keep me signed in');
  await expect(kitNodes(page).first()).toContainText('Keep me signed in');
  // Typing is a single undo step.
  await page.keyboard.press('Escape'); // back to the canvas
  await expect(kitNodes(page).first()).toBeFocused();
  await page.keyboard.press(`${MOD}+z`);
  await expect(announcer(page)).toContainText('Undone: Edit Label');
  await expect(kitNodes(page).first()).not.toContainText('Keep me');

  // W field commits on Enter.
  await kitNodes(page).first().click();
  const w = inspector(page).getByLabel('Width');
  await w.fill('240');
  await w.press('Enter');
  await expect(w).toHaveValue('240');

  await page.keyboard.press('Escape'); // inspector → element
  await expect(kitNodes(page).first()).toBeFocused();
  await page.keyboard.press('Escape'); // element → its screen
  await expect(inspector(page).getByLabel('Device')).toBeVisible();
  await page.keyboard.press('Escape'); // screen → nothing
  await expect(inspector(page)).toBeHidden();
});

test('resize an element with its corner handle (snaps to 8px, one undo step)', async ({ page }) => {
  await boardWithScreen(page);
  await page.keyboard.press('/');
  await page.keyboard.type('input');
  await page.keyboard.press('Enter');
  const node = kitNodes(page).first();
  await expect(node).toHaveCount(1);
  const w = inspector(page).getByLabel('Width');
  const w0 = Number(await w.inputValue());
  const handle = node.locator('.fs-resize-handle--se');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x - 30, hb.y + 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await w.inputValue())).toBeLessThan(w0);
  const w1 = Number(await w.inputValue());
  expect(w1 % 8).toBe(0);
  await page.keyboard.press(`${MOD}+z`);
  await expect(w).toHaveValue(String(w0));
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
  const w = inspector(page).getByLabel('Width');
  const w0 = Number(await w.inputValue());
  await kitNodes(page).first().focus();
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await expect(w).toHaveValue(String(w0 - 8));
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
