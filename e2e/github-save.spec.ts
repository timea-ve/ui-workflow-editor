import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FakeGitHub, GITHUB_BASE_URL, LOGIN, REPO, seedSignedIn } from './github.fixture';

// "Save to GitHub" end to end, against a fake GitHub (see github.fixture.ts). These run on the
// second web server (port 5181), which is built with dummy VITE_GITHUB_* values. The default server
// (5180) has none, so the feature must be invisible there.

test.describe('Save to GitHub (configured)', () => {
  test.use({ baseURL: GITHUB_BASE_URL });

  let gh: FakeGitHub;

  async function fresh(page: Page, opts: { signedIn?: boolean } = {}) {
    gh = new FakeGitHub();
    await gh.install(page);
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('fs:tour:v1', 'seen'); });
    if (opts.signedIn) await seedSignedIn(page);
  }

  const account = (page: Page) => page.getByTestId('github-account');

  test('sign in → connected → a board edit is saved to GitHub', async ({ page }) => {
    await fresh(page);
    await page.reload();
    const signIn = page.getByRole('button', { name: 'Sign in with GitHub' });
    await expect(signIn).toBeVisible();
    await signIn.click();

    // Fake GitHub approves and sends us back through /auth/callback to the dashboard.
    await expect(account(page)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(`${GITHUB_BASE_URL}/`);
    await expect(account(page)).toHaveAccessibleName(`GitHub account: ${LOGIN}`);
    await expect(account(page)).toHaveAttribute('data-phase', 'synced');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fs:github:v1')!).accessToken)).toBe('ghu_test');

    // A new board goes up to GitHub…
    await page.getByTestId('new-board').click();
    await expect(page).toHaveURL(/\/b\//);
    const id = page.url().split('/b/')[1];
    const cloud = page.getByTestId('cloud-status');
    await expect(cloud).toHaveText('Saved to GitHub', { timeout: 15_000 });
    expect(gh.board(id)?.board.title).toBe('Untitled board');

    // …and so does an edit.
    await page.getByRole('button', { name: /^Board title/ }).click();
    const input = page.getByRole('textbox', { name: 'Board title' });
    await input.fill('Checkout flow');
    await input.press('Enter');
    await expect.poll(() => gh.board(id)?.board.title, { timeout: 15_000 }).toBe('Checkout flow');
    await expect(cloud).toHaveText('Saved to GitHub');
    const file = gh.puts.at(-1)!.text;
    expect(file).toContain('\n  "format": "ui-workflow-editor/board"'); // pretty-printed for readable diffs
  });

  test('a board saved from another device appears on the dashboard', async ({ page }) => {
    await fresh(page, { signedIn: true });
    gh.addBoard({ id: 'remoteBoard01', title: 'Made on my laptop', screen: 'Welcome' });
    await page.reload();
    const card = page.getByRole('link', { name: /Made on my laptop/ });
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await expect(page).toHaveURL(/\/b\/remoteBoard01$/);
    await expect(page.locator('.react-flow__node-screen')).toHaveCount(1);
    await expect(page.getByTestId('cloud-status')).toHaveText('Saved to GitHub');
  });

  test('sign out keeps every board on this device (and on GitHub)', async ({ page }) => {
    await fresh(page, { signedIn: true });
    gh.addBoard({ id: 'remoteBoard02', title: 'Synced board' });
    await page.reload();
    await expect(page.getByRole('link', { name: /Synced board/ })).toBeVisible({ timeout: 10_000 });
    await expect(account(page)).toHaveAttribute('data-phase', 'synced');

    await account(page).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible();
    await expect(page.getByText('Signed out of GitHub. Your boards are still here.')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('fs:github:v1'))).toBeNull();
    await expect(page.getByRole('link', { name: /Synced board/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: /Synced board/ })).toBeVisible();
    expect(gh.files.has('remoteBoard02')).toBe(true);
    expect(gh.deletes).toEqual([]);
  });

  test('asks where to save when the app has no access to the repo yet', async ({ page }) => {
    await fresh(page, { signedIn: true });
    gh.installed = false;
    await page.reload();
    const panel = page.getByTestId('github-setup');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByRole('link', { name: /Create the repository/ })).toHaveAttribute('href', /github\.com\/new\?name=ui-workflow-boards&visibility=private/);
    await expect(panel.getByRole('link', { name: 'Give access' })).toHaveAttribute('href', 'https://github.com/apps/test-app/installations/new');
    gh.installed = true;
    await panel.getByRole('button', { name: 'Check again' }).click();
    await expect(panel).toBeHidden();
    await expect(account(page)).toHaveAttribute('data-phase', 'synced');
  });

  test('boards made before connecting are uploaded right after "Give access"', async ({ page }) => {
    await fresh(page);
    await page.reload();
    await page.getByTestId('new-board').click();
    await expect(page).toHaveURL(/\/b\//);
    const id = page.url().split('/b/')[1];
    await page.goto('/');

    gh.installed = false;
    await page.getByRole('button', { name: 'Sign in with GitHub' }).click();
    const panel = page.getByTestId('github-setup');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // GitHub's install page: grant the repo, then come back with a code and no state.
    await page.route('https://github.com/apps/**', (route) => {
      gh.installed = true;
      const back = `${GITHUB_BASE_URL}/auth/callback?code=test-code&installation_id=7&setup_action=install`;
      return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(back)})</script>` });
    });
    await panel.getByRole('link', { name: 'Give access' }).click();
    await expect(account(page)).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => gh.board(id)?.board.title, { timeout: 15_000 }).toBe('Untitled board');
    await expect(account(page)).toHaveAttribute('data-phase', 'synced');
  });

  test('a cancelled sign-in is explained calmly', async ({ page }) => {
    await fresh(page);
    await page.goto('/auth/callback?error=access_denied&state=x');
    await expect(page.getByRole('heading', { name: 'Sign-in cancelled' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to your boards' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible();
  });

  test('axe: dashboard with the GitHub menu open', async ({ page }) => {
    await fresh(page, { signedIn: true });
    gh.addBoard({ id: 'remoteBoard03', title: 'Axe board' });
    await page.reload();
    await expect(account(page)).toHaveAttribute('data-phase', 'synced', { timeout: 10_000 });
    await account(page).focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: `Saved to github.com/${LOGIN}/${REPO}` })).toHaveAttribute('href', `https://github.com/${LOGIN}/${REPO}`);
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(account(page)).toBeFocused();
  });
});

test('without GitHub settings the feature is hidden', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('new-board')).toBeVisible();
  await expect(page.getByTestId('github-sign-in')).toHaveCount(0);
  await expect(page.getByTestId('github-account')).toHaveCount(0);
  await page.getByTestId('new-board').click();
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.getByTestId('cloud-status')).toHaveCount(0);
});
