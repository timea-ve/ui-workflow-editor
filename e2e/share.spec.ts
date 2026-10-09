import { expect, test } from '@playwright/test';
import { shareLink } from './share.fixture';

test('shared board renders read-only, plays, and is noindex', async ({ page }) => {
  await page.goto(await shareLink());

  await expect(page.getByText('Checkout e2e')).toBeVisible();
  await expect(page.getByText(/View only · made with/)).toBeVisible();
  await expect(page.locator('.react-flow__node-screen')).toHaveCount(2);
  await expect(page.locator('.react-flow__node-kit')).toHaveCount(3);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('[data-kit-style="clean"]').first()).toBeVisible();

  // Read-only: no connection handles, nodes can't be dragged.
  await expect(page.locator('.fs-readonly .fs-handle').first()).toBeHidden();
  const node = page.locator('.react-flow__node-screen').first();
  const before = await node.getAttribute('style');
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 160, { steps: 5 });
  await page.mouse.up();
  await expect(node).toHaveAttribute('style', before!);

  await page.getByRole('button', { name: 'Zoom to fit' }).click();

  // Play the flow: Home → Details → Back → Exit.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const play = page.getByRole('dialog', { name: /Playing/ });
  await expect(play).toContainText('Home');
  await play.getByRole('button', { name: /go to Details/ }).click();
  await expect(play.locator('.fs-play-bar')).toContainText('Details');
  await play.getByRole('button', { name: '← Back' }).click();
  await expect(play.locator('.fs-play-bar')).toContainText('Home');
  await page.keyboard.press('Escape');
  await expect(play).toBeHidden();
});

test('old server links show a calm message', async ({ page }) => {
  await page.goto('/s/doesNotExist0000000000');
  await expect(page.getByRole('heading', { name: 'This link is no longer active.' })).toBeVisible();
  await expect(page.getByText('Ask the owner for a new link.')).toBeVisible();
});

test('a cut-off or garbled link says it is incomplete', async ({ page }) => {
  const link = await shareLink();
  for (const bad of [link.slice(0, Math.floor(link.length * 0.6)), '/s/v1', '/s/v1#not-a-board']) {
    await page.goto('about:blank');
    await page.goto(bad);
    await expect(page.getByRole('heading', { name: 'This link is incomplete.' })).toBeVisible();
    await expect(page.getByText('ask for a new one')).toBeVisible();
  }
});

test('the link carries its own copy: works with no saved data', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(await shareLink(undefined, 'Fresh copy'));
  await expect(page.getByText('Fresh copy')).toBeVisible();
  await expect(page.locator('.react-flow__node-screen')).toHaveCount(2);
  await context.close();
});

test('empty board says so', async ({ page }) => {
  await page.goto(await shareLink({ frames: {}, elements: {}, connectors: {}, links: {}, variants: {}, flowNames: {} }, 'Empty'));
  await expect(page.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();
});
