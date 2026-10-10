import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board, BoardDoc, ID } from '../../model/types';
import { createScreen, emptyDoc } from '../../flow/ops';
import { GitHubError, type BoardsApi } from './api';
import { CONFLICT_SUFFIX, SyncEngine, contentHash, parseBoardFile, serializeBoardFile, type LocalBoards, type SyncEvent } from './sync';
import { recordLocalDelete, type SyncState, type SyncStore } from './syncState';

// ---------- fakes ----------

function docWith(name: string): BoardDoc {
  return createScreen(emptyDoc(), { device: 'mobile', name, x: 0, y: 0 }).doc;
}
const screenNames = (doc: BoardDoc) => Object.values(doc.frames).map((f) => f.name);

let shaSeq = 0;
class FakeGitHub implements BoardsApi {
  files = new Map<ID, { text: string; sha: string }>();
  calls: string[] = [];
  /** Next put for this id fails with this status (once). */
  failPut = new Map<ID, number>();
  /** Runs right before a put is applied (to simulate another device writing first). */
  beforePut?: (id: ID) => void;

  seed(board: Board, doc: BoardDoc) {
    const sha = `s${++shaSeq}`;
    this.files.set(board.id, { text: serializeBoardFile(board, doc), sha });
    return sha;
  }
  read(id: ID) {
    const f = this.files.get(id);
    return f ? parseBoardFile(f.text, id) : null;
  }
  async list() { this.calls.push('list'); return [...this.files].map(([id, f]) => ({ id, sha: f.sha })); }
  async get(id: ID) { this.calls.push(`get ${id}`); return this.files.get(id) ?? null; }
  async put(id: ID, text: string, sha: string | undefined) {
    this.calls.push(`put ${id}`);
    this.beforePut?.(id);
    const fail = this.failPut.get(id);
    if (fail !== undefined) { this.failPut.delete(id); throw new GitHubError(fail, 'fail'); }
    const cur = this.files.get(id);
    if ((cur?.sha ?? undefined) !== sha) throw new GitHubError(cur ? 409 : 422, 'sha mismatch');
    const next = { text, sha: `s${++shaSeq}` };
    this.files.set(id, next);
    return { sha: next.sha };
  }
  async remove(id: ID, sha: string) {
    this.calls.push(`delete ${id}`);
    const cur = this.files.get(id);
    if (!cur) throw new GitHubError(404, 'gone');
    if (cur.sha !== sha) throw new GitHubError(409, 'sha mismatch');
    this.files.delete(id);
  }
}

class FakeLocal implements LocalBoards {
  boards = new Map<ID, Board>();
  docs = new Map<ID, BoardDoc>();
  pending = new Set<ID>();
  private seq = 0;
  add(title: string, doc: BoardDoc, updatedAt = 1000, id = `b${++this.seq}`): Board {
    const b: Board = { id, title, schemaVersion: 1, createdAt: 1, updatedAt };
    this.boards.set(id, b);
    this.docs.set(id, doc);
    return b;
  }
  edit(id: ID, doc: BoardDoc, updatedAt: number) {
    this.boards.set(id, { ...this.boards.get(id)!, updatedAt });
    this.docs.set(id, doc);
  }
  list() { return [...this.boards.values()]; }
  get(id: ID) { return this.boards.get(id); }
  isPendingDelete(id: ID) { return this.pending.has(id); }
  async readDoc(id: ID) { return this.docs.get(id)!; }
  async write(board: Board, doc: BoardDoc) { this.boards.set(board.id, board); this.docs.set(board.id, doc); }
  async createCopy(title: string, doc: BoardDoc) { return this.add(title, doc, 5000, `copy${++this.seq}`); }
  async remove(id: ID) { this.boards.delete(id); this.docs.delete(id); }
  /** A user delete that has passed its undo window. */
  deleteForGood(id: ID, store: SyncStore) { this.boards.delete(id); this.docs.delete(id); recordLocalDelete(id, store); }
}

class MemStore implements SyncStore {
  state: SyncState = { boards: {} };
  read() { return structuredClone(this.state); }
  write(s: SyncState) { this.state = structuredClone(s); }
}

let gh: FakeGitHub;
let local: FakeLocal;
let store: MemStore;
let events: SyncEvent[];
let engine: SyncEngine;

beforeEach(() => {
  gh = new FakeGitHub();
  local = new FakeLocal();
  store = new MemStore();
  events = [];
  engine = new SyncEngine(gh, local, store, { onEvent: (e) => events.push(e) });
});

/** A board on both sides, in sync. */
async function synced(title = 'Checkout', name = 'Cart') {
  const b = local.add(title, docWith(name));
  await engine.syncAll();
  events.length = 0;
  gh.calls.length = 0;
  return b;
}
/** Simulates another device saving a new version to GitHub. */
function remoteEdit(id: ID, name: string, updatedAt: number, title?: string) {
  const cur = gh.read(id)!;
  return gh.seed({ ...cur.board, updatedAt, ...(title ? { title } : {}) }, docWith(name));
}

// ---------- file format ----------

describe('board file', () => {
  it('round-trips, is pretty-printed, and leaves device-only fields behind', () => {
    const board: Board = { id: 'abc', title: 'Ünïcode ✓', schemaVersion: 1, createdAt: 1, updatedAt: 2, shareId: 'secret', thumbnail: 'data:x' };
    const text = serializeBoardFile(board, docWith('Home'));
    expect(text).toContain('\n  "format": "ui-workflow-editor/board"');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('thumbnail');
    const file = parseBoardFile(text, 'abc')!;
    expect(file.board).toEqual({ id: 'abc', title: 'Ünïcode ✓', schemaVersion: 1, createdAt: 1, updatedAt: 2 });
    expect(screenNames(file.doc)).toEqual(['Home']);
  });

  it('carries the folder and Trash state', () => {
    const board: Board = { id: 'abc', title: 't', schemaVersion: 1, createdAt: 1, updatedAt: 2, folderId: 'f1', folderName: 'Research', trashedAt: 5 };
    const file = parseBoardFile(serializeBoardFile(board, emptyDoc()), 'abc')!;
    expect(file.board).toEqual(board);
  });

  it('rejects files that are not board files or are for another id', () => {
    const text = serializeBoardFile({ id: 'abc', title: 't', schemaVersion: 1, createdAt: 1, updatedAt: 2 }, emptyDoc());
    expect(parseBoardFile(text, 'other')).toBeNull();
    expect(parseBoardFile('{oops', 'abc')).toBeNull();
    expect(parseBoardFile(JSON.stringify({ format: 'x', version: 1 }), 'abc')).toBeNull();
    expect(parseBoardFile(text.replace('"frames": {}', '"frames": 3'), 'abc')).toBeNull();
  });

  it('content hash ignores updatedAt and key order but sees real changes', () => {
    const b: Board = { id: 'a', title: 'T', schemaVersion: 1, createdAt: 1, updatedAt: 2 };
    const doc = docWith('X');
    expect(contentHash({ ...b, updatedAt: 99 }, doc)).toBe(contentHash(b, JSON.parse(JSON.stringify(doc))));
    expect(contentHash({ ...b, title: 'U' }, doc)).not.toBe(contentHash(b, doc));
    expect(contentHash(b, docWith('Y'))).not.toBe(contentHash(b, doc));
  });
});

// ---------- engine rules ----------

describe('SyncEngine', () => {
  it('first connection uploads every local board', async () => {
    const a = local.add('A', docWith('a'));
    const b = local.add('B', docWith('b'));
    await engine.syncAll();
    expect(gh.files.size).toBe(2);
    expect(screenNames(gh.read(a.id)!.doc)).toEqual(['a']);
    expect(gh.read(b.id)!.board.title).toBe('B');
    expect(store.state.boards[a.id]).toMatchObject({ sha: gh.files.get(a.id)!.sha, updatedAt: 1000 });
    expect(events.filter((e) => e.type === 'uploaded')).toHaveLength(2);
    expect(engine.isDirty(a.id)).toBe(false);
  });

  it('downloads a board that only exists on GitHub', async () => {
    gh.seed({ id: 'remote1', title: 'From laptop', schemaVersion: 1, createdAt: 1, updatedAt: 3000 }, docWith('Login'));
    await engine.syncAll();
    expect(local.get('remote1')).toMatchObject({ title: 'From laptop', updatedAt: 3000 });
    expect(screenNames(local.docs.get('remote1')!)).toEqual(['Login']);
    expect(events).toEqual([{ type: 'downloaded', id: 'remote1', isNew: true }]);
    expect(gh.calls.filter((c) => c.startsWith('put'))).toEqual([]);
  });

  it('replaces the local copy when only GitHub changed (keeping the local share id)', async () => {
    const b = await synced();
    local.boards.set(b.id, { ...local.get(b.id)!, shareId: 'share1' });
    remoteEdit(b.id, 'Cart v2', 2000, 'Checkout v2');
    await engine.syncAll();
    expect(local.get(b.id)).toMatchObject({ title: 'Checkout v2', updatedAt: 2000, shareId: 'share1' });
    expect(screenNames(local.docs.get(b.id)!)).toEqual(['Cart v2']);
    expect(events).toEqual([{ type: 'downloaded', id: b.id, isNew: false }]);
    expect(engine.isDirty(b.id)).toBe(false);
  });

  it('uploads when only this device changed', async () => {
    const b = await synced();
    const before = gh.files.get(b.id)!.sha;
    local.edit(b.id, docWith('Cart v2'), 2000);
    expect(engine.isDirty(b.id)).toBe(true);
    await engine.syncBoard(b.id);
    expect(gh.files.get(b.id)!.sha).not.toBe(before);
    expect(screenNames(gh.read(b.id)!.doc)).toEqual(['Cart v2']);
    expect(engine.isDirty(b.id)).toBe(false);
  });

  it('does not upload when only updatedAt moved (no real change)', async () => {
    const b = await synced();
    local.edit(b.id, local.docs.get(b.id)!, 2000);
    await engine.syncBoard(b.id);
    expect(gh.calls).toEqual([]);
    expect(engine.isDirty(b.id)).toBe(false);
  });

  it('keeps both when both sides changed', async () => {
    const b = await synced('Checkout');
    remoteEdit(b.id, 'Remote edit', 2000);
    local.edit(b.id, docWith('Local edit'), 2500);
    await engine.syncAll();
    // Local keeps its id and goes up to GitHub…
    expect(screenNames(local.docs.get(b.id)!)).toEqual(['Local edit']);
    expect(screenNames(gh.read(b.id)!.doc)).toEqual(['Local edit']);
    // …and GitHub's version is kept as a new board.
    const copy = local.list().find((x) => x.title === `Checkout${CONFLICT_SUFFIX}`)!;
    expect(copy).toBeDefined();
    expect(screenNames(local.docs.get(copy.id)!)).toEqual(['Remote edit']);
    expect(events).toContainEqual({ type: 'conflict', id: b.id, copyId: copy.id, title: 'Checkout' });
    // The copy is uploaded too on the next pass, so nothing exists only here.
    await engine.syncAll();
    expect(gh.read(copy.id)?.board.title).toBe(`Checkout${CONFLICT_SUFFIX}`);
  });

  it('treats both-changed-to-the-same-content as synced', async () => {
    const b = await synced();
    remoteEdit(b.id, 'Same', 2000);
    local.edit(b.id, docWith('Same'), 2500);
    // docWith creates new random ids, so make local content identical to GitHub's.
    local.docs.set(b.id, gh.read(b.id)!.doc);
    await engine.syncAll();
    expect(local.list()).toHaveLength(1);
    expect(gh.calls.filter((c) => c.startsWith('put'))).toEqual([]);
    expect(engine.isDirty(b.id)).toBe(false);
  });

  it('deletes the GitHub file after a local delete', async () => {
    const b = await synced();
    local.deleteForGood(b.id, store);
    expect(store.state.boards[b.id].deleted).toBe(true);
    await engine.syncBoard(b.id);
    expect(gh.files.has(b.id)).toBe(false);
    expect(store.state.boards[b.id]).toBeUndefined();
    expect(events).toEqual([{ type: 'deleted-remote', id: b.id }]);
  });

  it('brings a locally deleted board back if it changed on GitHub meanwhile', async () => {
    const b = await synced();
    local.deleteForGood(b.id, store);
    remoteEdit(b.id, 'Edited elsewhere', 3000);
    await engine.syncAll();
    expect(gh.files.has(b.id)).toBe(true);
    expect(screenNames(local.docs.get(b.id)!)).toEqual(['Edited elsewhere']);
  });

  it('removes the local copy when the GitHub file was deleted elsewhere', async () => {
    const b = await synced('Old idea');
    gh.files.delete(b.id);
    await engine.syncAll();
    expect(local.get(b.id)).toBeUndefined();
    expect(store.state.boards[b.id]).toBeUndefined();
    expect(events).toEqual([{ type: 'removed', id: b.id, title: 'Old idea' }]);
  });

  it('re-uploads (never drops) a board deleted elsewhere that has unsynced changes here', async () => {
    const b = await synced();
    gh.files.delete(b.id);
    local.edit(b.id, docWith('Unsynced work'), 2000);
    await engine.syncAll();
    expect(local.get(b.id)).toBeDefined();
    expect(screenNames(gh.read(b.id)!.doc)).toEqual(['Unsynced work']);
  });

  it('leaves boards in the delete undo window alone', async () => {
    const b = await synced();
    local.pending.add(b.id);
    local.edit(b.id, docWith('x'), 2000);
    gh.files.delete(b.id);
    await engine.syncAll();
    expect(local.get(b.id)).toBeDefined();
    expect(gh.files.has(b.id)).toBe(false);
  });

  it('re-downloads a synced board missing here without a delete record (e.g. storage cleared)', async () => {
    const b = await synced();
    local.boards.delete(b.id);
    await engine.syncAll();
    expect(local.get(b.id)).toBeDefined();
    expect(gh.files.has(b.id)).toBe(true);
  });

  it('on a sha conflict (someone wrote first) re-reads and applies the rules', async () => {
    const b = await synced('Checkout');
    local.edit(b.id, docWith('Local'), 2500);
    // Another device writes right before our upload lands.
    gh.beforePut = (id) => { if (id === b.id) { gh.beforePut = undefined; remoteEdit(b.id, 'Other device', 2400); } };
    await engine.syncBoard(b.id);
    expect(gh.calls.filter((c) => c === `put ${b.id}`)).toHaveLength(2);
    expect(screenNames(gh.read(b.id)!.doc)).toEqual(['Local']);
    const copy = local.list().find((x) => x.title.endsWith(CONFLICT_SUFFIX));
    expect(copy && screenNames(local.docs.get(copy.id)!)).toEqual(['Other device']);
  });

  it('a 422 on create (file already exists) re-reads instead of failing', async () => {
    const b = local.add('New', docWith('mine'));
    gh.seed({ ...b, updatedAt: 1000 }, local.docs.get(b.id)!); // identical content already there
    store.state.boards = {};
    await engine.syncBoard(b.id);
    expect(engine.isDirty(b.id)).toBe(false);
    expect(local.list()).toHaveLength(1);
  });

  it('surfaces network errors (so the runtime can retry) without losing state', async () => {
    const b = await synced();
    local.edit(b.id, docWith('v2'), 2000);
    gh.failPut.set(b.id, 0);
    await expect(engine.syncBoard(b.id)).rejects.toMatchObject({ status: 0, isTransient: true });
    expect(engine.isDirty(b.id)).toBe(true);
    await engine.syncBoard(b.id);
    expect(screenNames(gh.read(b.id)!.doc)).toEqual(['v2']);
  });

  it('runs one task per board at a time and limits concurrency', async () => {
    let inFlight = 0;
    let peak = 0;
    const realPut = gh.put.bind(gh);
    gh.put = async (...args) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      try { return await realPut(...args); } finally { inFlight--; }
    };
    for (let i = 0; i < 6; i++) local.add(`B${i}`, docWith(`s${i}`));
    const first = local.list()[0].id;
    await Promise.all([engine.syncAll(), engine.syncBoard(first), engine.syncBoard(first)]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(gh.files.size).toBe(6);
    expect(gh.calls.filter((c) => c === `put ${first}`)).toHaveLength(1);
  });

  it('skips unreadable GitHub files instead of importing them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    gh.files.set('junk', { text: 'not json', sha: 'x' });
    await engine.syncAll();
    expect(local.get('junk')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
