import { expect, test, type Page } from '@playwright/test';
import { MOD, announcer, openSeededBoard, screens } from './editor.helpers';

const translate = async (page: Page, i = 0) => {
  const t = await screens(page).nth(i).evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(t);
  return { x: Number(m?.[1]), y: Number(m?.[2]) };
};

test('keyboard only: tools, place, nudge, duplicate, copy/paste, delete, shortcuts dialog', async ({ page }) => {
  await openSeededBoard(page, `kb${Date.now().toString(36)}`);

  // Tool letters switch the toolbar.
  await page.keyboard.press('r');
  await expect(page.getByRole('radio', { name: 'Rectangle' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('radio', { name: 'Select' })).toHaveAttribute('aria-checked', 'true');

  // F, 1 (mobile), Enter: a screen at the centre of the view, selected.
  await page.keyboard.press('f');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(screens(page)).toHaveCount(1);
  await expect(announcer(page)).toHaveText(/Screen 1 added/);
  await expect(screens(page).first()).toHaveClass(/selected/);
  expect((await screens(page).first().boundingBox())!.height).toBeGreaterThan((await screens(page).first().boundingBox())!.width);

  // Nudge: 1px, Shift = 10px.
  const p0 = await translate(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(() => translate(page)).toEqual({ x: p0.x + 1, y: p0.y + 10 });
  // Both nudges are one undo step.
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(() => translate(page)).toEqual(p0);
  await page.keyboard.press(`${MOD}+Shift+z`);

  // Duplicate, then copy + paste (cascading +24px).
  await page.keyboard.press(`${MOD}+d`);
  await expect(screens(page)).toHaveCount(2);
  await page.keyboard.press(`${MOD}+c`);
  await page.keyboard.press(`${MOD}+v`);
  await expect(screens(page)).toHaveCount(3);
  await expect(announcer(page)).toHaveText(/Pasted 1 item/);

  // Select all, delete.
  await page.keyboard.press(`${MOD}+a`);
  await expect(page.locator('.react-flow__node-screen.selected')).toHaveCount(3);
  await page.keyboard.press('Delete');
  await expect(screens(page)).toHaveCount(0);
  await expect(announcer(page)).toHaveText(/Deleted 3 items/);
  await page.keyboard.press(`${MOD}+z`);
  await expect(screens(page)).toHaveCount(3);

  // ? opens the shortcuts dialog; Escape closes it.
  await page.keyboard.press('Shift+?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Bring to front')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Tab reaches the toolbar and screens; Escape returns to select', async ({ page }) => {
  await openSeededBoard(page, `kbt${Date.now().toString(36)}`);
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await expect(screens(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.react-flow__node-screen.selected')).toHaveCount(0);
  // Tab from the toolbar's Play button lands on the canvas items.
  await page.getByRole('button', { name: 'Play' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.react-flow__node-screen')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(screens(page).first()).toHaveClass(/selected/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.react-flow__node-screen.selected')).toHaveCount(0);
});
