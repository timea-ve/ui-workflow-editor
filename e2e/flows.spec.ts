import { expect, test, type Locator, type Page } from '@playwright/test';
import { MOD, canvasBox, edges, openSeededBoard, screens } from './editor.helpers';

const kitNodes = (page: Page) => page.locator('.fse-editor .react-flow__node-kit');
const picker = (page: Page) => page.locator('.fs-link-picker');
const play = (page: Page) => page.getByRole('dialog', { name: /^Playing/ });
const playScreen = (page: Page) => page.getByTestId('play-screen');
const compare = (page: Page) => page.getByRole('dialog', { name: /^Compare options/ });

async function freshBoard(page: Page, zoomOut = 3) {
  await openSeededBoard(page, `e2e-flows-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  for (let i = 0; i < zoomOut; i++) await page.keyboard.press(`${MOD}+Minus`);
  await page.waitForTimeout(250);
}

/** Mobile screen at a canvas point (default: right of the last screen), with a button inside when asked. */
async function addScreen(page: Page, at: { x: number; y: number } | null, withButton: boolean) {
  const before = await screens(page).count();
  if (!at) {
    const box = await canvasBox(page);
    let last = (await screens(page).nth(before - 1).boundingBox())!;
    while (last.x + last.width * 2.4 > box.x + box.width) {
      await page.keyboard.press(`${MOD}+Minus`);
      await page.waitForTimeout(250);
      last = (await screens(page).nth(before - 1).boundingBox())!;
    }
    at = { x: last.x + last.width * 1.7, y: last.y + last.height / 2 };
  }
  await page.keyboard.press('f');
  await page.keyboard.press('1');
  await page.mouse.click(at.x, at.y);
  await expect(screens(page)).toHaveCount(before + 1);
  if (!withButton) return;
  const kits = await kitNodes(page).count();
  await page.keyboard.press('/');
  await page.keyboard.type('button');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(kits + 1);
}

/** Select a kit element and open the link picker with L. */
async function linkWithL(page: Page, kit: Locator) {
  await kit.click();
  await expect(kit).toHaveClass(/selected/);
  await page.keyboard.press('l');
  await expect(picker(page)).toBeVisible();
}

/** Click an empty strip of a screen (its lower part, under any content). */
async function clickScreenBody(page: Page, screen: Locator) {
  const b = (await screen.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.8);
}

const frameIdOf = (screen: Locator) => screen.getAttribute('data-id');

test('link button → screen 2 → screen 3 with L + click, then Play forward and back', async ({ page }) => {
  await freshBoard(page);
  const box = await canvasBox(page);
  const y = box.y + box.height / 2;
  await addScreen(page, { x: box.x + box.width * 0.2, y }, true);
  await addScreen(page, null, true);
  await addScreen(page, null, false);
  const [s1, s2, s3] = [screens(page).nth(0), screens(page).nth(1), screens(page).nth(2)];
  const [id1, id2, id3] = await Promise.all([frameIdOf(s1), frameIdOf(s2), frameIdOf(s3)]);

  // Button in screen 1 → L → click screen 2.
  await linkWithL(page, kitNodes(page).nth(0));
  await clickScreenBody(page, s2);
  await expect(picker(page)).toBeHidden();
  await expect(edges(page)).toHaveCount(1);
  await expect(page.locator(`.fs-sketch-edge[data-target="${id2}"]`)).toHaveCount(1);

  // Button in screen 2 → L → click screen 3.
  await linkWithL(page, kitNodes(page).nth(1));
  await clickScreenBody(page, s3);
  await expect(edges(page)).toHaveCount(2);
  await expect(page.locator(`.fs-sketch-edge[data-target="${id3}"]`)).toHaveCount(1);

  // Esc cancels the picker without linking.
  await linkWithL(page, kitNodes(page).nth(0));
  await page.keyboard.press('Escape');
  await expect(picker(page)).toBeHidden();
  await expect(edges(page)).toHaveCount(2);

  // Play from the top-bar button: starts at screen 1 of the flow.
  await clickScreenBody(page, s1);
  await page.getByTestId('play-button').click();
  await expect(play(page)).toBeVisible();
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id1!);
  await expect(play(page)).toContainText('Screen 1 of 3');

  // Clicking outside a hotspot flashes a hint, but doesn't navigate.
  const ps = (await playScreen(page).boundingBox())!;
  await page.mouse.click(ps.x + ps.width / 2, ps.y + 10);
  await expect(play(page)).toContainText('Click a highlighted item');
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id1!);

  await play(page).locator('.fs-play-hotspot').click();
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id2!);
  await expect(play(page)).toContainText('Screen 2 of 3');
  await play(page).locator('.fs-play-hotspot').click();
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id3!);
  await expect(play(page)).toContainText('End of this path');

  await page.keyboard.press('ArrowLeft');
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id2!);
  await page.keyboard.press('r');
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id1!);
  await page.keyboard.press('ArrowRight');
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id2!);

  // Esc exits to the editor with the current screen selected.
  await page.keyboard.press('Escape');
  await expect(play(page)).toBeHidden();
  await expect(s2).toHaveClass(/selected/);
});

test('duplicate as Option B, rename it, Compare opens synced panes', async ({ page }) => {
  await freshBoard(page);
  const box = await canvasBox(page);
  const y = box.y + box.height * 0.3;
  await addScreen(page, { x: box.x + box.width * 0.2, y }, true);
  await addScreen(page, null, false);
  await linkWithL(page, kitNodes(page).nth(0));
  await clickScreenBody(page, screens(page).nth(1));
  await expect(edges(page)).toHaveCount(1);

  // Compare is disabled until there are 2 options.
  await expect(page.getByTestId('compare-button')).toHaveAttribute('aria-disabled', 'true');

  await clickScreenBody(page, screens(page).nth(0));
  await page.keyboard.press('Shift+D');
  await expect(screens(page)).toHaveCount(4);
  const lanes = page.locator('.fs-lane-chip');
  await expect(lanes).toHaveCount(2);
  await expect(lanes.nth(0)).toContainText('Option A');
  await expect(lanes.nth(1)).toContainText('Option B');

  // Rename Option B inline on its lane (double-click). The first click zooms to
  // Option B, which can cull Option A's lane off-screen, so locate by name, not index.
  const laneB = lanes.filter({ hasText: 'Option B' });
  await laneB.locator('.fs-lane-chip-label').dblclick();
  const input = page.getByRole('textbox', { name: 'Option name' });
  await input.fill('Option B – short form');
  await input.press('Enter');
  await expect(laneB).toContainText('Option B – short form');

  // The flows panel lists the flow with both options; rename the flow there.
  const panel = page.getByRole('region', { name: 'Flows' });
  if ((await panel.getByRole('button', { name: 'Flows' }).getAttribute('aria-expanded')) !== 'true') {
    await panel.getByRole('button', { name: 'Flows' }).click();
  }
  await expect(panel).toContainText('Option B – short form');
  await panel.getByRole('button', { name: /^Rename .* flow$/ }).first().click();
  const flowName = panel.getByRole('textbox', { name: 'Flow name' });
  await flowName.fill('Sign-up test');
  await flowName.press('Enter');
  await expect(panel).toContainText('Sign-up test');

  // Compare: two read-only panes; panning the left pane moves the right one the same way.
  await expect(page.getByTestId('compare-button')).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('compare-button').click();
  await expect(compare(page)).toBeVisible();
  const left = compare(page).locator('[data-side="left"]');
  const right = compare(page).locator('[data-side="right"]');
  await expect(left.locator('.react-flow__node-screen')).toHaveCount(2);
  await expect(right.locator('.react-flow__node-screen')).toHaveCount(2);
  await expect(compare(page).getByRole('radio', { name: 'Option B – short form' }).last()).toHaveAttribute('aria-checked', 'true');

  const transform = (pane: Locator) => pane.locator('.react-flow__viewport').evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
  await page.waitForTimeout(300);
  const l0 = await transform(left);
  const r0 = await transform(right);
  expect(r0.zoom).toBeCloseTo(l0.zoom, 3);

  const lb = (await left.boundingBox())!;
  await page.mouse.move(lb.x + 20, lb.y + 20);
  await page.mouse.down();
  await page.mouse.move(lb.x + 140, lb.y + 80, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const l1 = await transform(left);
  const r1 = await transform(right);
  expect(Math.abs(l1.x - l0.x)).toBeGreaterThan(50);
  expect(r1.x - r0.x).toBeCloseTo(l1.x - l0.x, 0);
  expect(r1.y - r0.y).toBeCloseTo(l1.y - l0.y, 0);

  await page.keyboard.press('Escape');
  await expect(compare(page)).toBeHidden();
});

test('keyboard only: link to a new screen, link back from a list, play through', async ({ page }) => {
  await freshBoard(page, 2);
  await page.keyboard.press('f');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(screens(page)).toHaveCount(1);
  const id1 = await frameIdOf(screens(page).nth(0));
  await page.keyboard.press('/');
  await page.keyboard.type('button');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(1);

  // L → "New screen" (first in the list) → Enter: a linked screen appears on the right and is selected.
  await page.keyboard.press('l');
  const list = page.getByRole('listbox', { name: 'Screens' });
  await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(screens(page)).toHaveCount(2);
  await expect(edges(page)).toHaveCount(1);
  const id2 = await page.locator('.fse-editor .react-flow__node-screen.selected').getAttribute('data-id');
  expect(id2).not.toBe(id1);

  // Screen 2: add a button and link it back to screen 1 from the list (search + Enter).
  await page.keyboard.press('/');
  await page.keyboard.type('button');
  await page.keyboard.press('Enter');
  await expect(kitNodes(page)).toHaveCount(2);
  await page.keyboard.press('l');
  await page.keyboard.type('Screen 1');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(edges(page)).toHaveCount(2);
  await expect(page.locator(`.fs-sketch-edge[data-target="${id1}"]`)).toHaveCount(1);

  // P plays from the flow's start; Tab + Enter follows a hotspot; Backspace goes back; Esc exits.
  await page.keyboard.press('p');
  await expect(play(page)).toBeVisible();
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id1!);
  await page.keyboard.press('Tab');
  await expect(play(page).locator('.fs-play-hotspot')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id2!);
  await page.keyboard.press('Backspace');
  await expect(playScreen(page)).toHaveAttribute('data-frame-id', id1!);
  await page.keyboard.press('Escape');
  await expect(play(page)).toBeHidden();
  await expect(page.locator(`.fse-editor .react-flow__node-screen[data-id="${id1}"]`)).toHaveClass(/selected/);
});

test('Sign-up template: the "Try again" link does not run through its own screen', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('template-signup').click();
  await expect(page).toHaveURL(/\/b\//);
  const retry = page.locator('.fse-editor .react-flow__node-kit').filter({ hasText: 'Try again' }).first();
  await expect(retry).toBeAttached();
  const retryId = await retry.getAttribute('data-id');
  const taken = page.locator('.fse-editor .react-flow__node-screen').filter({ hasText: 'Email taken' }).first();

  const result = await page.evaluate(({ retryId, takenId }) => {
    const g = document.querySelector(`.fs-sketch-edge[data-source="${retryId}"]`);
    const d = g?.closest('.react-flow__edge')?.querySelector('path.react-flow__edge-path')?.getAttribute('d') ?? '';
    const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${takenId}"]`)!;
    const m = new DOMMatrix(getComputedStyle(node).transform);
    const rect = { x: m.e, y: m.f, w: node.offsetWidth, h: node.offsetHeight };
    const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    // Length of the path inside the source frame (sampled every 2 units).
    let inside = 0;
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(len / 2));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = a[0] + (b[0] - a[0]) * t; const y = a[1] + (b[1] - a[1]) * t;
        if (x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h) inside += len / n;
      }
    }
    return { d, inside, rect };
  }, { retryId, takenId: await taken.getAttribute('data-id') });
  expect(result.d).not.toBe('');
  // Only the short stub from the button to the frame's edge may sit inside the frame.
  expect(result.inside).toBeLessThan(80);
});
