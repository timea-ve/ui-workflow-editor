import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ID } from '../model/types';
import { openBoardSession, type BoardSession, type SaveState } from './persistence';

/** Opens a persisted board session for the lifetime of the component. `null` until loaded. */
export function useBoardSession(boardId: ID | undefined, enabled = true): BoardSession | null {
  const [session, setSession] = useState<BoardSession | null>(null);
  useEffect(() => {
    if (!boardId || !enabled) return;
    const s = openBoardSession(boardId);
    let alive = true;
    void s.ready.then(() => { if (alive) setSession(s); });
    return () => {
      alive = false;
      setSession(null);
      void s.close();
    };
  }, [boardId, enabled]);
  return session;
}

const noop = () => () => {};
export function useSaveState(session: BoardSession | null): SaveState {
  return useSyncExternalStore(session?.subscribeSaveState ?? noop, () => session?.getSaveState() ?? 'saved');
}
