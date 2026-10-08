import { expect, test } from '@playwright/test';
import { MOD, announcer, canvasBox, edges, openSeededBoard, screens, waitSaved } from './editor.helpers';

test('add screens with F, connect with the arrow tool, undo/redo, and persist across reload', async ({ page }) => {
  const id = `e2e${Date.now().toString(36)}`;
  await openSeededBoard(page, id);
  const box = await canvasBox(page);

  // Zoom out so three desktop screens fit side by side.
  for (let i = 0; i < 3; i++) await page.keyboard.press(`${MOD}+Minus`);
  await page.waitForTimeout(300);

  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('f');
    await page.mouse.click(box.x + 200 + i * 260, box.y + box.height / 2);
    await expect(screens(page)).toHaveCount(i + 1);
  }
  await expect(page.getByText('Screen 3', { exact: true })).toBeVisible();

  // Arrow tool: drag from screen 1 to screen 2.
  await page.keyboard.press('a');
  const s1 = (await screens(page).nth(0).boundingBox())!;
  const s2 = (await screens(page).nth(1).boundingBox())!;
  await page.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2);
  await page.mouse.down();
  await page.mouse.move(s2.x + s2.width / 2, s2.y + s2.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(edges(page)).toHaveCount(1);

  // Undo removes the connector, redo brings it back.
  await page.keyboard.press(`${MOD}+z`);
  await expect(edges(page)).toHaveCount(0);
  await expect(announcer(page)).toContainText(/Undone/);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(edges(page)).toHaveCount(1);

  await waitSaved(page);
  await page.reload();
  await expect(screens(page)).toHaveCount(3);
  await expect(edges(page)).toHaveCount(1);
  await expect(page.getByText('Screen 2', { exact: true })).toBeVisible();
});

test('unknown board shows a calm not-found state', async ({ page }) => {
  await page.goto('/b/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Board not found' })).toBeVisible();
  await page.getByRole('link', { name: /your boards/i }).click();
  await expect(page).toHaveURL(/\/$/);
});
