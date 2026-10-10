import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import { TrashPage } from '../pages/TrashPage';
import { createFolder, moveBoardToFolder } from '../platform/folders';
import { trashBoard } from '../platform/trash';
import { createBoardMeta, getBoard, updateBoardMeta } from '../platform/boardIndex';
import * as persistence from '../store/persistence';

vi.mock('../store/persistence', () => ({
  writeInitialDoc: vi.fn(async () => {}),
  readBoardDoc: vi.fn(),
  deleteBoardData: vi.fn(async () => {}),
}));

function renderDashboard(at = '/') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/folder/:folderId" element={<DashboardPage />} />
        <Route path="/trash" element={<TrashPage />} />
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
    expect(screen.getByText('“Doomed” moved to Trash')).toBeInTheDocument();
    expect(getBoard(b.id)?.trashedAt).toBeDefined();
    expect(screen.getByTestId('trash-link')).toHaveAccessibleName('Trash, 1 item');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(getBoard(b.id)?.trashedAt).toBeUndefined();
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

describe('Folders and Trash', () => {
  it('shows folders as tiles before loose boards, and opens a folder with its boards', async () => {
    const f = createFolder('Research');
    const inside = createBoardMeta({ title: 'Inside' });
    moveBoardToFolder(inside.id, f.id);
    createBoardMeta({ title: 'Loose' });
    renderDashboard();
    const grid = screen.getByRole('list', { name: /Your boards/ });
    const items = within(grid).getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('data-testid', 'folder-card');
    expect(within(items[0]).getByText('1 board')).toBeInTheDocument();
    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(within(items[0]).getByRole('link', { name: /Research/ })); });
    expect(screen.getByRole('heading', { level: 2, name: /Research/ })).toBeInTheDocument();
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(screen.queryByText('Loose')).not.toBeInTheDocument();
    expect(screen.getByTestId('folder-back')).toHaveAttribute('href', '/');
  });

  it('search at the top level finds boards inside folders', () => {
    const f = createFolder('Research');
    const inside = createBoardMeta({ title: 'Checkout deep dive' });
    moveBoardToFolder(inside.id, f.id);
    renderDashboard();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'checkout' } });
    expect(screen.getByText('Checkout deep dive')).toBeInTheDocument();
    expect(screen.getByText(/in Research/)).toBeInTheDocument();
  });

  it('New folder adds a tile in rename mode', () => {
    createBoardMeta({ title: 'A board' });
    renderDashboard();
    fireEvent.click(screen.getByTestId('new-folder'));
    const input = screen.getByRole('textbox', { name: 'Folder name' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Q3 ideas' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('link', { name: /Q3 ideas/ })).toBeInTheDocument();
  });

  it('moves a board into a folder by drag and drop', () => {
    const f = createFolder('Research');
    const b = createBoardMeta({ title: 'Dragged' });
    renderDashboard();
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (t: string, v: string) => data.set(t, v), getData: (t: string) => data.get(t) ?? '',
      get types() { return [...data.keys()]; }, effectAllowed: 'all', dropEffect: 'none',
    };
    const card = screen.getAllByTestId('board-card')[0];
    fireEvent.dragStart(card, { dataTransfer });
    const tile = screen.getByTestId('folder-card');
    fireEvent.dragEnter(tile, { dataTransfer });
    expect(tile).toHaveAttribute('data-drop-over');
    fireEvent.drop(tile, { dataTransfer });
    expect(getBoard(b.id)?.folderId).toBe(f.id);
    expect(screen.getByText('Moved “Dragged” to Research')).toBeInTheDocument();
  });

  it('deleting a folder asks first, then moves it and its boards to Trash', async () => {
    const f = createFolder('Old work');
    const b = createBoardMeta({ title: 'Inside' });
    moveBoardToFolder(b.id, f.id);
    renderDashboard();
    await openMenu('folder Old work');
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /Delete folder/ })); });
    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Old work”?' });
    expect(within(dialog).getByText(/its board move to Trash/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Move to Trash' })); });
    expect(screen.queryByTestId('folder-card')).not.toBeInTheDocument();
    expect(getBoard(b.id)?.trashedAt).toBeDefined();
    expect(persistence.deleteBoardData).not.toHaveBeenCalled();
  });

  it('Trash lists deleted items with days left; restore and delete forever (after confirming)', async () => {
    const keep = createBoardMeta({ title: 'Keep me' });
    const gone = createBoardMeta({ title: 'Gone' });
    trashBoard(keep.id);
    trashBoard(gone.id);
    renderDashboard('/trash');
    expect(screen.getAllByTestId('trash-row')).toHaveLength(2);
    expect(screen.getAllByText(/deleted for good in 30 days/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Keep me' }));
    expect(getBoard(keep.id)?.trashedAt).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Gone forever' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Gone” forever?' });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete forever' })); });
    expect(getBoard(gone.id)).toBeUndefined();
    expect(persistence.deleteBoardData).toHaveBeenCalledWith(gone.id);
    expect(screen.getByText('Trash is empty.')).toBeInTheDocument();
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
