import { expect, test, type Locator, type Page } from '@playwright/test';
import { MOD, announcer, edges, screens } from './editor.helpers';

// The Definition-of-Done keyboard walkthrough: the whole core flow without touching the mouse.
// Every focus stop we land on must show a visible focus indicator.

const kitNodes = (page: Page) => page.locator('.fse-editor .react-flow__node-kit');
const selectedScreen = (page: Page) => page.locator('.fse-editor .react-flow__node-screen.selected');

/** The focused element draws a visible indicator (outline, ring shadow, or a ring on a pseudo/child). */
async function expectVisibleFocus(page: Page) {
  const info = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { ok: false, what: 'body' };
    const visible = (s: CSSStyleDeclaration) =>
      (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
    const own = getComputedStyle(el);
    const before = getComputedStyle(el, '::before');
    const after = getComputedStyle(el, '::after');
    const ok = visible(own) || visible(before) || visible(after);
    return { ok: !!ok, what: `${el.tagName}.${el.className} ${el.getAttribute('aria-label') ?? ''}` };
  });
  expect(info.ok, `no visible focus indicator on ${info.what}`).toBe(true);
}

/** After a popup closes, focus lands on a real control, never back on <body>. */
async function expectFocusKept(page: Page) {
  await expect.poll(() => page.evaluate(() => !!document.activeElement && document.activeElement !== document.body)).toBe(true);
}

/** Tab (Shift+Tab when the target comes earlier in the page) until `target` has focus. */
async function tabTo(page: Page, target: Locator, max = 40) {
  // WebKit on macOS skips buttons on plain Tab (Safari default); Alt+Tab is "move to every control".
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  const tab = webkit ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < max; i++) {
    const where = await target.evaluate((el) => {
      const a = document.activeElement;
      if (el === a) return 'here';
      if (!a || a === document.body) return 'after';
      return a.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING ? 'before' : 'after';
    }).catch(() => 'after');
    if (where === 'here') return;
    await page.keyboard.press(where === 'before' ? `Shift+${tab}` : tab);
  }
  await expect(target).toBeFocused();
}

async function insertButton(page: Page) {
  const before = await kitNodes(page).count();
  await page.keyboard.press('/');
  const palette = page.getByRole('dialog').filter({ has: page.getByRole('combobox') });
  await expect(palette).toBeVisible();
  await page.keyboard.type('button');
  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expectFocusKept(page);
  await expect(kitNodes(page)).toHaveCount(before + 1);
}

/** L on the selected component, pick a screen by name from the list. */
async function linkTo(page: Page, name: string) {
  const before = await edges(page).count();
  await page.keyboard.press('l');
  const list = page.getByRole('listbox', { name: 'Screens' });
  await expect(list).toBeVisible();
  await page.keyboard.type(name);
  const option = list.getByRole('option', { name: new RegExp(`^${name}\\b`) });
  for (let i = 0; i < 6 && (await option.getAttribute('aria-selected')) !== 'true'; i++) await page.keyboard.press('ArrowDown');
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  await expect(edges(page)).toHaveCount(before + 1);
  await expectFocusKept(page);
}

/** Focus a screen via Tab from the toolbar and select it with Enter. */
async function selectScreenByTab(page: Page, index: number) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const target = screens(page).nth(index);
  await tabTo(page, target, 60);
  await expectVisibleFocus(page);
  await page.keyboard.press('Enter');
  await expect(target).toHaveClass(/selected/);
}

test('keyboard only: create → 3 screens → button → link → Option B → Compare → Play → Export → undo/redo', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Dashboard: Tab to "New board" and press Enter.
  const newBoard = page.getByTestId('new-board');
  await tabTo(page, newBoard);
  await expectVisibleFocus(page);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/b\/[\w-]{6,}$/);
  await expect(page.locator('.react-flow')).toBeVisible();

  // Three mobile screens: F, 1, Enter (placed in free space at the centre of the view).
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press('Escape');
    await page.keyboard.press('f');
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await expect(screens(page)).toHaveCount(i);
    await expect(announcer(page)).toHaveText(new RegExp(`Screen ${i} added`));
  }
  const ids = await screens(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')!));
  const names = await screens(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  expect(names.join('|')).toMatch(/Screen 1.*Screen 2.*Screen 3/);

  // Screen 1: a button linked to Screen 2.
  await selectScreenByTab(page, 0);
  await insertButton(page);
  await expect(kitNodes(page).last()).toHaveClass(/selected/);
  await linkTo(page, 'Screen 2');
  await expect(page.locator(`.fs-sketch-edge[data-target="${ids[1]}"]`)).toHaveCount(1);

  // Screen 2: a button linked to Screen 3.
  await selectScreenByTab(page, 1);
  await insertButton(page);
  await linkTo(page, 'Screen 3');
  await expect(page.locator(`.fs-sketch-edge[data-target="${ids[2]}"]`)).toHaveCount(1);

  // Option B: select screen 1, Shift+D.
  await selectScreenByTab(page, 0);
  await page.keyboard.press('Shift+D');
  await expect(screens(page)).toHaveCount(6);
  await expect(page.locator('.fs-lane-chip')).toHaveCount(2);

  // Compare: Shift+C opens; focus is inside the dialog, Tab moves through its controls; Esc closes.
  await page.keyboard.press('Shift+C');
  const compare = page.getByRole('dialog', { name: /^Compare options/ });
  await expect(compare).toBeVisible();
  await expect.poll(() => compare.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press(page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab');
    expect(await compare.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await expectVisibleFocus(page);
  }
  await page.keyboard.press('Escape');
  await expect(compare).toBeHidden();
  await expectFocusKept(page);

  // Play: P, then Tab to the hotspot and Enter, twice; Esc exits.
  await selectScreenByTab(page, 0);
  await page.keyboard.press('p');
  const play = page.getByRole('dialog', { name: /^Playing/ });
  const playScreen = page.getByTestId('play-screen');
  await expect(play).toBeVisible();
  await expect(playScreen).toHaveAttribute('data-frame-id', ids[0]);
  for (const next of [ids[1], ids[2]]) {
    const hotspot = play.locator('.fs-play-hotspot').first();
    await tabTo(page, hotspot, 10);
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(playScreen).toHaveAttribute('data-frame-id', next);
  }
  await expect(play).toContainText('End of this path');
  await page.keyboard.press('Escape');
  await expect(play).toBeHidden();
  await expectFocusKept(page);

  // Export: ⌘/Ctrl ⇧ E; the dialog traps focus, PDF is reachable with arrows; Esc closes.
  await page.keyboard.press(`${MOD}+Shift+E`);
  const exportDialog = page.getByRole('dialog', { name: /Export/ });
  await expect(exportDialog).toBeVisible();
  await expect.poll(() => exportDialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  const pdf = exportDialog.getByRole('radio', { name: 'Document (PDF)' });
  await tabTo(page, exportDialog.getByRole('group', { name: 'Format' }).getByRole('radio', { checked: true }), 10);
  await expectVisibleFocus(page);
  for (let i = 0; i < 4 && !(await pdf.isChecked()); i++) await page.keyboard.press('ArrowDown');
  await expect(pdf).toBeChecked();
  await tabTo(page, exportDialog.getByRole('button', { name: 'Export', exact: true }), 10);
  await expectVisibleFocus(page);
  await page.keyboard.press('Escape');
  await expect(exportDialog).toBeHidden();
  await expectFocusKept(page);

  // Undo removes Option B; redo brings it back.
  await page.keyboard.press(`${MOD}+z`);
  await expect(screens(page)).toHaveCount(3);
  await page.keyboard.press(`${MOD}+y`);
  await expect(screens(page)).toHaveCount(6);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(screens(page)).toHaveCount(6);
});
