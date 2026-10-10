// Browser wiring for "Save to GitHub": signs in state → finds the boards repo → runs the sync
// engine in the background (after edits, on focus, when coming back online, on the dashboard).
// Loaded lazily (App.tsx) and only when the feature is configured.
import type { Board, ID } from '../../model/types';
import { ensureFolder } from '../folders';
import { deleteBoardMeta, getBoard, listBoards, restoreBoardMeta, subscribeBoards } from '../boardIndex';
import { importBoard, pendingDeleteIds } from '../boards';
import { BOARDS_REPO } from './config';
import { getAuthState, saveAuth, subscribeAuth, type GitHubUser } from './auth';
import { GitHubError, SignedOutError, findBoardsRepo, gh, githubBoardsApi, type RepoRef } from './api';
import { SyncEngine, type LocalBoards, type SyncEvent } from './sync';
import { localSyncStore, onLocalDelete } from './syncState';

const persistence = () => import('../../store/persistence');

export const PUSH_DEBOUNCE_MS = 3000;
export const FOCUS_THROTTLE_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export type SyncPhase =
  | 'signed-out'
  /** The session ended (refresh failed): "Sign in again". */
  | 'expired'
  | 'connecting'
  /** Signed in, but the app can't see a ui-workflow-boards repo yet. */
  | 'needs-setup'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

export interface SyncSnapshot {
  phase: SyncPhase;
  user?: GitHubUser;
  repo?: RepoRef;
  /** Boards with an upload waiting or in progress. */
  pending: ReadonlySet<ID>;
  /** Bumps whenever per-board sync state may have changed. */
  rev: number;
  lastEvent?: SyncEvent;
}

// ---------- local boards adapter ----------

const localBoards: LocalBoards = {
  list: listBoards,
  get: getBoard,
  isPendingDelete: (id) => pendingDeleteIds().includes(id),
  readDoc: async (id) => (await persistence()).readBoardDoc(id),
  async write(board: Board, doc) {
    await (await persistence()).writeInitialDoc(board.id, doc);
    ensureFolder(board);
    restoreBoardMeta(board);
  },
  createCopy: (title, doc) => importBoard({ title, doc }),
  async remove(id) {
    deleteBoardMeta(id);
    await (await persistence()).deleteBoardData(id);
  },
};

// ---------- state ----------

let snapshot: SyncSnapshot = { phase: 'signed-out', pending: new Set(), rev: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...patch, rev: snapshot.rev + 1 };
  listeners.forEach((l) => l());
}

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot;
}
export function subscribeSync(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

let engine: SyncEngine | null = null;
let generation = 0;
const timers = new Map<ID, ReturnType<typeof setTimeout>>();
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let backoff = 5000;
let lastFullSync = 0;
let fullSync: Promise<void> | null = null;
/** Which connection the running full sync belongs to; a stale one must not stand in for a new one. */
let fullSyncGen = -1;
const seenUpdatedAt = new Map<ID, number>();

const repoKey = (r: RepoRef) => `${r.owner}/${r.name}`;

function setPending(id: ID, on: boolean) {
  const next = new Set(snapshot.pending);
  if (on) next.add(id); else next.delete(id);
  set({ pending: next });
}

function settledPhase(): SyncPhase {
  return snapshot.pending.size ? 'syncing' : 'synced';
}

function handleError(err: unknown) {
  if (err instanceof SignedOutError) { onAuth(); return; }
  // 404 on the repo itself: it went away or access was removed, so look for it again.
  const lostRepo = err instanceof GitHubError && err.isNotFound;
  const transient = err instanceof GitHubError ? err.isTransient : false;
  if (!transient) console.warn('[github-sync]', err instanceof Error ? err.message : err);
  set({ phase: transient || !(err instanceof GitHubError) && !navigator.onLine ? 'offline' : 'error' });
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (lostRepo) recheckSetup(); else void syncNow(); }, backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
}

function succeeded() {
  backoff = 5000;
  clearTimeout(retryTimer);
  set({ phase: settledPhase() });
}

/** Full two-way sync now (deduplicated while one is running). */
export function syncNow(): Promise<void> {
  if (!engine) return fullSync ?? Promise.resolve();
  if (fullSync && fullSyncGen === generation) return fullSync;
  const e = engine;
  const gen = generation;
  fullSyncGen = gen;
  set({ phase: 'syncing' });
  fullSync = e.syncAll().then(
    () => { if (gen === generation) { lastFullSync = Date.now(); succeeded(); } },
    (err) => { if (gen === generation) handleError(err); },
  );
  const mine = fullSync;
  void mine.finally(() => { if (fullSync === mine) fullSync = null; });
  return mine;
}

/** Full sync unless one ran in the last `minGapMs` (focus, dashboard visits). */
export function requestSync(minGapMs = 5000) {
  if (engine && Date.now() - lastFullSync >= minGapMs) void syncNow();
}

function pushBoard(id: ID) {
  timers.delete(id);
  const e = engine;
  if (!e) { setPending(id, false); return; }
  const gen = generation;
  e.syncBoard(id).then(
    () => { if (gen !== generation) return; setPending(id, false); succeeded(); },
    (err) => { if (gen !== generation) return; setPending(id, false); handleError(err); },
  );
}

function schedule(id: ID, delay = PUSH_DEBOUNCE_MS) {
  if (!engine) return;
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => pushBoard(id), delay));
  if (!snapshot.pending.has(id)) setPending(id, true);
  if (snapshot.phase === 'synced') set({ phase: 'syncing' });
}

/** Uploads everything waiting right away (page hidden / closing). */
function flushScheduled() {
  for (const [id, t] of timers) { clearTimeout(t); pushBoard(id); }
}

function onBoardsChanged() {
  const boards = listBoards();
  const ids = new Set<ID>();
  for (const b of boards) {
    ids.add(b.id);
    const prev = seenUpdatedAt.get(b.id);
    seenUpdatedAt.set(b.id, b.updatedAt);
    if (prev !== b.updatedAt && engine?.isDirty(b.id)) schedule(b.id);
  }
  for (const id of seenUpdatedAt.keys()) if (!ids.has(id)) seenUpdatedAt.delete(id);
  set({});
}

// ---------- connection ----------

async function connect(gen: number) {
  const state = getAuthState();
  if (state.status !== 'signed-in') return;
  set({ phase: 'connecting', user: state.auth.user });
  try {
    let user = state.auth.user;
    if (!user) {
      const u = await gh<{ login: string; avatar_url: string }>('/user');
      user = { login: u.login, avatarUrl: u.avatar_url };
      const now = getAuthState();
      if (now.status === 'signed-in') saveAuth({ ...now.auth, user });
    }
    if (gen !== generation) return;
    const stored = localSyncStore.read();
    let repo: RepoRef | null = null;
    // Cheap check for the repo we used last time; otherwise search the installations.
    if (stored.repo) {
      const [owner, name] = stored.repo.split('/');
      try {
        const r = await gh<{ default_branch?: string; owner: { login: string } }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
        if (r.owner.login.toLowerCase() === user.login.toLowerCase()) repo = { owner, name, branch: r.default_branch || 'main' };
      } catch (e) {
        if (!(e instanceof GitHubError && e.isNotFound)) throw e;
      }
    }
    repo ??= await findBoardsRepo(user.login);
    if (gen !== generation) return;
    if (!repo) {
      engine = null;
      set({ phase: 'needs-setup', user, repo: undefined });
      return;
    }
    if (stored.repo !== repoKey(repo)) localSyncStore.write({ repo: repoKey(repo), boards: {} });
    engine = new SyncEngine(githubBoardsApi(repo), localBoards, localSyncStore, { onEvent: (e) => set({ lastEvent: e }) });
    set({ user, repo });
    for (const b of listBoards()) seenUpdatedAt.set(b.id, b.updatedAt);
    await syncNow();
    // Safety net: a second pass shortly after connecting catches boards a racing first pass missed.
    setTimeout(() => { if (gen === generation && engine) void syncNow(); }, 4000);
  } catch (err) {
    if (gen !== generation) return;
    if (err instanceof SignedOutError) { onAuth(); return; }
    const transient = err instanceof GitHubError ? err.isTransient : !navigator.onLine;
    if (!transient) console.warn('[github-sync]', err instanceof Error ? err.message : err);
    set({ phase: transient ? 'offline' : 'error' });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (gen === generation) void connect(gen); }, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  }
}

/** Look for the boards repo again (after "Give access" / creating it). */
export function recheckSetup() {
  generation++;
  engine = null;
  void connect(generation);
}

let lastLogin: string | undefined;
function onAuth() {
  const state = getAuthState();
  const login = state.status === 'signed-in' ? state.auth.user?.login ?? '' : undefined;
  const changed = (state.status === 'signed-in') !== (lastLogin !== undefined) || (login && lastLogin && login !== lastLogin);
  lastLogin = login;
  if (state.status !== 'signed-in') {
    generation++;
    engine = null;
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    clearTimeout(retryTimer);
    set({ phase: state.reason === 'expired' ? 'expired' : 'signed-out', user: undefined, repo: undefined, pending: new Set() });
    return;
  }
  if (changed) {
    generation++;
    engine = null;
    void connect(generation);
  } else if (state.auth.user && !snapshot.user) {
    set({ user: state.auth.user });
  }
}

let started = false;

/** Starts background sync for this tab (idempotent). */
export function startGitHubSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  subscribeAuth(onAuth);
  subscribeBoards(onBoardsChanged);
  onLocalDelete((id) => schedule(id, 0));
  let lastFocus = 0;
  window.addEventListener('focus', () => {
    if (Date.now() - lastFocus < FOCUS_THROTTLE_MS) return;
    lastFocus = Date.now();
    requestSync(FOCUS_THROTTLE_MS);
  });
  window.addEventListener('online', () => { if (engine) void syncNow(); else if (getAuthState().status === 'signed-in') recheckSetup(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushScheduled(); });
  window.addEventListener('pagehide', flushScheduled);
  onAuth();
}

// ---------- per-board status (editor header) ----------

export type BoardCloudStatus = 'saved' | 'saving' | 'offline' | 'signed-out' | 'needs-setup' | 'connecting' | 'error';

export function boardCloudStatus(id: ID, snap: SyncSnapshot = snapshot): BoardCloudStatus {
  switch (snap.phase) {
    case 'signed-out':
    case 'expired':
      return 'signed-out';
    case 'needs-setup':
      return 'needs-setup';
    case 'connecting':
      return 'connecting';
    case 'offline':
      return 'offline';
    default:
  }
  if (snap.pending.has(id)) return 'saving';
  if (engine?.isDirty(id)) return snap.phase === 'error' ? 'error' : 'saving';
  return snap.phase === 'error' ? 'error' : 'saved';
}

export function repoUrl(repo: RepoRef | undefined, login?: string): string {
  return repo ? `https://github.com/${repo.owner}/${repo.name}` : `https://github.com/${login ?? ''}/${BOARDS_REPO}`;
}
