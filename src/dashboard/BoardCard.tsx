import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Copy, ExternalLink, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Board } from '../model/types';
import { ICON_STROKE } from '../chrome/shared';
import { copy, formatRelative } from './copy';

export type BoardAction = 'open' | 'duplicate' | 'copyLink' | 'delete';

export function BoardCard({ board, now, onAction, onRename }: {
  board: Board;
  now: number;
  onAction: (action: BoardAction, board: Board) => void;
  onRename: (board: Board, title: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const refocusLink = useRef(false);

  useEffect(() => {
    if (!renaming && refocusLink.current) {
      refocusLink.current = false;
      linkRef.current?.focus();
    }
  }, [renaming]);

  const finish = (title: string | undefined, viaKeyboard: boolean) => {
    if (title !== undefined && title.trim() && title.trim() !== board.title) onRename(board, title);
    refocusLink.current = viaKeyboard;
    setRenaming(false);
  };

  const onLinkKey = (e: KeyboardEvent) => {
    if (e.key === 'F2') { e.preventDefault(); setRenaming(true); }
  };

  const edited = copy.edited(formatRelative(board.updatedAt, now));
  const titleId = `board-title-${board.id}`;

  return (
    <li className="fsd-board" data-testid="board-card">
      {renaming ? (
        <div className="fsd-board__main">
          <BoardThumb />
          <span className="fsd-board__text">
            <RenameInput initial={board.title} onDone={finish} />
            <span className="fsd-board__meta">{edited}</span>
          </span>
        </div>
      ) : (
        <Link ref={linkRef} to={`/b/${board.id}`} className="fsd-board__main" onKeyDown={onLinkKey} aria-describedby={`${titleId}-meta`}>
          <BoardThumb />
          <span className="fsd-board__text">
            <span className="fsd-board__title" id={titleId}>{board.title}</span>
            <span className="fsd-board__meta" id={`${titleId}-meta`}>{edited}</span>
          </span>
        </Link>
      )}
      <BoardMenu board={board} onAction={onAction} onRename={() => setRenaming(true)} />
    </li>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (title: string | undefined, viaKeyboard: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const end = (title: string | undefined, viaKeyboard: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(title, viaKeyboard);
  };
  return (
    <input
      ref={ref}
      className="fsc-title-input fsd-board__rename"
      aria-label={copy.renameLabel}
      defaultValue={initial}
      maxLength={120}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); end(e.currentTarget.value, true); }
        if (e.key === 'Escape') { e.preventDefault(); end(undefined, true); }
      }}
      onBlur={(e) => end(e.currentTarget.value, false)}
    />
  );
}

function BoardMenu({ board, onAction, onRename }: {
  board: Board;
  onAction: (action: BoardAction, board: Board) => void;
  onRename: () => void;
}) {
  const startRename = useRef(false);
  const canShare = Boolean(board.shareId);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" className="fsc-btn fsc-btn--icon fsd-board__menu" aria-label={copy.menuLabel(board.title)}>
          <MoreHorizontal size={18} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="fsc-float fsc-menu fsc-root"
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(e) => {
            // Let the rename input keep focus instead of returning it to the trigger.
            if (startRename.current) { e.preventDefault(); startRename.current = false; onRename(); }
          }}
        >
          <Menu.Item className="fsc-menu__item" onSelect={() => onAction('open', board)}>
            <ExternalLink size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{copy.menu.open}</span>
          </Menu.Item>
          <Menu.Item className="fsc-menu__item" onSelect={() => { startRename.current = true; }}>
            <Pencil size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{copy.menu.rename}</span>
            <span className="fsc-menu__shortcut">F2</span>
          </Menu.Item>
          <Menu.Item className="fsc-menu__item" onSelect={() => onAction('duplicate', board)}>
            <Copy size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{copy.menu.duplicate}</span>
          </Menu.Item>
          <Menu.Item
            className="fsc-menu__item fsd-menu__item--hint"
            disabled={!canShare}
            onSelect={() => onAction('copyLink', board)}
            aria-describedby={canShare ? undefined : `share-hint-${board.id}`}
          >
            <Link2 size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">
              {copy.menu.copyLink}
              {!canShare && <span className="fsd-menu__hint" id={`share-hint-${board.id}`}>{copy.menu.copyLinkDisabledHint}</span>}
            </span>
          </Menu.Item>
          <Menu.Separator className="fsc-menu__sep" />
          <Menu.Item className="fsc-menu__item" onSelect={() => onAction('delete', board)}>
            <Trash2 size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{copy.menu.delete}</span>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Neutral lo-fi placeholder (two linked screens) — real board thumbnails are parked. */
function BoardThumb() {
  return (
    <span className="fsd-thumb fsd-thumb--board" aria-hidden>
      <svg width="120" height="72" viewBox="0 0 120 72" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="14" y="10" width="32" height="52" rx="5" stroke="var(--fs-gray-4)" strokeWidth="2" fill="var(--fs-surface)" />
        <rect x="20" y="40" width="20" height="6" rx="2" fill="var(--fs-gray-3)" />
        <rect x="20" y="20" width="20" height="12" rx="2" fill="var(--fs-gray-2)" />
        <rect x="74" y="10" width="32" height="52" rx="5" stroke="var(--fs-gray-4)" strokeWidth="2" fill="var(--fs-surface)" />
        <rect x="80" y="20" width="20" height="4" rx="2" fill="var(--fs-gray-3)" />
        <rect x="80" y="28" width="14" height="4" rx="2" fill="var(--fs-gray-3)" />
        <path d="M40 43 H58 V36 H72 M68 32 L72 36 L68 40" stroke="var(--fs-accent)" strokeWidth="1.75" />
      </svg>
    </span>
  );
}
