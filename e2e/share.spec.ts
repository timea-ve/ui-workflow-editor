import { expect, test } from '@playwright/test';
import { fixtureDoc, publishFixture } from './share.fixture';

test('shared board renders read-only, plays, and is noindex', async ({ page, request }) => {
  const { id } = await publishFixture(request);
  await page.goto(`/s/${id}`);

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

test('revoked link shows a calm message', async ({ page, request }) => {
  const { id, editToken } = await publishFixture(request);
  const del = await request.delete(`/api/shares/${id}`, { headers: { 'x-edit-token': editToken } });
  expect(del.status()).toBe(200);
  await page.goto(`/s/${id}`);
  await expect(page.getByRole('heading', { name: 'This link is no longer active.' })).toBeVisible();
  await expect(page.getByText('Ask the owner for a new link.')).toBeVisible();
});

test('unknown link shows the same message', async ({ page }) => {
  await page.goto('/s/doesNotExist0000000000');
  await expect(page.getByRole('heading', { name: 'This link is no longer active.' })).toBeVisible();
});

test('updating the link shows the latest copy', async ({ page, request }) => {
  const { id, editToken } = await publishFixture(request);
  const put = await request.put(`/api/shares/${id}`, {
    headers: { 'x-edit-token': editToken },
    data: { title: 'Renamed board', doc: fixtureDoc },
  });
  expect(put.status()).toBe(200);
  await page.goto(`/s/${id}`);
  await expect(page.getByText('Renamed board')).toBeVisible();
});

test('empty board says so', async ({ page, request }) => {
  const { id } = await publishFixture(request, { frames: {}, elements: {}, connectors: {}, links: {}, variants: {}, flowNames: {} }, 'Empty');
  await page.goto(`/s/${id}`);
  await expect(page.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();
});

test('server down shows retry', async ({ page }) => {
  let fail = true;
  await page.route('**/api/shares/*', (route) => (fail ? route.abort('failed') : route.continue()));
  await page.goto('/s/aaaaaaaaaaaaaaaaaaaaaa');
  await expect(page.getByRole('alert')).toContainText('Couldn’t load this board');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'This link is no longer active.' })).toBeVisible();
});
