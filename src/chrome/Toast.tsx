import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ICON_STROKE } from './shared';

export interface ToastMessage {
  id: string;
  message: string;
  /** e.g. "Undo". */
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastsProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  /** Auto-dismiss after this many ms (paused while hovered or focused). */
  duration?: number;
}

/** Bottom-centre toast stack. Messages are also announced to screen readers (polite). */
export function Toasts({ toasts, onDismiss, duration = 5000 }: ToastsProps) {
  return (
    <ol className="fsc-toasts fsc-root" aria-live="polite" aria-relevant="additions" aria-label="Notifications">
      {toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={onDismiss} duration={duration} />)}
    </ol>
  );
}

function Toast({ toast, onDismiss, duration }: { toast: ToastMessage; onDismiss: (id: string) => void; duration: number }) {
  const [paused, setPaused] = useState(false);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => dismiss.current(toast.id), duration);
    return () => clearTimeout(t);
  }, [paused, duration, toast.id]);

  return (
    <li className="fsc-toast" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span>{toast.message}</span>
      {toast.actionLabel && (
        <button type="button" className="fsc-btn" onClick={() => { toast.onAction?.(); onDismiss(toast.id); }}>{toast.actionLabel}</button>
      )}
      <button type="button" className="fsc-btn fsc-btn--icon" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
        <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </li>
  );
}

/** Screen-reader-only announcer for canvas actions ("Linked to Screen 3"). */
export function Announcer({ message }: { message: string }) {
  return <div className="fsc-sr-only" role="status" aria-live="polite">{message}</div>;
}
