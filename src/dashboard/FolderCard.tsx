import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Folder, ID } from '../model/types';
import { ICON_STROKE } from '../chrome/shared';
import { BOARD_DND_TYPE, RenameInput } from './BoardCard';
import { copy } from './copy';

export type FolderAction = 'open' | 'delete';

/** Accepts a dragged board card: returns handlers + whether a board is hovering. */
export function useBoardDrop(onDropBoard: (boardId: ID) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(BOARD_DND_TYPE);
  return {
    over,
    handlers: {
      onDragEnter: (e: DragEvent) => { if (!accepts(e)) return; e.preventDefault(); depth.current++; setOver(true); },
      onDragOver: (e: DragEvent) => { if (!accepts(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
      onDragLeave: (e: DragEvent) => { if (!accepts(e)) return; if (--depth.current <= 0) { depth.current = 0; setOver(false); } },
      onDrop: (e: DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const id = e.dataTransfer.getData(BOARD_DND_TYPE);
        if (id) onDropBoard(id);
      },
    },
  };
}

export function FolderCard({ folder, count, startRenaming, onAction, onRename, onDropBoard }: {
  folder: Folder;
  count: number;
  /** Open in rename mode (right after "New folder"). */
  startRenaming?: boolean;
  onAction: (action: FolderAction, folder: Folder) => void;
  onRename: (folder: Folder, name: string) => void;
  onDropBoard: (boardId: ID, folder: Folder) => void;
}) {
  const [renaming, setRenaming] = useState(Boolean(startRenaming));
  const linkRef = useRef<HTMLAnchorElement>(null);
  const refocusLink = useRef(false);
  const { over, handlers } = useBoardDrop((id) => onDropBoard(id, folder));

  useEffect(() => {
    if (!renaming && refocusLink.current) {
      refocusLink.current = false;
      linkRef.current?.focus();
    }
  }, [renaming]);

  const finish = (name: string | undefined, viaKeyboard: boolean) => {
    if (name !== undefined && name.trim() && name.trim() !== folder.name) onRename(folder, name);
    refocusLink.current = viaKeyboard;
    setRenaming(false);
  };
  const onLinkKey = (e: KeyboardEvent) => {
    if (e.key === 'F2') { e.preventDefault(); setRenaming(true); }
  };

  const titleId = `folder-title-${folder.id}`;
  const meta = copy.folders.count(count);

  return (
    <li className="fsd-board fsd-folder" data-testid="folder-card" data-drop-over={over || undefined} {...handlers}>
      {renaming ? (
        <div className="fsd-board__main">
          <FolderThumb />
          <span className="fsd-board__text">
            <RenameInput initial={folder.name} label={copy.folders.renameLabel} onDone={finish} />
            <span className="fsd-board__meta">{meta}</span>
          </span>
        </div>
      ) : (
        <Link ref={linkRef} to={`/folder/${folder.id}`} className="fsd-board__main" onKeyDown={onLinkKey} aria-describedby={`${titleId}-meta`}>
          <FolderThumb />
          <span className="fsd-board__text">
            <span className="fsd-board__title" id={titleId}>{folder.name}</span>
            <span className="fsd-board__meta" id={`${titleId}-meta`}>{over ? copy.folders.dropHint(folder.name) : meta}</span>
          </span>
        </Link>
      )}
      <FolderMenu folder={folder} onAction={onAction} onRename={() => setRenaming(true)} />
    </li>
  );
}

function FolderMenu({ folder, onAction, onRename }: {
  folder: Folder;
  onAction: (action: FolderAction, folder: Folder) => void;
  onRename: () => void;
}) {
  const startRename = useRef(false);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" className="fsc-btn fsc-btn--icon fsd-board__menu" aria-label={copy.folders.menuLabel(folder.name)}>
          <MoreHorizontal size={18} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="fsc-float fsc-menu fsc-root"
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(e) => {
            if (startRename.current) { e.preventDefault(); startRename.current = false; onRename(); }
          }}
        >
          <Menu.Item className="fsc-menu__item" onSelect={() => onAction('open', folder)}>
            <ExternalLink size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{copy.folders.open}</span>
          </Menu.Item>
          <Menu.Item className="fsc-menu__item" onSelect={() => { startRename.current = true; }}>
            <Pencil size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{copy.folders.rename}</span>
            <span className="fsc-menu__shortcut">F2</span>
          </Menu.Item>
          <Menu.Separator className="fsc-menu__sep" />
          <Menu.Item className="fsc-menu__item" onSelect={() => onAction('delete', folder)}>
            <Trash2 size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{copy.folders.delete}</span>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Lo-fi folder: a tabbed outline holding two small screens. */
export function FolderThumb() {
  return (
    <span className="fsd-thumb fsd-thumb--board fsd-thumb--folder" aria-hidden>
      <svg width="120" height="72" viewBox="0 0 120 72" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16 a4 4 0 0 1 4 -4 H48 l6 6 H94 a4 4 0 0 1 4 4 V58 a4 4 0 0 1 -4 4 H26 a4 4 0 0 1 -4 -4 Z" stroke="var(--fs-gray-4)" strokeWidth="2" fill="var(--fs-surface)" />
        <rect x="34" y="28" width="22" height="24" rx="3" fill="var(--fs-gray-2)" />
        <rect x="64" y="28" width="22" height="24" rx="3" fill="var(--fs-gray-2)" />
        <path d="M22 24 H98" stroke="var(--fs-gray-3)" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
