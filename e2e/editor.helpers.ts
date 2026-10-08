import { expect, type Page } from '@playwright/test';

export const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Seeds a board metadata row (content starts empty) and opens the editor. */
export async function openSeededBoard(page: Page, id: string, title = 'E2E board') {
  await page.goto('/');
  await page.evaluate(({ id, title }) => {
    const now = Date.now();
    localStorage.setItem('fs:boards:v1', JSON.stringify({ [id]: { id, title, schemaVersion: 1, createdAt: now, updatedAt: now } }));
  }, { id, title });
  await page.goto(`/b/${id}`);
  await expect(page.locator('.react-flow')).toBeVisible();
}

export const screens = (page: Page) => page.locator('.react-flow__node-screen');
export const edges = (page: Page) => page.locator('.react-flow__edge');

/** Clicks an empty canvas point (client coords relative to the canvas). */
export async function canvasBox(page: Page) {
  const box = await page.locator('.fse-canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  return box;
}

export async function waitSaved(page: Page) {
  await expect(page.locator('.fsc-status')).toContainText(/saved/i, { timeout: 5000 });
}

export const announcer = (page: Page) => page.locator('.fse-editor .fsc-sr-only[role=status]');
