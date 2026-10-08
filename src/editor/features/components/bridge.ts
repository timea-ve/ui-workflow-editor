// Tiny module-level bridge so memoised canvas nodes (KitNode / ScreenNode) can commit edits without
// subscribing to the editor context (which changes on every doc change and would re-render every node).
// The CanvasLayer (mounted in the editor's `canvas` slot) publishes; nodes read it with useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import type { BoardDoc, ID } from '../../../model/types';
import type { DocOp, EditorApplyOptions } from '../../EditorContext';

export interface ComponentsBridge {
  apply(op: DocOp, opts?: EditorApplyOptions): boolean;
  getDoc(): BoardDoc;
  announce(message: string): void;
  /** Start inline text editing for a node (element text or screen name). */
  editText(id: ID): void;
}

interface BridgeState { api: ComponentsBridge | null; editable: boolean }

let state: BridgeState = { api: null, editable: false };
const listeners = new Set<() => void>();

export function setBridge(next: BridgeState) {
  if (next.api === state.api && next.editable === state.editable) return;
  state = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getApi = () => (state.editable ? state.api : null);

/** The bridge when the canvas is editable (select tool, not read-only); null otherwise. */
export function useEditableBridge(): ComponentsBridge | null {
  return useSyncExternalStore(subscribe, getApi, getApi);
}
