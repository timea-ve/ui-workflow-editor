import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import { createBoardMeta, getBoard, updateBoardMeta } from '../platform/boardIndex';
import * as persistence from '../store/persistence';

vi.mock('../store/persistence', () => ({
  writeInitialDoc: vi.fn(async () => {}),
  readBoardDoc: vi.fn(),
  deleteBoardData: vi.fn(async () => {}),
}));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/b/:boardId" element={<p>Editor page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('shows a friendly empty state with New board and all templates', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'Sketch your first flow' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /New board/ }).length).toBeGreaterThan(0);
    for (const name of ['Sign-up', 'Onboarding', 'Checkout', 'Settings', 'Search']) {
      expect(screen.getByRole('button', { name: new RegExp(`Use ${name} template`) })).toBeInTheDocument();
    }
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('lists boards newest first with relative edit time', () => {
    const a = createBoardMeta({ title: 'Alpha' });
    updateBoardMeta(a.id, { updatedAt: Date.now() - 3 * 60_000 });
    createBoardMeta({ title: 'Beta' });
    renderDashboard();
    const cards = screen.getAllByTestId('board-card');
    expect(cards.map((c) => within(c).getByRole('link').textContent)).toEqual([
      expect.stringContaining('Beta'),
      expect.stringContaining('Alpha'),
    ]);
    expect(within(cards[1]).getByText('Edited 3 min ago')).toBeInTheDocument();
    expect(within(cards[0]).getByRole('link')).toHaveAttribute('href', `/b/${getBoardId('Beta')}`);
  });

  it('filters by name and offers to clear the search', () => {
    createBoardMeta({ title: 'Checkout ideas' });
    createBoardMeta({ title: 'Login v2' });
    renderDashboard();
    const search = screen.getByRole('searchbox', { name: 'Search boards' });
    fireEvent.change(search, { target: { value: 'CHECK' } });
    expect(screen.getAllByTestId('board-card')).toHaveLength(1);
    expect(screen.getByText('Checkout ideas')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No boards match “zzz”.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getAllByTestId('board-card')).toHaveLength(2);
  });

  it('renames inline with F2 + Enter, and Escape cancels', () => {
    const b = createBoardMeta({ title: 'Old name' });
    renderDashboard();
    const link = screen.getByRole('link', { name: /Old name/ });
    fireEvent.keyDown(link, { key: 'F2' });
    const input = screen.getByRole('textbox', { name: 'Board name' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'New name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(getBoard(b.id)?.title).toBe('New name');
    expect(screen.getByRole('link', { name: /New name/ })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('link', { name: /New name/ }), { key: 'F2' });
    const again = screen.getByRole('textbox', { name: 'Board name' });
    fireEvent.change(again, { target: { value: 'Discard me' } });
    fireEvent.keyDown(again, { key: 'Escape' });
    expect(getBoard(b.id)?.title).toBe('New name');
  });

  it('renames from the board menu', async () => {
    const b = createBoardMeta({ title: 'Menu board' });
    renderDashboard();
    await openMenu('Menu board');
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ })); });
    const input = await screen.findByRole('textbox', { name: 'Board name' });
    fireEvent.change(input, { target: { value: 'Renamed via menu' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(getBoard(b.id)?.title).toBe('Renamed via menu');
  });

  it('disables "Copy share link" until the board is shared', async () => {
    createBoardMeta({ title: 'Private' });
    renderDashboard();
    await openMenu('Private');
    const item = screen.getByRole('menuitem', { name: /Copy share link/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(within(item).getByText('Share from inside the board')).toBeInTheDocument();
  });

  it('deletes with undo', async () => {
    const b = createBoardMeta({ title: 'Doomed' });
    renderDashboard();
    await openMenu('Doomed');
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ })); });
    expect(screen.queryByText('Doomed')).not.toBeInTheDocument();
    expect(screen.getByText('“Doomed” deleted')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(getBoard(b.id)).toBeDefined();
    expect(screen.getByRole('link', { name: /Doomed/ })).toBeInTheDocument();
    expect(persistence.deleteBoardData).not.toHaveBeenCalled();
  });

  it('creates a board from a template and opens it', async () => {
    renderDashboard();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Use Checkout template/ })); });
    expect(await screen.findByText('Editor page')).toBeInTheDocument();
    expect(persistence.writeInitialDoc).toHaveBeenCalledTimes(1);
  });

  it('shows a calm error when creating fails', async () => {
    vi.mocked(persistence.writeInitialDoc).mockRejectedValueOnce(new Error('quota'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDashboard();
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: /New board/ })[0]); });
    expect(await screen.findByText(/Couldn't create the board/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sketch your first flow' })).toBeInTheDocument();
  });
});

function getBoardId(title: string) {
  const all = JSON.parse(localStorage.getItem('fs:boards:v1') ?? '{}') as Record<string, { title: string }>;
  return Object.entries(all).find(([, b]) => b.title === title)?.[0];
}

async function openMenu(title: string) {
  const trigger = screen.getByRole('button', { name: `Options for ${title}` });
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  });
  if (!screen.queryByRole('menu')) await act(async () => { fireEvent.keyDown(trigger, { key: 'Enter' }); });
  return screen.findByRole('menu');
}
