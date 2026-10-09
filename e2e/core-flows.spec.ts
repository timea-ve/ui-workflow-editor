import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { MOD } from './editor.helpers';

// Core-flow gaps found in the Phase 4 test review: export from the editor, share from the editor,
// the on-canvas undo/redo buttons, and every starter template opening and playing.

const TEMPLATES = ['signup', 'onboarding', 'checkout', 'settings', 'search'];
const screens = (page: Page) => page.locator('.fse-editor .react-flow__node-screen');

async function openTemplate(page: Page, id: string) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId(`template-${id}`).click();
  await expect(page).toHaveURL(/\/b\//);
  await expect(screens(page).first()).toBeVisible();
}

for (const id of TEMPLATES) {
  test(`template "${id}" opens with linked screens and plays`, async ({ page }) => {
    await openTemplate(page, id);
    expect(await screens(page).count()).toBeGreaterThan(1);
    expect(await page.locator('.fse-editor .react-flow__edge').count()).toBeGreaterThan(0);
    await page.keyboard.press('p');
    const play = page.getByRole('dialog', { name: /^Playing/ });
    await expect(play).toBeVisible();
    const hotspots = play.locator('.fs-play-hotspot');
    await expect(hotspots.first()).toBeVisible();
    const from = await page.getByTestId('play-screen').getAttribute('data-frame-id');
    await hotspots.first().click();
    await expect(page.getByTestId('play-screen')).not.toHaveAttribute('data-frame-id', from!);
    await page.keyboard.press('Escape');
    await expect(play).toBeHidden();
  });
}

test('export PNG and PDF from the editor', async ({ page }) => {
  await openTemplate(page, 'checkout');
  for (const format of ['PNG', 'PDF'] as const) {
    await page.keyboard.press(`${MOD}+Shift+E`);
    const dialog = page.getByRole('dialog', { name: /Export/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: format === 'PDF' ? 'Document (PDF)' : /PNG/ }).check();
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export', exact: true }).click();
    const d = await download;
    const bytes = await readFile((await d.path())!);
    expect(d.suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
    if (format === 'PNG') expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    else expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(10_000);
    await expect(dialog).toBeHidden();
  }
});

test('share from the editor: the link opens a read-only copy', async ({ page, browser }) => {
  await openTemplate(page, 'signup');
  const count = await screens(page).count();
  await page.locator('.fsc-topbar').getByRole('button', { name: /^Share/ }).click();
  const pop = page.getByRole('dialog', { name: 'Share' });
  await expect(pop).toBeVisible();
  await pop.getByRole('switch').click();
  const url = pop.getByRole('textbox', { name: 'Share link' });
  await expect(url).toHaveValue(/\/s\/v1#[\w-]+$/, { timeout: 10_000 });
  const link = await url.inputValue();

  // A fresh browser (no saved boards): the link itself carries the copy.
  const fresh = await browser.newContext();
  const viewer = await fresh.newPage();
  await viewer.goto(link);
  await expect(viewer.locator('.react-flow__node-screen')).toHaveCount(count);
  await expect(viewer.locator('.fs-readonly .fs-handle').first()).toBeHidden();
  await expect(viewer.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await viewer.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(viewer.getByRole('dialog', { name: /Playing/ })).toBeVisible();
  await fresh.close();
});

test('undo / redo buttons on the board', async ({ page }) => {
  await openTemplate(page, 'search');
  const undo = page.getByRole('group', { name: 'History' }).getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('group', { name: 'History' }).getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();
  const count = await screens(page).count();
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await expect(screens(page)).toHaveCount(count + 1);
  await undo.click();
  await expect(screens(page)).toHaveCount(count);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(screens(page)).toHaveCount(count + 1);
});
