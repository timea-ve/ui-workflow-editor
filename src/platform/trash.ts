// Trash: deleted boards and folders wait here for 30 days, then are deleted for good.
// Owner: Platform agent.
//
// A board in Trash keeps its content and stays in the board list with `trashedAt` set (so GitHub
// sync carries the state to other devices). Deleting a folder moves the folder and every board in
// it to Trash together; restoring the folder brings them all back. "Delete forever" (and the
// 30-day clean-up, run on each dashboard visit) uses the normal permanent delete in boards.ts,
// which also removes the GitHub copy.
import type { Board, Folder, ID } from '../model/types';
import { getBoard, listBoards, updateBoardMeta, updateBoardsMeta } from './boardIndex';
import { deleteBoard } from './boards';
import { boardsInFolder, getFolder, listFolders, removeFolder, setFolderTrashed } from './folders';

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left before an item trashed at `trashedAt` is deleted for good (at least 0). */
export function daysLeft(trashedAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((trashedAt + TRASH_DAYS * DAY_MS - now) / DAY_MS));
}

const inTrashedFolder = (b: Board) => {
  const f = b.folderId ? getFolder(b.folderId) : undefined;
  return f?.trashedAt !== undefined;
};

export function trashBoard(id: ID): Board | undefined {
  return updateBoardMeta(id, { trashedAt: Date.now() });
}

/** Back to where it was; to the dashboard if its folder is gone or in Trash. */
export function restoreBoard(id: ID): Board | undefined {
  const b = getBoard(id);
  if (!b) return undefined;
  const folder = b.folderId ? getFolder(b.folderId) : undefined;
  const keepFolder = folder && folder.trashedAt === undefined;
  return updateBoardMeta(id, { trashedAt: undefined, ...(keepFolder ? {} : { folderId: undefined, folderName: undefined }) });
}

/** Moves the folder and all its boards to Trash. Returns how many boards went with it. */
export function trashFolder(id: ID): number {
  const t = Date.now();
  const live = boardsInFolder(id);
  setFolderTrashed(id, t);
  updateBoardsMeta(Object.fromEntries(live.map((b) => [b.id, { trashedAt: t }])));
  return live.length;
}

/** Restores the folder and every board in Trash that belongs to it. */
export function restoreFolder(id: ID) {
  setFolderTrashed(id, undefined);
  updateBoardsMeta(Object.fromEntries(boardsInFolder(id, true).filter((b) => b.trashedAt !== undefined).map((b) => [b.id, { trashedAt: undefined }])));
}

export interface TrashContents {
  folders: { folder: Folder; boards: Board[] }[];
  /** Boards deleted on their own (not part of a deleted folder). */
  boards: Board[];
}

/** Newest deletions first. */
export function listTrash(): TrashContents {
  const trashed = listBoards().filter((b) => b.trashedAt !== undefined);
  const folders = listFolders()
    .filter((f) => f.trashedAt !== undefined)
    .map((folder) => ({ folder, boards: trashed.filter((b) => b.folderId === folder.id) }));
  const boards = trashed.filter((b) => !inTrashedFolder(b));
  folders.sort((a, b) => b.folder.trashedAt! - a.folder.trashedAt!);
  boards.sort((a, b) => b.trashedAt! - a.trashedAt!);
  return { folders, boards };
}

export function trashCount(): number {
  const t = listTrash();
  return t.folders.length + t.boards.length;
}

async function deleteBoardsForever(ids: ID[]) {
  let failure: unknown;
  for (const id of ids) {
    try { await deleteBoard(id, { undoWindowMs: null }).commit(); } catch (e) { failure ??= e; }
  }
  if (failure) throw failure;
}

export function deleteBoardForever(id: ID): Promise<void> {
  return deleteBoardsForever([id]);
}

export async function deleteFolderForever(id: ID): Promise<void> {
  await deleteBoardsForever(boardsInFolder(id, true).filter((b) => b.trashedAt !== undefined).map((b) => b.id));
  removeFolder(id);
}

export async function emptyTrash(): Promise<void> {
  const { folders, boards } = listTrash();
  await deleteBoardsForever(boards.map((b) => b.id));
  for (const { folder } of folders) await deleteFolderForever(folder.id);
}

/** Deletes for good whatever has been in Trash for 30 days or more. */
export async function purgeExpiredTrash(now = Date.now()): Promise<void> {
  const expired = (t: number | undefined) => t !== undefined && daysLeft(t, now) === 0;
  const { folders, boards } = listTrash();
  await deleteBoardsForever(boards.filter((b) => expired(b.trashedAt)).map((b) => b.id));
  for (const { folder } of folders) if (expired(folder.trashedAt)) await deleteFolderForever(folder.id);
}
