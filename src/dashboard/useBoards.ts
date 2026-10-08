import { useCallback, useEffect, useState } from 'react';
import type { Board } from '../model/types';
import { listBoards, subscribeBoards } from '../platform/boardIndex';

export type BoardsState =
  | { status: 'ready'; boards: Board[] }
  | { status: 'error'; boards: Board[] };

function load(prev: Board[] = []): BoardsState {
  try {
    return { status: 'ready', boards: listBoards() };
  } catch {
    return { status: 'error', boards: prev };
  }
}

/**
 * Live board list. The index is synchronous localStorage, so there is no loading phase;
 * errors (e.g. storage blocked) keep the last good list and expose `retry`.
 */
export function useBoards() {
  const [state, setState] = useState<BoardsState>(() => load());
  const refresh = useCallback(() => setState((s) => load(s.boards)), []);
  useEffect(() => subscribeBoards(refresh), [refresh]);
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
