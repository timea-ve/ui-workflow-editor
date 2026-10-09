import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Radix only returns focus to a `Dialog.Trigger`; our dialogs open from buttons and shortcuts instead,
 * so focus fell to <body> on close. Remember what had focus when `open` turned true (layout effect runs
 * before Radix moves focus in) and go back there; in the editor, fall back to the selected canvas item.
 */
export function useReturnFocus(open: boolean) {
  const origin = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    origin.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open]);
  return useCallback((e: Event) => {
    e.preventDefault();
    const el = origin.current;
    origin.current = null;
    const target = el?.isConnected
      ? el
      : document.querySelector<HTMLElement>('.fse-editor .fs-flow-canvas .react-flow__node.selected[data-id]');
    target?.focus({ preventScroll: true });
  }, []);
}
