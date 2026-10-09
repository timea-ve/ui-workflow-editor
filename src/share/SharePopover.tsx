import { useCallback, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Check, Copy, LoaderCircle, RefreshCw, Share2 } from 'lucide-react';
import type { BoardDoc, ID } from '../model/types';
import { Toasts, type ToastMessage } from '../chrome/Toast';
import { ICON_STROKE } from '../chrome/shared';
import { getShareState, publishShare, revokeShare, type ShareState } from './client';
import './share.css';

export interface SharePopoverProps {
  boardId: ID;
  title: string;
  getDoc: () => BoardDoc;
  /** Host-provided toast; when omitted the popover shows its own. */
  notify?: (message: string) => void;
}

type Busy = 'on' | 'update' | 'off' | null;

function messageFor(e: unknown): string {
  console.error(e);
  return 'Couldn’t create the link. Try again in a moment.';
}

async function copyText(text: string, fallbackInput?: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallbackInput) return false;
    fallbackInput.select();
    return document.execCommand?.('copy') ?? false;
  }
}

function timeAgo(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString();
}

/** The panel body: toggle, link, copy, update. Usable inside any popover/menu host. */
export function SharePanel({ boardId, title, getDoc, notify }: SharePopoverProps) {
  const [state, setState] = useState<ShareState | null>(() => getShareState(boardId));
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const toast = useCallback((message: string) => {
    if (notify) notify(message);
    else setToasts((t) => [...t, { id: `${Date.now()}-${Math.random()}`, message }]);
  }, [notify]);

  const publish = async (kind: 'on' | 'update') => {
    setBusy(kind);
    setError(null);
    try {
      const r = await publishShare(boardId, title, getDoc());
      setState(getShareState(boardId));
      if (kind === 'update') toast(r.created ? 'Link is on' : 'New link ready — copy it to share your latest changes');
      else toast('Link is on');
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(null);
    }
  };

  const turnOff = async () => {
    setBusy('off');
    setError(null);
    try {
      await revokeShare(boardId);
      setState(null);
      toast('Link turned off here — links you already sent still work');
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!state) return;
    const ok = await copyText(state.url, inputRef.current);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast('Link copied');
    } else setError('Couldn’t copy automatically — select the link and copy it.');
  };

  const on = !!state;
  const switchBusy = busy === 'on' || busy === 'off';

  return (
    <div className="fs-share">
      <div className="fs-share__row">
        <div>
          <p id={`${id}-label`} className="fs-share__label">Anyone with the link can view</p>
          <p id={`${id}-desc`} className="fs-share__desc">
            {on ? 'Anyone with the link can view a copy of this board as it is now. It doesn’t change as you edit — choose “Update link” for a new link with your latest changes.'
              : 'Creates a link that holds a read-only copy of this board as it is now. Nobody can edit it.'}
          </p>
        </div>
        <button type="button" role="switch" className="fs-switch" aria-checked={on} aria-labelledby={`${id}-label`} aria-describedby={`${id}-desc`}
          disabled={busy !== null} aria-busy={switchBusy || undefined} onClick={() => (on ? turnOff() : publish('on'))}>
          <span className="fs-switch__thumb" aria-hidden>
            {switchBusy && <LoaderCircle size={12} strokeWidth={2} className="fsc-spin" />}
          </span>
        </button>
      </div>

      {on && (
        <>
          <div className="fs-share__link">
            <label className="fsc-sr-only" htmlFor={`${id}-url`}>Share link</label>
            <input id={`${id}-url`} ref={inputRef} className="fsc-input" readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="fsc-btn fsc-btn--primary" onClick={copy}>
              {copied ? <Check size={16} strokeWidth={ICON_STROKE} aria-hidden /> : <Copy size={16} strokeWidth={ICON_STROKE} aria-hidden />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="fs-share__foot">
            <span className="fs-share__meta">Updated {timeAgo(state.publishedAt)}</span>
            <button type="button" className="fsc-btn fsc-btn--outline" onClick={() => publish('update')} disabled={busy !== null}>
              <RefreshCw size={14} strokeWidth={ICON_STROKE} className={busy === 'update' ? 'fsc-spin' : undefined} aria-hidden />
              {busy === 'update' ? 'Updating…' : 'Update link'}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="fs-share__error" role="alert">
          <AlertCircle size={16} strokeWidth={ICON_STROKE} aria-hidden /> {error}
        </p>
      )}
      {!notify && <Toasts toasts={toasts} onDismiss={(t) => setToasts((all) => all.filter((x) => x.id !== t))} />}
    </div>
  );
}

/** "Share" button + popover. Mount in the editor top bar. */
export function SharePopover(props: SharePopoverProps) {
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const local = useCallback((message: string) => setToasts((t) => [...t, { id: `${Date.now()}-${Math.random()}`, message }]), []);
  const notify = props.notify ?? local;
  return (
    <>
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <span className="fs-share-anchor">
        <Dialog.Trigger asChild>
          <button type="button" className="fsc-btn" aria-haspopup="dialog">
            <Share2 size={16} strokeWidth={ICON_STROKE} aria-hidden /> Share
          </button>
        </Dialog.Trigger>
        <Dialog.Content className="fs-share-pop fsc-float fsc-root" data-kit-style="clean" aria-describedby={undefined}
          onInteractOutside={(e) => { if ((e.target as Element | null)?.closest?.('.fsc-toasts')) e.preventDefault(); }}>
          <Dialog.Title className="fs-share__title">Share</Dialog.Title>
          <SharePanel {...props} notify={notify} />
        </Dialog.Content>
      </span>
    </Dialog.Root>
    {!props.notify && <Toasts toasts={toasts} onDismiss={(t) => setToasts((all) => all.filter((x) => x.id !== t))} />}
    </>
  );
}
