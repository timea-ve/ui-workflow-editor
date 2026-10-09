import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { encodeFlowSpec, flowLinkPath } from '../src/platform/flowLink';

// Flow links made by Copilot (`npm run flow`): `/new/v1#<spec>` builds a NEW editable board.

const screens = (page: import('@playwright/test').Page) => page.locator('.fse-editor .react-flow__node-screen');

async function exampleLink(): Promise<string> {
  const spec = JSON.parse(await readFile('flows/password-reset.json', 'utf8'));
  return `/${flowLinkPath(await encodeFlowSpec(spec))}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('a flow link opens as a new editable board that plays', async ({ page }) => {
  await page.goto(await exampleLink());
  await expect(page).toHaveURL(/\/b\/[\w-]{6,}$/);
  await expect(screens(page)).toHaveCount(4);
  await expect(page.locator('.fse-editor .react-flow__node-screen', { hasText: 'Reset password' }).first()).toBeVisible();

  // Play follows the "Forgot password?" goTo, then "Send reset link" through the decision's yes path.
  await page.keyboard.press('p');
  const play = page.getByRole('dialog', { name: /^Playing/ });
  await expect(play.locator('.fs-play-bar')).toContainText('Log in');
  await play.getByRole('button', { name: /go to Reset password/ }).click();
  await expect(play.locator('.fs-play-bar')).toContainText('Reset password');
  await play.getByRole('button', { name: /go to Check your inbox/ }).click();
  await expect(play.locator('.fs-play-bar')).toContainText('Check your inbox');
  await page.keyboard.press('Escape');
  await expect(play).toBeHidden();

  // The board is on the dashboard, once (StrictMode's double effect doesn't import twice).
  await page.goto('/');
  await expect(page.getByTestId('board-card')).toHaveCount(1);
  await expect(page.getByTestId('board-card')).toContainText('Password reset');
});

test('a broken flow link shows a calm message', async ({ page }) => {
  const link = await exampleLink();
  for (const bad of [link.slice(0, Math.floor(link.length * 0.6)), '/new/v1', '/new/v2#abc', '/new/v1#not-a-flow']) {
    await page.goto('about:blank');
    await page.goto(bad);
    await expect(page.getByRole('heading', { name: 'This flow link is incomplete' })).toBeVisible();
    await expect(page.getByText('Ask Copilot for a new one.')).toBeVisible();
  }
  // A readable spec with mistakes lists them for Copilot.
  await page.goto('about:blank');
  await page.goto(`/${flowLinkPath(await encodeFlowSpec({ name: 'x', screens: [{ id: 'a', components: [{ type: 'button', goTo: 'zzz' }] }] }))}`);
  await page.getByText('What’s wrong (for Copilot)').click();
  await expect(page.getByText(/"goTo" "zzz" doesn't match/)).toBeVisible();
  await page.getByRole('link', { name: 'Back to your boards' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('board-card')).toHaveCount(0);
});
