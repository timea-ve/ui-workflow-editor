import { expect, test, type Page } from '@playwright/test';

// Dashboard e2e. The editor at /b/:id is built in parallel (Canvas Core), so these tests only
// assert the URL there and come back to the dashboard.

const BOARD_URL = /\/b\/[\w-]{6,}$/;

async function freshDashboard(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function seedBoards(page: Page, titles: string[]) {
  await page.evaluate((ts) => {
    const now = Date.now();
    const all = Object.fromEntries(ts.map((title, i) => {
      const id = `seed${i}abcdef`;
      return [id, { id, title, schemaVersion: 1, createdAt: now - i * 60_000, updatedAt: now - i * 60_000 }];
    }));
    localStorage.setItem('fs:boards:v1', JSON.stringify(all));
  }, titles);
  await page.reload();
}

async function hasStoredContent(page: Page, boardId: string) {
  return page.evaluate(async (id) => (await indexedDB.databases()).some((d) => d.name === `fs-board-${id}`), boardId);
}

test.beforeEach(async ({ page }) => {
  await freshDashboard(page);
});

test('empty dashboard shows a welcome, New board and all templates', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Sketch your first flow' })).toBeVisible();
  await expect(page.getByTestId('new-board')).toBeVisible();
  for (const id of ['signup', 'onboarding', 'checkout', 'settings', 'search']) {
    await expect(page.getByTestId(`template-${id}`)).toBeVisible();
  }
  await expect(page.locator('[data-kit-style="clean"]').first()).toBeVisible();
});

test('New board opens /b/:id and the board is listed after going back', async ({ page }) => {
  await page.getByTestId('new-board').click();
  await expect(page).toHaveURL(BOARD_URL);
  const id = page.url().split('/b/')[1];
  expect(await hasStoredContent(page, id)).toBe(true);
  await page.goBack();
  await expect(page.getByRole('link', { name: /Untitled board/ })).toHaveAttribute('href', `/b/${id}`);
  await expect(page.getByText('Edited just now')).toBeVisible();
});

test('N on the dashboard creates a board', async ({ page }) => {
  await page.keyboard.press('n');
  await expect(page).toHaveURL(BOARD_URL);
});

test('a template creates a seeded board and opens it', async ({ page }) => {
  await page.getByTestId('template-checkout').click();
  await expect(page).toHaveURL(BOARD_URL);
  const id = page.url().split('/b/')[1];
  expect(await hasStoredContent(page, id)).toBe(true);
  await page.goBack();
  await expect(page.getByRole('link', { name: /Checkout/ })).toBeVisible();
});

test('search filters boards by name', async ({ page }) => {
  await seedBoards(page, ['Checkout ideas', 'Login v2', 'Settings revamp']);
  await page.getByRole('searchbox', { name: 'Search boards' }).fill('log');
  await expect(page.getByTestId('board-card')).toHaveCount(1);
  await expect(page.getByText('Login v2')).toBeVisible();
});

test('rename a board inline from the menu (keyboard only)', async ({ page }) => {
  await seedBoards(page, ['Roadmap']);
  const menu = page.getByRole('button', { name: 'Options for Roadmap' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: /Rename/ }).focus();
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Board name' });
  await expect(input).toBeFocused();
  await input.fill('Roadmap 2027');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: /Roadmap 2027/ })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('link', { name: /Roadmap 2027/ })).toBeVisible();
});

test('delete a board, then undo', async ({ page }) => {
  await seedBoards(page, ['Keep me', 'Other']);
  await page.getByRole('button', { name: 'Options for Keep me' }).click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(page.getByRole('link', { name: /Keep me/ })).toHaveCount(0);
  await expect(page.getByText('“Keep me” deleted')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /Keep me/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: /Keep me/ })).toBeVisible();
});

test('duplicate a template board', async ({ page }) => {
  await page.getByTestId('template-signup').click();
  await expect(page).toHaveURL(BOARD_URL);
  await page.goBack();
  await page.getByRole('button', { name: 'Options for Sign-up' }).click();
  await page.getByRole('menuitem', { name: /Duplicate/ }).click();
  await expect(page.getByRole('link', { name: /Copy of Sign-up/ })).toBeVisible();
  const href = await page.getByRole('link', { name: /Copy of Sign-up/ }).getAttribute('href');
  expect(await hasStoredContent(page, href!.split('/b/')[1])).toBe(true);
});

test('board cards are reachable and open with the keyboard', async ({ page }) => {
  await seedBoards(page, ['Alpha']);
  const link = page.getByRole('link', { name: /Alpha/ });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/b\/seed0abcdef$/);
});

test('layout holds at 768px wide', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await seedBoards(page, ['Alpha', 'Beta']);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await expect(page.getByTestId('new-board')).toBeVisible();
});

test('no WCAG A/AA violations (empty and list states)', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const scan = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect((await scan()).violations).toEqual([]);
  await seedBoards(page, ['Alpha', 'Beta']);
  expect((await scan()).violations).toEqual([]);
});
