import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MOD, openSeededBoard } from './editor.helpers';
import { shareLink } from './share.fixture';

// WCAG 2.1 A/AA (incl. color-contrast) on every main surface and every dialog.
//
// Nothing is excluded except React Flow's minimap (not rendered; kept as a guard). Board content inside
// screens is scanned too. Axe can't measure contrast for text over the canvas's SVG sketch strokes and
// reports those as "incomplete" (needs review), not as violations; token pairs are covered by
// src/design/contrast.test.ts.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page) {
  // Let open/fade-in animations finish: half-faded text would be a false contrast failure.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
    .map((a) => a.finished.catch(() => undefined))));
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude('.react-flow__minimap').analyze();
  return violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 5).map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n').slice(1).join(' ')}`) }));
}

async function openTemplate(page: Page, id = 'signup') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId(`template-${id}`).click();
  await expect(page).toHaveURL(/\/b\//);
  await expect(page.locator('.fse-editor .react-flow__node-screen').first()).toBeVisible();
  await page.waitForTimeout(400);
}

test('dashboard: empty, with boards', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('new-board')).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.getByTestId('template-checkout').click();
  await expect(page).toHaveURL(/\/b\//);
  await page.goBack();
  await expect(page.getByTestId('board-card').first()).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('editor: empty board', async ({ page }) => {
  await openSeededBoard(page, `axe-empty-${Date.now().toString(36)}`);
  expect(await scan(page)).toEqual([]);
});

test('editor: template board, selection + context bar', async ({ page }) => {
  await openTemplate(page);
  expect(await scan(page)).toEqual([]);
  await page.locator('.fse-editor .react-flow__node-kit').first().click();
  await expect(page.locator('.fse-editor .react-flow__node-kit.selected')).toHaveCount(1);
  expect(await scan(page)).toEqual([]);
});

test('editor dialogs: insert, export, shortcuts', async ({ page }) => {
  await openTemplate(page);
  await page.locator('.fse-editor .react-flow__node-screen').first().click({ position: { x: 10, y: 10 } });

  await page.keyboard.press('/');
  await expect(page.getByRole('combobox')).toBeFocused();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.keyboard.press(`${MOD}+Shift+E`);
  await expect(page.getByRole('dialog', { name: /Export/ })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.keyboard.press('Shift+?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');
});

test('editor: link picker, play and compare', async ({ page }) => {
  await openTemplate(page);
  // Link picker on a fresh button in the first screen.
  await page.locator('.fse-editor .react-flow__node-screen').first().click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('/');
  await page.keyboard.type('button');
  await page.keyboard.press('Enter');
  await page.keyboard.press('l');
  await expect(page.getByRole('listbox', { name: 'Screens' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('.fse-editor .react-flow__node-screen').first().click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('p');
  await expect(page.getByRole('dialog', { name: /^Playing/ })).toBeVisible();
  await page.waitForTimeout(300);
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.keyboard.press('Shift+D');
  await expect(page.locator('.fs-lane-chip')).toHaveCount(2);
  await page.keyboard.press('Shift+C');
  await expect(page.getByRole('dialog', { name: /^Compare options/ })).toBeVisible();
  await page.waitForTimeout(300);
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');
});

test('share page and its share popover', async ({ page }) => {
  await page.goto(await shareLink());
  await expect(page.locator('.react-flow__node-screen').first()).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.getByRole('button', { name: 'Export PNG' }).click();
  await expect(page.getByRole('dialog', { name: /Export/ })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Playing/ })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('editor: share popover', async ({ page }) => {
  await openTemplate(page);
  await page.getByRole('button', { name: /^Share/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
