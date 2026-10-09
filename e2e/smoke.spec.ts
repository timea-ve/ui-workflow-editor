import { expect, test } from '@playwright/test';

// Cross-browser smoke (Chromium, Firefox, WebKit): dashboard → template → play → reload keeps the edit.

test('dashboard → template → play → autosave survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('new-board')).toBeVisible();

  await page.getByTestId('template-signup').click();
  await expect(page).toHaveURL(/\/b\/[\w-]{6,}$/);
  const screens = page.locator('.fse-editor .react-flow__node-screen');
  await expect(screens.first()).toBeVisible();
  const count = await screens.count();
  expect(count).toBeGreaterThan(1);

  // Play from the first screen and follow one link.
  await screens.first().click({ position: { x: 10, y: 10 } });
  await page.getByTestId('play-button').click();
  const play = page.getByRole('dialog', { name: /^Playing/ });
  await expect(play).toBeVisible();
  const first = await page.getByTestId('play-screen').getAttribute('data-frame-id');
  await play.locator('.fs-play-hotspot').first().click();
  await expect(page.getByTestId('play-screen')).not.toHaveAttribute('data-frame-id', first!);
  await page.keyboard.press('Escape');
  await expect(play).toBeHidden();

  // An edit (a new screen) is autosaved and is still there after a reload.
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await expect(screens).toHaveCount(count + 1);
  await expect(page.locator('.fsc-status')).toContainText(/saved/i, { timeout: 5000 });
  await page.reload();
  await expect(screens).toHaveCount(count + 1);
});
