// Share-link client. A link carries a read-only copy of the board inside its fragment (see link.ts),
// so there is no server: "publishing" just builds the link. The latest link per board is remembered in
// localStorage so the popover and dashboard can show/copy it again.
import { nanoid } from 'nanoid';
import type { BoardDoc, ID } from '../model/types';
import { getBoard, updateBoardMeta } from '../platform/boardIndex';
import { encodeShare, sharePath } from './link';

const KEY = 'fs:shares:v2';

/** `id` is a local marker (Board.shareId), not part of the link. */
export interface ShareState { id: string; url: string; publishedAt: number }

// In-memory copy, so a link still works this session if localStorage is full or blocked.
let memory: Record<ID, ShareState> | null = null;

function readAll(): Record<ID, ShareState> {
  if (memory) return memory;
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<ID, ShareState>; } catch { return {}; }
}
function writeAll(all: Record<ID, ShareState>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    memory = null;
  } catch {
    memory = all;
  }
}

/** Absolute link for link data, under the app's base path (e.g. `/ui-workflow-editor/`). */
export function shareUrl(data: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${sharePath(data)}`;
}

export function getShareState(boardId: ID): ShareState | null {
  return readAll()[boardId] ?? null;
}

/** Keep the board list's `shareId` in sync without bumping "last edited". */
function setBoardShareId(boardId: ID, shareId: string | undefined) {
  const board = getBoard(boardId);
  if (!board || board.shareId === shareId) return;
  updateBoardMeta(boardId, { shareId, updatedAt: board.updatedAt });
}

/** Build a link holding a copy of the board as it is now. `created` is false when it replaces an earlier link. */
export async function publishShare(boardId: ID, title: string, doc: BoardDoc): Promise<{ url: string; id: string; created: boolean }> {
  const existing = readAll()[boardId];
  const url = shareUrl(await encodeShare(title, doc));
  const id = existing?.id ?? nanoid(12);
  writeAll({ ...readAll(), [boardId]: { id, url, publishedAt: Date.now() } });
  setBoardShareId(boardId, id);
  return { url, id, created: !existing };
}

/** Forget this board's link. Links already sent keep working (they carry their own copy). */
export async function revokeShare(boardId: ID): Promise<void> {
  const all = { ...readAll() };
  if (all[boardId]) {
    delete all[boardId];
    writeAll(all);
  }
  setBoardShareId(boardId, undefined);
}
