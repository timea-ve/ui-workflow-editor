import { useCallback, useEffect, useState } from 'react';
import type { Board, Folder } from '../model/types';
import { isLive, listBoards, subscribeBoards } from '../platform/boardIndex';
import { listFolders, subscribeFolders } from '../platform/folders';
import { trashCount } from '../platform/trash';

interface Lists {
  /** Live boards (not in Trash), newest first. */
  boards: Board[];
  /** Live folders, A→Z. */
  folders: Folder[];
  /** Items in Trash (folders count once). */
  trash: number;
}
export type BoardsState = ({ status: 'ready' } | { status: 'error' }) & Lists;

const EMPTY: Lists = { boards: [], folders: [], trash: 0 };

function load(prev: Lists = EMPTY): BoardsState {
  try {
    return {
      status: 'ready',
      boards: listBoards().filter(isLive),
      folders: listFolders().filter((f) => f.trashedAt === undefined),
      trash: trashCount(),
    };
  } catch {
    return { status: 'error', boards: prev.boards, folders: prev.folders, trash: prev.trash };
  }
}

/**
 * Live board + folder lists. The index is synchronous localStorage, so there is no loading phase;
 * errors (e.g. storage blocked) keep the last good lists and expose `retry`.
 */
export function useBoards() {
  const [state, setState] = useState<BoardsState>(() => load());
  const refresh = useCallback(() => setState((s) => load(s)), []);
  useEffect(() => {
    const a = subscribeBoards(refresh);
    const b = subscribeFolders(refresh);
    return () => { a(); b(); };
  }, [refresh]);
  return { ...state, retry: refresh };
}

/** Current time, refreshed every `ms` so "Edited 3 min ago" stays true. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
