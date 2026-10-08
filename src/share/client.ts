// Share-link client. Remembers {id, editToken} per board in localStorage so the owner can
// update or turn off the link later (no accounts in v1 — the token *is* the ownership proof).
import type { BoardDoc, ID } from '../model/types';
import { getBoard, updateBoardMeta } from '../platform/boardIndex';

const KEY = 'fs:shares:v1';
const API = '/api/shares';

export interface StoredShare { id: string; editToken: string; publishedAt: number }
export interface ShareState { id: string; url: string; publishedAt: number }
export interface SharedBoard { title: string; doc: BoardDoc; updatedAt: number }

export type ShareErrorKind = 'not-found' | 'revoked' | 'too-large' | 'rate-limited' | 'network' | 'server';

export class ShareError extends Error {
  kind: ShareErrorKind;
  status?: number;
  constructor(kind: ShareErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

function readAll(): Record<ID, StoredShare> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<ID, StoredShare>; } catch { return {}; }
}
function writeAll(all: Record<ID, StoredShare>) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function shareUrl(id: string): string {
  return `${window.location.origin}/s/${id}`;
}

export function getShareState(boardId: ID): ShareState | null {
  const s = readAll()[boardId];
  return s ? { id: s.id, url: shareUrl(s.id), publishedAt: s.publishedAt } : null;
}

/** Keep the board list's `shareId` in sync without bumping "last edited". */
function setBoardShareId(boardId: ID, shareId: string | undefined) {
  const board = getBoard(boardId);
  if (!board || board.shareId === shareId) return;
  updateBoardMeta(boardId, { shareId, updatedAt: board.updatedAt });
}

async function request(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch {
    throw new ShareError('network', "Couldn't reach FlowSketch. Check your connection and try again.");
  }
}

function errorFor(res: Response): ShareError {
  switch (res.status) {
    case 404: return new ShareError('not-found', 'This link doesn’t exist.', 404);
    case 410: return new ShareError('revoked', 'This link has been turned off.', 410);
    case 413: return new ShareError('too-large', 'This board is too large to share (max 5 MB).', 413);
    case 429: return new ShareError('rate-limited', 'Too many changes in a short time. Try again in a minute.', 429);
    default: return new ShareError('server', 'Something went wrong on our side. Try again in a moment.', res.status);
  }
}

const json = (body: unknown, extra: Record<string, string> = {}): RequestInit => ({
  headers: { 'content-type': 'application/json', ...extra },
  body: JSON.stringify(body),
});

/**
 * Upload a read-only copy. First time: creates a link. After that: updates the same link.
 * If the server no longer knows the link (revoked elsewhere / data reset), a new one is created.
 */
export async function publishShare(boardId: ID, title: string, doc: BoardDoc): Promise<{ url: string; id: string; created: boolean }> {
  const existing = readAll()[boardId];
  if (existing) {
    const res = await request(`${API}/${existing.id}`, { method: 'PUT', ...json({ title, doc }, { 'x-edit-token': existing.editToken }) });
    if (res.ok) {
      writeAll({ ...readAll(), [boardId]: { ...existing, publishedAt: Date.now() } });
      setBoardShareId(boardId, existing.id);
      return { url: shareUrl(existing.id), id: existing.id, created: false };
    }
    if (![403, 404, 410].includes(res.status)) throw errorFor(res);
  }
  const res = await request(API, { method: 'POST', ...json({ title, doc }) });
  if (!res.ok) throw errorFor(res);
  const { id, editToken } = (await res.json()) as { id: string; editToken: string };
  writeAll({ ...readAll(), [boardId]: { id, editToken, publishedAt: Date.now() } });
  setBoardShareId(boardId, id);
  return { url: shareUrl(id), id, created: true };
}

/** Turn the link off. Already-gone links count as success. */
export async function revokeShare(boardId: ID): Promise<void> {
  const existing = readAll()[boardId];
  if (existing) {
    const res = await request(`${API}/${existing.id}`, { method: 'DELETE', headers: { 'x-edit-token': existing.editToken } });
    if (!res.ok && ![403, 404, 410].includes(res.status)) throw errorFor(res);
    const all = readAll();
    delete all[boardId];
    writeAll(all);
  }
  setBoardShareId(boardId, undefined);
}

/** Read a shared snapshot (share view). Throws ShareError with kind not-found / revoked / network / server. */
export async function fetchShare(id: string): Promise<SharedBoard> {
  const res = await request(`${API}/${encodeURIComponent(id)}`, { method: 'GET', headers: { accept: 'application/json' } });
  if (!res.ok) throw errorFor(res);
  return (await res.json()) as SharedBoard;
}
