// GitHub sync engine: pure logic over three ports (local boards, the GitHub files API, and the
// last-synced state), so it's unit-tested with fakes (sync.test.ts). The browser wiring is runtime.ts.
//
// This device is the source of truth for editing; GitHub keeps a cloud copy in
// boards/<id>.json. For each board we compare three things: the local board, the GitHub file
// (its blob sha), and what we last synced (sha + local updatedAt + content hash). Rules:
//
//   local only, never synced ................ upload it (first connection uploads every board)
//   GitHub only ............................. download it (it appears on the dashboard)
//   local changed, GitHub not ............... upload
//   GitHub changed, local not ............... replace the local copy
//   both changed, same content .............. just note it as synced
//   both changed, different content ......... keep both: GitHub's version becomes a new local board
//                                             "<title> (from another device)"; the local one keeps
//                                             its id and is uploaded over GitHub's
//   deleted here (after undo window) ........ delete the GitHub file — unless it changed on GitHub
//                                             since our last sync; then it's downloaded again
//   GitHub file gone, local unchanged ....... remove it from this device (it was deleted elsewhere)
//   GitHub file gone, local changed ......... upload it again (never drop unsynced work)
//   waiting in the delete undo window ....... leave it alone
//
// A rejected write (409/422: someone else wrote first) re-reads the file and applies the rules again.
import type { Board, BoardDoc, ID } from '../../model/types';
import { validateBoardDoc } from '../../share/validate';
import { GitHubError, type BoardsApi } from './api';
import type { SyncEntry, SyncState, SyncStore } from './syncState';

export const BOARD_FORMAT = 'ui-workflow-editor/board';
export const BOARD_FORMAT_VERSION = 1;
export const CONFLICT_SUFFIX = ' (from another device)';

export interface BoardFile {
  format: typeof BOARD_FORMAT;
  version: typeof BOARD_FORMAT_VERSION;
  board: Board;
  doc: BoardDoc;
}

/** This device's boards (board list + IndexedDB content). */
export interface LocalBoards {
  list(): Board[];
  get(id: ID): Board | undefined;
  /** Deleted but still inside its undo window. */
  isPendingDelete(id: ID): boolean;
  readDoc(id: ID): Promise<BoardDoc>;
  /** Creates or replaces the board with exactly this metadata and content. */
  write(board: Board, doc: BoardDoc): Promise<void>;
  /** A new board (new id) with this title and content. */
  createCopy(title: string, doc: BoardDoc): Promise<Board>;
  /** Removes the board from this device (not a user delete: GitHub isn't told). */
  remove(id: ID): Promise<void>;
}

export type SyncEvent =
  | { type: 'uploaded'; id: ID }
  | { type: 'downloaded'; id: ID; isNew: boolean }
  | { type: 'removed'; id: ID; title: string }
  | { type: 'deleted-remote'; id: ID }
  | { type: 'conflict'; id: ID; copyId: ID; title: string };

// ---------- file format ----------

/** Board metadata that travels with the file (device-only fields like shareId stay behind). */
export function portableBoard(b: Board): Board {
  return {
    id: b.id, title: b.title, schemaVersion: b.schemaVersion, createdAt: b.createdAt, updatedAt: b.updatedAt,
    ...(b.templateId ? { templateId: b.templateId } : {}),
  };
}

export function serializeBoardFile(board: Board, doc: BoardDoc): string {
  const file: BoardFile = { format: BOARD_FORMAT, version: BOARD_FORMAT_VERSION, board: portableBoard(board), doc };
  return `${JSON.stringify(file, null, 2)}\n`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Parses and checks a board file; `null` if it isn't one (or is for a different board id). */
export function parseBoardFile(text: string, id: ID): BoardFile | null {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return null; }
  if (!isObj(v) || v.format !== BOARD_FORMAT || v.version !== BOARD_FORMAT_VERSION || !isObj(v.board)) return null;
  const b = v.board;
  if (b.id !== id || typeof b.title !== 'string' || !isNum(b.createdAt) || !isNum(b.updatedAt)) return null;
  const doc = validateBoardDoc(v.doc);
  if (!doc.ok) return null;
  const board: Board = {
    id, title: b.title.slice(0, 200) || 'Untitled board', schemaVersion: isNum(b.schemaVersion) ? b.schemaVersion : 1,
    createdAt: b.createdAt, updatedAt: b.updatedAt,
    ...(typeof b.templateId === 'string' ? { templateId: b.templateId } : {}),
  };
  return { format: BOARD_FORMAT, version: BOARD_FORMAT_VERSION, board, doc: doc.value };
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isObj(v)) {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** cyrb53: a small, fast 53-bit string hash (fingerprint only, not security). */
function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Fingerprint of what matters (title + content), ignoring `updatedAt` and key order. */
export function contentHash(board: Board, doc: BoardDoc): string {
  const { updatedAt: _ignored, ...meta } = portableBoard(board);
  return cyrb53(canonical({ meta, doc }));
}

// ---------- engine ----------

export interface SyncEngineOptions {
  onEvent?: (e: SyncEvent) => void;
  /** Boards synced at the same time. */
  concurrency?: number;
}

const MAX_RETRIES = 3;
const commitMessage = (verb: string, title: string) => `${verb} “${title.slice(0, 80)}”`;

export class SyncEngine {
  private readonly api: BoardsApi;
  private readonly local: LocalBoards;
  private readonly store: SyncStore;
  private readonly onEvent: (e: SyncEvent) => void;
  private readonly concurrency: number;
  private readonly chains = new Map<ID, Promise<void>>();
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(api: BoardsApi, local: LocalBoards, store: SyncStore, opts: SyncEngineOptions = {}) {
    this.api = api;
    this.local = local;
    this.store = store;
    this.onEvent = opts.onEvent ?? (() => {});
    this.concurrency = opts.concurrency ?? 2;
  }

  // ----- public -----

  /** Lists GitHub and reconciles every board known on either side. Rejects with the first error. */
  async syncAll(): Promise<void> {
    const remote = new Map((await this.api.list()).map((r) => [r.id, r.sha]));
    const ids = new Set<ID>([...this.local.list().map((b) => b.id), ...remote.keys(), ...Object.keys(this.store.read().boards)]);
    const results = await Promise.allSettled([...ids].map((id) => this.run(id, () => this.reconcile(id, remote.get(id) ?? null))));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
  }

  /**
   * Syncs one board without listing GitHub first (after a local edit or delete). Assumes GitHub
   * still has what we last synced; if not, the write is rejected and the rules are re-applied.
   */
  syncBoard(id: ID): Promise<void> {
    return this.run(id, () => this.reconcile(id, this.entry(id)?.sha ?? null));
  }

  /** Local changes not yet on GitHub (or never uploaded). */
  isDirty(id: ID): boolean {
    const b = this.local.get(id);
    const e = this.entry(id);
    return !!b && (!e || e.deleted === true || e.updatedAt !== b.updatedAt);
  }

  // ----- state -----

  private entry(id: ID): SyncEntry | undefined {
    return this.store.read().boards[id];
  }
  private setEntry(id: ID, entry: SyncEntry | undefined) {
    const state: SyncState = this.store.read();
    if (entry) state.boards[id] = entry;
    else delete state.boards[id];
    this.store.write(state);
  }

  // ----- scheduling: one task per board at a time, `concurrency` boards at once -----

  private run(id: ID, task: () => Promise<void>): Promise<void> {
    const prev = this.chains.get(id) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(() => this.limited(task));
    this.chains.set(id, next);
    void next.catch(() => {}).finally(() => { if (this.chains.get(id) === next) this.chains.delete(id); });
    return next;
  }

  private async limited(task: () => Promise<void>) {
    if (this.active >= this.concurrency) await new Promise<void>((r) => this.waiting.push(r));
    this.active++;
    try {
      await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  // ----- rules -----

  /** `remoteSha`: the GitHub file's sha, or null if there's no file. */
  private async reconcile(id: ID, remoteSha: string | null, depth = 0): Promise<void> {
    if (depth > MAX_RETRIES) throw new GitHubError(409, `Board ${id} keeps changing on GitHub; will retry`);
    if (this.local.isPendingDelete(id)) return;
    const e = this.entry(id);
    const local = this.local.get(id);

    if (e?.deleted) {
      if (remoteSha === null) { this.setEntry(id, undefined); return; }
      if (remoteSha !== e.sha) {
        // Changed on another device after our last sync: keep that work, it comes back as a board.
        this.setEntry(id, undefined);
        return this.reconcile(id, remoteSha, depth + 1);
      }
      try {
        await this.api.remove(id, remoteSha, commitMessage('Delete', id));
      } catch (err) {
        if (err instanceof GitHubError && err.isNotFound) { this.setEntry(id, undefined); return; }
        if (err instanceof GitHubError && err.isConflict) return this.reconcile(id, await this.remoteSha(id), depth + 1);
        throw err;
      }
      this.setEntry(id, undefined);
      this.onEvent({ type: 'deleted-remote', id });
      return;
    }

    if (!local) {
      if (remoteSha === null) { if (e) this.setEntry(id, undefined); return; }
      return this.download(id, depth);
    }

    const dirty = !e || e.updatedAt !== local.updatedAt;
    if (remoteSha === null) {
      if (e && !dirty) {
        await this.local.remove(id);
        this.setEntry(id, undefined);
        this.onEvent({ type: 'removed', id, title: local.title });
        return;
      }
      return this.push(id, undefined, depth);
    }
    if (e && e.sha === remoteSha) {
      if (dirty) return this.push(id, remoteSha, depth);
      return;
    }

    // GitHub has a version we haven't seen.
    const remote = await this.api.get(id);
    if (!remote) return this.reconcile(id, null, depth + 1);
    const file = parseBoardFile(remote.text, id);
    if (!file) {
      // Not a board file we can read: don't import it, and keep ours safe on top of it.
      console.warn(`[github-sync] boards/${id}.json isn't a readable board file; replacing it with this device's copy`);
      return this.push(id, remote.sha, depth);
    }
    const remoteHash = contentHash(file.board, file.doc);
    if (!dirty) {
      await this.local.write({ ...file.board, ...(local.shareId ? { shareId: local.shareId } : {}) }, file.doc);
      this.setEntry(id, { sha: remote.sha, updatedAt: file.board.updatedAt, hash: remoteHash });
      this.onEvent({ type: 'downloaded', id, isNew: false });
      return;
    }
    const meta = this.local.get(id) ?? local;
    const localHash = contentHash(meta, await this.local.readDoc(id));
    if (localHash === remoteHash) {
      this.setEntry(id, { sha: remote.sha, updatedAt: meta.updatedAt, hash: localHash });
      return;
    }
    if (e && e.hash === remoteHash) return this.push(id, remote.sha, depth); // only the sha moved (e.g. a re-commit)
    // Both sides changed: keep both.
    const copy = await this.local.createCopy(`${file.board.title}${CONFLICT_SUFFIX}`, file.doc);
    this.onEvent({ type: 'conflict', id, copyId: copy.id, title: file.board.title });
    return this.push(id, remote.sha, depth);
  }

  private async remoteSha(id: ID): Promise<string | null> {
    return (await this.api.get(id))?.sha ?? null;
  }

  private async download(id: ID, depth: number): Promise<void> {
    const remote = await this.api.get(id);
    if (!remote) { this.setEntry(id, undefined); return; }
    const file = parseBoardFile(remote.text, id);
    if (!file) { console.warn(`[github-sync] skipped boards/${id}.json: not a readable board file`); return; }
    if (this.local.get(id)) return this.reconcile(id, remote.sha, depth + 1); // appeared meanwhile
    await this.local.write(file.board, file.doc);
    this.setEntry(id, { sha: remote.sha, updatedAt: file.board.updatedAt, hash: contentHash(file.board, file.doc) });
    this.onEvent({ type: 'downloaded', id, isNew: true });
  }

  /** Uploads the local board over `sha` (undefined = create). */
  private async push(id: ID, sha: string | undefined, depth: number): Promise<void> {
    // Metadata first: an edit landing while we read the content leaves updatedAt newer than what we
    // record, so it's still seen as unsynced and goes up next time.
    const meta = this.local.get(id);
    if (!meta) return;
    const doc = await this.local.readDoc(id);
    const hash = contentHash(meta, doc);
    const e = this.entry(id);
    if (e && !e.deleted && sha && e.sha === sha && e.hash === hash) {
      this.setEntry(id, { ...e, updatedAt: meta.updatedAt }); // nothing new (e.g. only touched)
      return;
    }
    let newSha: string;
    try {
      ({ sha: newSha } = await this.api.put(id, serializeBoardFile(meta, doc), sha, commitMessage('Save', meta.title)));
    } catch (err) {
      if (err instanceof GitHubError && (err.isConflict || err.isNotFound)) {
        return this.reconcile(id, await this.remoteSha(id), depth + 1);
      }
      throw err;
    }
    if (!this.local.get(id) && !this.local.isPendingDelete(id)) {
      // Deleted for good while uploading: remember the file so the delete reaches GitHub too.
      this.setEntry(id, { sha: newSha, updatedAt: meta.updatedAt, hash, deleted: true });
      return;
    }
    this.setEntry(id, { sha: newSha, updatedAt: meta.updatedAt, hash });
    this.onEvent({ type: 'uploaded', id });
  }
}
