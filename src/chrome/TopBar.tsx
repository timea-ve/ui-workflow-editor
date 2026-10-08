import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, CloudOff, Columns2, Download, HardDrive, LoaderCircle, Play, RefreshCw, Share2 } from 'lucide-react';
import { BrandMark, ICON_STROKE, MOD_KEY, Tip } from './shared';

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';
export type ExportFormat = 'png' | 'pdf' | 'board';

export interface TopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  saveStatus: SaveStatus;
  onShare?: () => void;
  onExport?: (format: ExportFormat) => void;
  onCompare?: () => void;
  onPlay?: () => void;
  /** Compare needs at least two options; disable otherwise. */
  compareDisabled?: boolean;
  /** Optional slot left of the title (e.g. a link back to the board list). */
  leading?: ReactNode;
  /** Replaces the default Share / Export / Compare / Play buttons (the editor mounts its action slot here). */
  actions?: ReactNode;
}

export function TopBar({ title, onTitleChange, saveStatus, onShare, onExport, onCompare, onPlay, compareDisabled, leading, actions }: TopBarProps) {
  return (
    <header className="fsc-topbar fsc-root">
      {leading ?? <span className="fsc-topbar__brand" aria-hidden><BrandMark /></span>}
      <div className="fsc-topbar__title">
        <InlineTitle value={title} onChange={onTitleChange} />
        <SaveStatusIndicator status={saveStatus} />
      </div>
      <div className="fsc-topbar__actions">
        {actions ?? <>
        <Tip label="Share a read-only link">
          <button type="button" className="fsc-btn" onClick={onShare}>
            <Share2 size={16} strokeWidth={ICON_STROKE} aria-hidden /> Share
          </button>
        </Tip>
        <ExportMenu onExport={(f) => onExport?.(f)} />
        <Tip label={compareDisabled ? 'Duplicate a flow as an option to compare' : 'Compare options side by side'} shortcut="⇧C">
          <button type="button" className="fsc-btn" onClick={compareDisabled ? undefined : onCompare}
            aria-disabled={compareDisabled || undefined} aria-keyshortcuts="Shift+C">
            <Columns2 size={16} strokeWidth={ICON_STROKE} aria-hidden /> Compare
          </button>
        </Tip>
        <span className="fsc-topbar__divider" aria-hidden />
        <Tip label="Click through the flow" shortcut="P">
          <button type="button" className="fsc-btn fsc-btn--primary" onClick={onPlay} aria-keyshortcuts="P">
            <Play size={15} strokeWidth={2} aria-hidden /> Play
          </button>
        </Tip>
        </>}
      </div>
    </header>
  );
}

/** Board title: looks like text, click (or Enter) to edit. Enter saves, Esc cancels. */
export function InlineTitle({ value, onChange, label = 'Board title' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
    else if (wasEditing.current) buttonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onChange(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="fsc-title-input"
        aria-label={label}
        value={draft}
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
        }}
      />
    );
  }
  return (
    <button ref={buttonRef} type="button" className="fsc-title-btn" title="Rename board" aria-label={`${label}: ${value}. Press Enter to rename.`}
      onClick={() => { setDraft(value); setEditing(true); }}>
      {value}
    </button>
  );
}

const STATUS: Record<SaveStatus, { text: string; Icon: typeof Check; spin?: boolean }> = {
  saved: { text: 'Saved on this device', Icon: HardDrive },
  saving: { text: 'Saving…', Icon: LoaderCircle, spin: true },
  offline: { text: 'Offline · saved on this device', Icon: CloudOff },
  error: { text: 'Not saved – retrying', Icon: RefreshCw, spin: true },
};

/** Autosave status. Never conveyed by colour alone: icon + words. */
export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const { text, Icon, spin } = STATUS[status];
  return (
    <span className="fsc-status" role="status" data-status={status}>
      <Icon size={14} strokeWidth={ICON_STROKE} className={spin ? 'fsc-spin' : undefined} aria-hidden />
      {text}
    </span>
  );
}

export function ExportMenu({ onExport }: { onExport: (f: ExportFormat) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="fsc-btn" aria-keyshortcuts={`${MOD_KEY === '⌘' ? 'Meta' : 'Control'}+Shift+E`}>
          <Download size={16} strokeWidth={ICON_STROKE} aria-hidden /> Export
          <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="fsc-float fsc-menu fsc-root" align="end" sideOffset={6}>
          <DropdownMenu.Item className="fsc-menu__item" onSelect={() => onExport('png')}>
            <span className="fsc-menu__label">Image (PNG)</span><span className="fsc-menu__shortcut">{MOD_KEY}⇧E</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item className="fsc-menu__item" onSelect={() => onExport('pdf')}>
            <span className="fsc-menu__label">Document (PDF)</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="fsc-menu__sep" />
          <DropdownMenu.Item className="fsc-menu__item" onSelect={() => onExport('board')}>
            <span className="fsc-menu__label">Board file (backup)</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Global offline banner (UX doc §6). */
export function OfflineBanner() {
  return (
    <div className="fsc-banner fsc-root" role="status">
      <CloudOff size={16} strokeWidth={ICON_STROKE} aria-hidden />
      You're offline — changes are saved on this device.
    </div>
  );
}
