// Gate 3 rehearsal: from an empty dashboard, build a 5-screen sign-up flow, make Option B,
// compare, play it, and check it survives a reload. Saves screenshots for the gate doc when SHOTS=1.
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS === '1';
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `docs/gates/gate-3/${name}.png` }); };
const screens = (page: Page) => page.locator('.fse-editor .react-flow__node-screen');
const edges = (page: Page) => page.locator('.fse-editor .react-flow__edge');

async function insert(page: Page, query: string) {
  await page.keyboard.press('/');
  await expect(page.getByRole('combobox', { name: 'Search components and shapes' })).toBeFocused();
  await page.keyboard.type(query);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Search components and shapes' })).toBeHidden();
  await page.waitForTimeout(150); // human pause between actions
}

test.use({ viewport: { width: 1440, height: 900 } });

test('Director demo: 5-screen sign-up flow with Option A/B, compare, play, reload', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await shot(page, '01-dashboard-first-run');
  const started = Date.now();

  await page.getByRole('button', { name: /^New board/ }).first().click();
  await expect(page).toHaveURL(/\/b\//);

  // Screen 1 (mobile) with a heading + button; then 4 more screens via L → "New screen".
  await page.keyboard.press('f');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(screens(page)).toHaveCount(1);
  for (let i = 2; i <= 5; i++) {
    await insert(page, 'heading');
    await insert(page, 'button');
    await page.keyboard.press('l');
    await page.waitForTimeout(100);
    await expect(page.getByRole('listbox', { name: 'Screens' })).toBeVisible();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    // Off-view screens aren't rendered, so fit everything before counting.
    await page.keyboard.press('Shift+1');
    await expect(screens(page)).toHaveCount(i);
    await screens(page).last().click({ position: { x: 20, y: 20 } });
  }
  await expect(edges(page)).toHaveCount(4);
  const buildSeconds = Math.round((Date.now() - started) / 1000);
  console.log(`5 linked screens built in ${buildSeconds}s (automated)`);

  await page.keyboard.press('Shift+1');
  await page.waitForTimeout(400);
  await shot(page, '02-five-linked-screens');

  // Option B: select the first screen, Shift+D.
  await screens(page).first().click({ position: { x: 20, y: 300 } });
  await page.keyboard.press('Shift+D');
  await expect(screens(page)).toHaveCount(10);
  await expect(page.locator('.fs-lane-chip')).toHaveCount(2);
  await page.keyboard.press('Shift+1');
  await page.waitForTimeout(400);
  await shot(page, '03-option-a-and-b');

  // Inspector + insert palette look.
  await screens(page).nth(1).click({ position: { x: 20, y: 300 } });
  await page.keyboard.press('/');
  await page.waitForTimeout(200);
  await shot(page, '04-insert-palette-and-inspector');
  await page.keyboard.press('Escape');

  // Compare.
  await page.getByTestId('compare-button').click();
  await expect(page.getByRole('dialog', { name: /^Compare options/ })).toBeVisible();
  await page.waitForTimeout(400);
  // Arrows in compare panes must be real lines, not collapsed to a point.
  const cmpEdge = await page.getByRole('dialog', { name: /^Compare options/ }).locator('.fs-sketch-edge').first().boundingBox();
  expect(Math.max(cmpEdge!.width, cmpEdge!.height)).toBeGreaterThan(10);
  await shot(page, '05-compare');
  await page.keyboard.press('Escape');

  // Play from the start.
  await screens(page).first().click({ position: { x: 20, y: 300 } });
  await page.getByTestId('play-button').click();
  const play = page.getByRole('dialog', { name: /^Playing/ });
  await expect(play).toContainText('Screen 1 of 5');
  await play.locator('.fs-play-hotspot').first().click();
  await expect(play).toContainText('Screen 2 of 5');
  await shot(page, '06-play');
  await page.keyboard.press('Escape');

  // Nothing lost on refresh.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(screens(page)).toHaveCount(10);
  await expect(edges(page)).toHaveCount(8);
});
