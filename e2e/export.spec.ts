import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { publishFixture } from './share.fixture';

async function exportAs(page: Page, format: 'PNG' | 'PDF') {
  const dialog = page.getByRole('dialog', { name: /Export/ });
  await expect(dialog).toBeVisible();
  if (format === 'PDF') await dialog.getByRole('radio', { name: 'Document (PDF)' }).check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  const d = await download;
  const path = await d.path();
  const bytes = await readFile(path!);
  return { name: d.suggestedFilename(), bytes };
}

test('exports the shared board as PNG', async ({ page, request }) => {
  const { id } = await publishFixture(request);
  await page.goto(`/s/${id}`);
  await page.getByRole('button', { name: 'Export PNG' }).click();
  // The share view offers PNG only.
  await expect(page.getByRole('radio', { name: 'Document (PDF)' })).toHaveCount(0);
  const { name, bytes } = await exportAs(page, 'PNG');
  expect(name).toBe('Checkout e2e – Whole board.png');
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.length).toBeGreaterThan(10_000);
  // 2× pixel ratio: width = (content + 2×48 margin) × 2.
  const width = bytes.readUInt32BE(16);
  expect(width).toBeGreaterThan(1500);
  await expect(page.getByText(/Exported/)).toBeVisible();
});

test('exports a PDF (dev harness)', async ({ page, request }) => {
  const { id } = await publishFixture(request);
  await page.goto(`/s/${id}?formats=png,pdf`);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const { name, bytes } = await exportAs(page, 'PDF');
  expect(name).toBe('Checkout e2e – Whole board.pdf');
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10_000);
});

test('exports only the selection', async ({ page, request }) => {
  const { id } = await publishFixture(request);
  await page.goto(`/s/${id}`);
  await page.locator('.react-flow__node-screen').first().click({ position: { x: 10, y: 400 } });
  await page.getByRole('button', { name: 'Export PNG' }).click();
  await page.getByRole('radio', { name: 'Selection' }).check();
  const { name, bytes } = await exportAs(page, 'PNG');
  expect(name).toBe('Checkout e2e – Selection.png');
  expect(bytes.readUInt32BE(16)).toBeLessThan(1200);
});
