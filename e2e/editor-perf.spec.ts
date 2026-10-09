import { expect, test } from '@playwright/test';
import { screens } from './editor.helpers';

// Measurement: a PerformanceObserver collects 'longtask' entries (main-thread tasks > 50ms) and a rAF
// loop records frame intervals while we drag one screen in a 60-screen board (all visible after
// fit-to-view, the worst case). We assert no task > 200ms during the drag and a sane median frame.
// Headless Chromium on CI is slower than a real laptop, so thresholds are deliberately loose.
test('dragging a screen on a 60-screen board stays smooth', async ({ page }) => {
  await page.goto('/b/perf-60');
  await expect(screens(page).first()).toBeVisible();
  await expect.poll(() => screens(page).count()).toBeGreaterThanOrEqual(50);
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const w = window as unknown as { __perf: { longTasks: number[]; frames: number[]; stop: boolean } };
    w.__perf = { longTasks: [], frames: [], stop: false };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__perf.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: false });
    let last = performance.now();
    const tick = (t: number) => {
      w.__perf.frames.push(t - last);
      last = t;
      if (!w.__perf.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const target = screens(page).filter({ hasText: 'Screen 12' }).first();
  const box = (await target.boundingBox())!;
  // An empty strip of the screen (between the card and the button), so we drag the screen itself.
  const start = { x: box.x + box.width / 2, y: box.y + box.height * 0.74 };
  const before = await target.evaluate((el) => (el as HTMLElement).style.transform);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(start.x + i * 6, start.y + i * 3);
  await page.mouse.up();
  await page.waitForTimeout(300);

  const perf = await page.evaluate(() => {
    const w = window as unknown as { __perf: { longTasks: number[]; frames: number[]; stop: boolean } };
    w.__perf.stop = true;
    const f = [...w.__perf.frames].sort((a, b) => a - b);
    return { longTasks: w.__perf.longTasks, medianFrame: f[Math.floor(f.length / 2)], frames: f.length };
  });
  console.log(`perf-60 drag: longTasks=${JSON.stringify(perf.longTasks.map(Math.round))} medianFrame=${perf.medianFrame.toFixed(1)}ms frames=${perf.frames}`);

  expect(await target.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
  expect(Math.max(0, ...perf.longTasks)).toBeLessThan(200);
  expect(perf.medianFrame).toBeLessThan(50);
});

type PerfWindow = Window & { __perf: { longTasks: number[]; frames: number[]; stop: boolean } };

async function startPerf(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const w = window as unknown as PerfWindow;
    w.__perf = { longTasks: [], frames: [], stop: false };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__perf.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: false });
    let last = performance.now();
    const tick = (t: number) => {
      w.__perf.frames.push(t - last);
      last = t;
      if (!w.__perf.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopPerf(page: import('@playwright/test').Page, label: string) {
  const perf = await page.evaluate(() => {
    const w = window as unknown as PerfWindow;
    w.__perf.stop = true;
    const f = [...w.__perf.frames].sort((a, b) => a - b);
    return { longTasks: w.__perf.longTasks, medianFrame: f[Math.floor(f.length / 2)], frames: f.length };
  });
  console.log(`${label}: longTasks=${JSON.stringify(perf.longTasks.map(Math.round))} medianFrame=${perf.medianFrame.toFixed(1)}ms frames=${perf.frames}`);
  return perf;
}

// The connector stress board (src/editor/fixtures/stress.ts): 60 screens × 10 elements and 80+ elbow
// connectors that cross and share sides. Lines are rerouted once, when the drag ends, so we allow one
// longer task for the drop; the frames during drag/pan/zoom must stay smooth. Measured on a laptop
// (dev server): ~60 fps, drop task ~70 ms. See docs/phase-4/performance.md.
test('connector stress board: drag, pan and zoom stay smooth', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fs:tour:v1', 'seen'));
  await page.goto('/b/perf-stress');
  await expect(screens(page).first()).toBeVisible();
  await expect.poll(() => screens(page).count()).toBeGreaterThanOrEqual(50);
  await expect.poll(() => page.locator('.fs-sketch-edge').count()).toBeGreaterThanOrEqual(80);
  await page.waitForTimeout(500);

  const edgePaths = () => page.locator('.react-flow__edge-path').evaluateAll((els) => els.map((e) => e.getAttribute('d')).join('|'));
  const pathsBefore = await edgePaths();

  await startPerf(page);
  const target = screens(page).filter({ hasText: 'Screen 34' }).first();
  const box = (await target.boundingBox())!;
  // The empty strip between the checkbox and the Skip button grabs the screen itself.
  const start = { x: box.x + box.width / 2, y: box.y + box.height * 0.7 };
  const before = await target.evaluate((el) => (el as HTMLElement).style.transform);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(start.x + i * 5, start.y + i * 3);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const drag = await stopPerf(page, 'perf-stress drag');
  expect(await target.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
  // Lines attached to the moved screen were rerouted.
  await expect.poll(edgePaths).not.toBe(pathsBefore);
  expect(drag.medianFrame).toBeLessThan(50);
  expect(Math.max(0, ...drag.longTasks)).toBeLessThan(400);

  const canvas = (await page.locator('.react-flow').boundingBox())!;
  await startPerf(page);
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  for (let i = 0; i < 30; i++) await page.mouse.wheel(15, 10);
  await page.keyboard.down('Control');
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -20);
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 20);
  await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  const nav = await stopPerf(page, 'perf-stress pan+zoom');
  expect(nav.medianFrame).toBeLessThan(50);
  expect(Math.max(0, ...nav.longTasks)).toBeLessThan(400);
});
