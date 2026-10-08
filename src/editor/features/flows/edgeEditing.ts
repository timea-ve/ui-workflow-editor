// Which connector label is being edited inline (module store so edges don't subscribe to editor context).
import { useSyncExternalStore } from 'react';
import type { ID } from '../../../model/types';

let editing: ID | null = null;
const listeners = new Set<() => void>();

export function startEdgeLabelEdit(id: ID | null) {
  if (editing === id) return;
  editing = id;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** True only for the edge being edited (other edges keep returning false → no re-render). */
export function useIsEditingEdge(id: ID): boolean {
  return useSyncExternalStore(subscribe, () => editing === id, () => false);
}
