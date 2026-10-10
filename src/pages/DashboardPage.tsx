import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FolderPlus, Plus, Search, Trash2, X } from 'lucide-react';
import type { Board, Folder, ID } from '../model/types';
import { BrandMark, ChromeProvider, Kbd, Tip, Toasts, isTypingTarget, type ToastMessage } from '../chrome';
import { ICON_STROKE } from '../chrome/shared';
import { getBoard, renameBoard } from '../platform/boardIndex';
import { createFolder, getFolder, moveBoardToFolder, renameFolder } from '../platform/folders';
import { purgeExpiredTrash, restoreBoard, restoreFolder, trashBoard, trashFolder } from '../platform/trash';
import { githubEnabled } from '../platform/github/config';
import { getShareState } from '../share/client';
import { commitPendingDeletes, createBoard, duplicateBoard, flushPendingDeletes, UNDO_WINDOW_MS } from '../platform/boards';
import { TEMPLATES } from '../platform/templates';
import { BoardCard, type BoardAction, type MoveTarget } from '../dashboard/BoardCard';
import { ConfirmDialog, type ConfirmRequest } from '../dashboard/ConfirmDialog';
import { FolderCard, useBoardDrop, type FolderAction } from '../dashboard/FolderCard';
import { TemplateCard } from '../dashboard/TemplateCard';
import { copy } from '../dashboard/copy';
import { useBoards, useNow } from '../dashboard/useBoards';
import '../dashboard/dashboard.css';

let toastSeq = 0;

// "Save to GitHub" ships in its own chunk, loaded only when configured (see docs/GITHUB-SAVE.md).
const loadGitHub = () => import('../platform/github/ui/GitHubDashboard');
const GitHubAccount = githubEnabled ? lazy(() => loadGitHub().then((m) => ({ default: m.GitHubAccount }))) : null;
const GitHubSetupPanel = githubEnabled ? lazy(() => loadGitHub().then((m) => ({ default: m.GitHubSetupPanel }))) : null;

export function DashboardPage() {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId?: string }>();
  const { status, boards, folders, trash, retry } = useBoards();
  const now = useNow();
  const [query, setQuery] = useState('');
  /** 'blank' or a template id while a board is being created. */
  const [creating, setCreating] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  /** A folder just created from the dashboard opens in rename mode. */
  const [renameFolderId, setRenameFolderId] = useState<ID | null>(null);
  const creatingRef = useRef(false);

  const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;
  const missingFolder = Boolean(folderId) && !folder;

  const toast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `t${++toastSeq}`;
    setToasts((ts) => [...ts, { ...t, id }]);
    return id;
  }, []);

  const notice = useCallback((message: string) => { toast({ message }); }, [toast]);

  useEffect(() => {
    const prev = document.title;
    document.title = copy.pageTitle;
    flushPendingDeletes().catch(() => {});
    purgeExpiredTrash().catch((err) => console.warn(err));
    return () => {
      document.title = prev;
      commitPendingDeletes();
    };
  }, []);

  // A new view starts with an empty search.
  useEffect(() => { setQuery(''); }, [folderId]);

  const create = useCallback(async (templateId?: string) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(templateId ?? 'blank');
    try {
      const board = await createBoard({ templateId, folderId: folder?.id });
      navigate(`/b/${board.id}`);
    } catch (err) {
      console.error(err);
      toast({ message: copy.toast.createFailed });
    } finally {
      creatingRef.current = false;
      setCreating(null);
    }
  }, [navigate, toast, folder]);

  // "N" on the dashboard = new board (J1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target) || document.querySelector('[role="menu"], [role="alertdialog"]')) return;
      e.preventDefault();
      void create();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [create]);

  const dismissToast = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const move = useCallback((boardId: ID, target: ID | null) => {
    const board = getBoard(boardId);
    if (!board || (board.folderId ?? null) === target) return;
    moveBoardToFolder(boardId, target);
    toast({ message: copy.toast.moved(board.title, target ? getFolder(target)?.name ?? null : null) });
  }, [toast]);

  const onMove = useCallback((board: Board, target: MoveTarget) => {
    if (target === 'new') {
      const f = createFolder();
      moveBoardToFolder(board.id, f.id);
      if (folderId) navigate('/');
      setRenameFolderId(f.id);
      return;
    }
    move(board.id, target);
  }, [move, folderId, navigate]);

  const onAction = useCallback(async (action: BoardAction, board: Board) => {
    switch (action) {
      case 'open':
        navigate(`/b/${board.id}`);
        return;
      case 'duplicate':
        try {
          const copyBoard = await duplicateBoard(board.id);
          toast({ message: copy.toast.duplicated(copyBoard.title) });
        } catch (err) {
          console.error(err);
          toast({ message: copy.toast.duplicateFailed });
        }
        return;
      case 'copyLink': {
        if (!board.shareId) return;
        try {
          const url = getShareState(board.id)?.url;
          if (!url) throw new Error('no share link stored for this board');
          await navigator.clipboard.writeText(url);
          toast({ message: copy.toast.linkCopied });
        } catch {
          toast({ message: copy.toast.linkCopyFailed });
        }
        return;
      }
      case 'delete': {
        if (!trashBoard(board.id)) {
          toast({ message: copy.toast.deleteFailed });
          return;
        }
        toast({
          message: copy.toast.deleted(board.title),
          actionLabel: copy.toast.undo,
          onAction: () => { restoreBoard(board.id); toast({ message: copy.toast.restored(board.title) }); },
        });
      }
    }
  }, [navigate, toast]);

  const onFolderAction = useCallback((action: FolderAction, f: Folder) => {
    if (action === 'open') { navigate(`/folder/${f.id}`); return; }
    const count = boards.filter((b) => b.folderId === f.id).length;
    setConfirm({
      title: copy.folders.confirmTitle(f.name),
      body: copy.folders.confirmBody(count),
      confirmLabel: copy.folders.confirmAction,
      onConfirm: () => {
        trashFolder(f.id);
        toast({
          message: copy.toast.deleted(f.name),
          actionLabel: copy.toast.undo,
          onAction: () => { restoreFolder(f.id); toast({ message: copy.toast.restored(f.name) }); },
        });
      },
    });
  }, [boards, navigate, toast]);

  const newFolder = useCallback(() => {
    const f = createFolder();
    setQuery('');
    setRenameFolderId(f.id);
  }, []);

  const onRename = useCallback((board: Board, title: string) => { renameBoard(board.id, title); }, []);
  const onRenameFolder = useCallback((f: Folder, name: string) => { renameFolder(f.id, name); }, []);
  const onDropBoard = useCallback((boardId: ID, f: Folder) => move(boardId, f.id), [move]);

  const q = query.trim().toLowerCase();
  const liveFolderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  /** Boards shown in this view: the folder's, or (at the top level) those not in a folder. */
  const here = useMemo(
    () => boards.filter((b) => (folder ? b.folderId === folder.id : !b.folderId || !liveFolderIds.has(b.folderId))),
    [boards, folder, liveFolderIds],
  );
  // At the top level, search looks inside folders too.
  const visibleBoards = useMemo(() => {
    if (!q) return here;
    const pool = folder ? here : boards;
    return pool.filter((b) => b.title.toLowerCase().includes(q));
  }, [boards, here, folder, q]);
  const visibleFolders = useMemo(
    () => (folder ? [] : q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders),
    [folder, folders, q],
  );
  const countFor = useCallback((id: ID) => boards.filter((b) => b.folderId === id).length, [boards]);
  const isEmpty = status === 'ready' && !folderId && boards.length === 0 && folders.length === 0;
  const busy = creating !== null;
  const title = folder?.name ?? copy.boardsTitle;
  const hasItems = visibleBoards.length + visibleFolders.length > 0;

  useEffect(() => {
    if (folder) document.title = `${folder.name} · ${copy.appName}`;
    else document.title = copy.pageTitle;
  }, [folder]);

  return (
    <ChromeProvider>
      <div className="fsd-page fsc-root" data-kit-style="clean">
        <header className="fsd-header">
          <span className="fsd-brand"><BrandMark size={20} />{copy.appName}</span>
          {GitHubAccount && <Suspense fallback={null}><GitHubAccount onNotice={notice} /></Suspense>}
          <Link to="/trash" className="fsc-btn fsd-trash-link" aria-label={copy.trash.linkCount(trash)} data-testid="trash-link">
            <Trash2 size={18} strokeWidth={ICON_STROKE} aria-hidden />
            {copy.trash.link}
            {trash > 0 && <span className="fsd-trash-link__count" aria-hidden>{trash}</span>}
          </Link>
          <Tip label={copy.newBoard} shortcut={copy.newBoardShortcut}>
            <button type="button" className="fsc-btn fsc-btn--primary fsd-new" onClick={() => void create()} disabled={busy} aria-keyshortcuts="N" data-testid="new-board">
              <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden />
              {creating === 'blank' ? copy.creating : copy.newBoard}
            </button>
          </Tip>
        </header>

        <main className="fsd-main">
          {GitHubSetupPanel && <Suspense fallback={null}><GitHubSetupPanel /></Suspense>}
          {isEmpty ? (
            <section className="fsd-hero" aria-labelledby="fsd-hero-title">
              <h1 id="fsd-hero-title" className="fsd-hero__title">{copy.emptyTitle}</h1>
              <p className="fsd-hero__body">{copy.emptyBody}</p>
              <button type="button" className="fsc-btn fsc-btn--primary fsd-hero__cta" onClick={() => void create()} disabled={busy}>
                <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden />
                {creating === 'blank' ? copy.creating : copy.newBoard}
                <Kbd>N</Kbd>
              </button>
            </section>
          ) : (
            <h1 className="fsc-sr-only">{folder ? title : copy.appName}</h1>
          )}

          {status === 'error' && (
            <div className="fsd-error" role="alert">
              <span>{copy.loadError}</span>
              <button type="button" className="fsc-btn fsc-btn--outline" onClick={retry}>{copy.retry}</button>
            </div>
          )}

          {missingFolder && status === 'ready' ? (
            <div className="fsd-nomatch" role="status">
              <span>{copy.folders.notFound}</span>
              <Link to="/" className="fsc-btn fsc-btn--outline">{copy.folders.backHint}</Link>
            </div>
          ) : !isEmpty && (
            <section className="fsd-section" aria-labelledby="fsd-boards-title">
              {folder && <BackToBoards onDropBoard={(id) => move(id, null)} />}
              <div className="fsd-section__head fsd-section__head--row">
                <h2 id="fsd-boards-title" className="fsd-section__title">
                  {title} <span className="fsd-count">{copy.boardCount(folder ? here.length : boards.length)}</span>
                </h2>
                <div className="fsd-section__tools">
                  {!folder && (
                    <button type="button" className="fsc-btn fsc-btn--outline" onClick={newFolder} data-testid="new-folder">
                      <FolderPlus size={16} strokeWidth={ICON_STROKE} aria-hidden />
                      {copy.folders.newFolder}
                    </button>
                  )}
                  <div className="fsd-search" role="search">
                    <Search size={16} strokeWidth={ICON_STROKE} aria-hidden className="fsd-search__icon" />
                    <input
                      type="search"
                      className="fsc-input fsd-search__input"
                      aria-label={copy.searchLabel}
                      placeholder={copy.searchPlaceholder}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
                    />
                  </div>
                </div>
              </div>
              {hasItems ? (
                <ul className="fsd-grid" aria-labelledby="fsd-boards-title">
                  {visibleFolders.map((f) => (
                    <FolderCard
                      key={f.id} folder={f} count={countFor(f.id)} startRenaming={f.id === renameFolderId}
                      onAction={onFolderAction} onRename={onRenameFolder} onDropBoard={onDropBoard}
                    />
                  ))}
                  {visibleBoards.map((b) => (
                    <BoardCard
                      key={b.id} board={b} now={now} folders={folders} showFolder={!folder && Boolean(q)}
                      onAction={onAction} onRename={onRename} onMove={onMove}
                    />
                  ))}
                </ul>
              ) : q ? (
                <div className="fsd-nomatch" role="status">
                  <span>{copy.noMatches(query.trim())}</span>
                  <button type="button" className="fsc-btn fsc-btn--outline" onClick={() => setQuery('')}>
                    <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
                    {copy.clearSearch}
                  </button>
                </div>
              ) : (
                <div className="fsd-nomatch" role="status"><span>{copy.folders.empty}</span></div>
              )}
            </section>
          )}

          {!missingFolder && (
            <section className="fsd-section" aria-labelledby="fsd-templates-title">
              <div className="fsd-section__head">
                <h2 id="fsd-templates-title" className="fsd-section__title">{copy.templatesTitle}</h2>
                <p className="fsd-section__hint">{copy.templatesHint}</p>
              </div>
              <ul className="fsd-templates" data-empty={isEmpty || undefined}>
                {TEMPLATES.map((t) => (
                  <TemplateCard key={t.id} template={t} busy={creating === t.id} disabled={busy} onUse={(id) => void create(id)} />
                ))}
              </ul>
            </section>
          )}
        </main>

        <ConfirmDialog request={confirm} cancelLabel={copy.folders.cancel} onClose={() => setConfirm(null)} />
        <Toasts toasts={toasts} onDismiss={dismissToast} duration={UNDO_WINDOW_MS} />
      </div>
    </ChromeProvider>
  );
}

/** "← Your boards" above a folder; dropping a board here takes it out of the folder. */
function BackToBoards({ onDropBoard }: { onDropBoard: (boardId: ID) => void }) {
  const { over, handlers } = useBoardDrop(onDropBoard);
  return (
    <Link to="/" className="fsd-back" data-drop-over={over || undefined} {...handlers} data-testid="folder-back">
      <ArrowLeft size={16} strokeWidth={ICON_STROKE} aria-hidden />
      {copy.folders.back}
    </Link>
  );
}
