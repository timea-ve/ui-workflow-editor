// Phase 4 onboarding: the first-run tip tour, and a first-time user building a 3-screen flow
// guided only by what's on screen. Saves screenshots for docs/phase-4 when SHOTS=1.
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS === '1';
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `docs/phase-4/${name}.png` }); };
const screens = (page: Page) => page.locator('.fse-editor .react-flow__node-screen');
const edges = (page: Page) => page.locator('.fse-editor .react-flow__edge');
const tour = (page: Page) => page.locator('.fse-tour');

test.use({ viewport: { width: 1440, height: 900 } });

/** A brand-new person: empty storage, and the tour allowed even though this is an automated browser. */
async function firstVisit(page: Page) {
  await page.addInitScript(() => localStorage.setItem('fs:tour:e2e', 'on'));
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('fs:tour:e2e', 'on'); });
  await page.reload();
}

test('first-run tour: shows once, Esc dismisses, reopens from Keyboard shortcuts', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: /^New board/ }).first().click();
  await expect(page).toHaveURL(/\/b\//);

  // Shows on the first board, next to the screen tool, without taking focus from the canvas.
  await expect(tour(page)).toBeVisible();
  await expect(tour(page)).toHaveAttribute('data-step', 'screen');
  await expect(tour(page)).toContainText('Add a screen');
  await expect(tour(page)).toContainText('Tip 1 of 4');
  await expect(page.locator('.fsc-coach')).toContainText('Start your flow');
  await shot(page, 'tour');

  // Esc dismisses it.
  await page.keyboard.press('Escape');
  await expect(tour(page)).toBeHidden();

  // It doesn't come back by itself — not after a reload, not on another new board.
  await page.reload();
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.locator('.fsc-coach')).toBeVisible();
  await shot(page, 'empty-board');
  await expect(tour(page)).toBeHidden();
  await page.goto('/');
  await page.getByRole('button', { name: /^New board/ }).first().click();
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(tour(page)).toBeHidden();

  // Re-opens from the help (Keyboard shortcuts) dialog, focused so it can be read with the keyboard.
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  await page.getByRole('button', { name: 'Show quick tour' }).click();
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
  await expect(tour(page)).toHaveAttribute('data-step', 'screen');
  await expect(tour(page).getByRole('button', { name: 'Next' })).toBeFocused();

  // Keyboard walk-through: Next → Next → Next → Done.
  await page.keyboard.press('Enter');
  await expect(tour(page)).toHaveAttribute('data-step', 'insert');
  await page.keyboard.press('Enter');
  await expect(tour(page)).toHaveAttribute('data-step', 'link');
  await page.keyboard.press('Enter');
  await expect(tour(page)).toHaveAttribute('data-step', 'play');
  await expect(tour(page).getByRole('button', { name: 'Skip tour' })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(tour(page)).toBeHidden();
});

test('first-time user builds a 3-screen linked flow from the on-screen hints', async ({ page }) => {
  test.setTimeout(60_000);
  await firstVisit(page);
  const started = Date.now();
  let steps = 0;
  const step = async (what: () => Promise<unknown>) => { steps++; await what(); await page.waitForTimeout(150); };

  // 1. Dashboard: "New board".
  await step(() => page.getByRole('button', { name: /^New board/ }).first().click());
  await expect(page).toHaveURL(/\/b\//);
  await expect(page.locator('.fsc-coach')).toContainText('Add a screen');
  await expect(tour(page)).toContainText('Press F, then click the board');

  // 2–3. Tip 1: press F, click the board.
  await step(() => page.keyboard.press('f'));
  const box = (await page.locator('.fse-canvas').boundingBox())!;
  await step(() => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2));
  await expect(screens(page)).toHaveCount(1);
  await expect(tour(page)).toHaveAttribute('data-step', 'insert'); // the tip moves on by itself

  // 4. Tip 2: press / and pick "Button" (typed query + Enter counted as one step).
  await step(async () => { await page.keyboard.press('/'); await page.keyboard.type('button'); await page.keyboard.press('Enter'); });
  await expect(tour(page)).toHaveAttribute('data-step', 'link');

  // 5. Tip 3: press L, choose "New screen" (first option).
  await step(async () => {
    await page.keyboard.press('l');
    await expect(page.getByRole('listbox', { name: 'Screens' }).getByRole('option').first()).toContainText('New screen');
    await page.keyboard.press('Enter');
  });
  await expect(screens(page)).toHaveCount(2);
  await expect(edges(page)).toHaveCount(1);
  await expect(tour(page)).toHaveAttribute('data-step', 'play');

  // 6–7. Same again on the new (selected) screen: a button, then L → New screen.
  await step(async () => { await page.keyboard.press('/'); await page.keyboard.type('button'); await page.keyboard.press('Enter'); });
  await step(async () => { await page.keyboard.press('l'); await page.keyboard.press('Enter'); });
  await page.keyboard.press('Shift+1'); // fit, so off-view screens are rendered for counting
  await expect(screens(page)).toHaveCount(3);
  await expect(edges(page)).toHaveCount(2);

  // 8. Tip 4: press P. Play starts at the first screen of the flow; click through.
  await step(() => page.keyboard.press('p'));
  const play = page.getByRole('dialog', { name: /^Playing/ });
  await expect(play).toContainText('Screen 1 of 3');
  await expect(tour(page)).toBeHidden(); // finishing the last tip closes the tour
  await play.locator('.fs-play-hotspot').first().click();
  await expect(play).toContainText('Screen 2 of 3');
  await play.locator('.fs-play-hotspot').first().click();
  await expect(play).toContainText('Screen 3 of 3');

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`First-time flow: 3 linked screens + play in ${steps} steps, ${seconds}s (automated)`);
  expect(steps).toBeLessThanOrEqual(10);
});
