import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import type { Board } from '../model/types';
import { BrandMark, ChromeProvider, Kbd, Tip, Toasts, isTypingTarget, type ToastMessage } from '../chrome';
import { ICON_STROKE } from '../chrome/shared';
import { renameBoard } from '../platform/boardIndex';
import {
  commitPendingDeletes, createBoard, deleteBoard, duplicateBoard, flushPendingDeletes, UNDO_WINDOW_MS, type PendingDelete,
} from '../platform/boards';
import { TEMPLATES } from '../platform/templates';
import { BoardCard, type BoardAction } from '../dashboard/BoardCard';
import { TemplateCard } from '../dashboard/TemplateCard';
import { copy } from '../dashboard/copy';
import { useBoards, useNow } from '../dashboard/useBoards';
import '../dashboard/dashboard.css';

let toastSeq = 0;

export function DashboardPage() {
  const navigate = useNavigate();
  const { status, boards, retry } = useBoards();
  const now = useNow();
  const [query, setQuery] = useState('');
  /** 'blank' or a template id while a board is being created. */
  const [creating, setCreating] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pendingByToast = useRef(new Map<string, PendingDelete>());
  const creatingRef = useRef(false);

  const toast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `t${++toastSeq}`;
    setToasts((ts) => [...ts, { ...t, id }]);
    return id;
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = copy.pageTitle;
    flushPendingDeletes().catch(() => {});
    return () => {
      document.title = prev;
      commitPendingDeletes();
    };
  }, []);

  const create = useCallback(async (templateId?: string) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(templateId ?? 'blank');
    try {
      const board = await createBoard({ templateId });
      navigate(`/b/${board.id}`);
    } catch (err) {
      console.error(err);
      toast({ message: copy.toast.createFailed });
    } finally {
      creatingRef.current = false;
      setCreating(null);
    }
  }, [navigate, toast]);

  // "N" on the dashboard = new board (J1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target) || document.querySelector('[role="menu"]')) return;
      e.preventDefault();
      void create();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [create]);

  const dismissToast = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const pending = pendingByToast.current.get(id);
    if (pending) {
      pendingByToast.current.delete(id);
      // Content is deleted once the undo toast is gone (it stays queued for retry on failure).
      pending.commit().catch((err) => console.warn(err));
    }
  }, []);

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
          await navigator.clipboard.writeText(`${location.origin}/s/${board.shareId}`);
          toast({ message: copy.toast.linkCopied });
        } catch {
          toast({ message: copy.toast.linkCopyFailed });
        }
        return;
      }
      case 'delete': {
        let pending: PendingDelete;
        try {
          pending = deleteBoard(board.id, { undoWindowMs: null });
        } catch (err) {
          console.error(err);
          toast({ message: copy.toast.deleteFailed });
          return;
        }
        const id = toast({
          message: copy.toast.deleted(board.title),
          actionLabel: copy.toast.undo,
          onAction: () => {
            pendingByToast.current.delete(id);
            toast({ message: pending.undo() ? copy.toast.restored(board.title) : copy.toast.undoTooLate });
          },
        });
        pendingByToast.current.set(id, pending);
      }
    }
  }, [navigate, toast]);

  const onRename = useCallback((board: Board, title: string) => { renameBoard(board.id, title); }, []);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? boards.filter((b) => b.title.toLowerCase().includes(q)) : boards), [boards, q]);
  const isEmpty = status === 'ready' && boards.length === 0;
  const busy = creating !== null;

  return (
    <ChromeProvider>
      <div className="fsd-page fsc-root" data-kit-style="clean">
        <header className="fsd-header">
          <span className="fsd-brand"><BrandMark size={20} />{copy.appName}</span>
          <Tip label={copy.newBoard} shortcut={copy.newBoardShortcut}>
            <button type="button" className="fsc-btn fsc-btn--primary fsd-new" onClick={() => void create()} disabled={busy} aria-keyshortcuts="N" data-testid="new-board">
              <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden />
              {creating === 'blank' ? copy.creating : copy.newBoard}
            </button>
          </Tip>
        </header>

        <main className="fsd-main">
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
            <h1 className="fsc-sr-only">{copy.appName}</h1>
          )}

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

          {status === 'error' && (
            <div className="fsd-error" role="alert">
              <span>{copy.loadError}</span>
              <button type="button" className="fsc-btn fsc-btn--outline" onClick={retry}>{copy.retry}</button>
            </div>
          )}

          {!isEmpty && (
            <section className="fsd-section" aria-labelledby="fsd-boards-title">
              <div className="fsd-section__head fsd-section__head--row">
                <h2 id="fsd-boards-title" className="fsd-section__title">
                  {copy.boardsTitle} <span className="fsd-count">{copy.boardCount(boards.length)}</span>
                </h2>
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
              {visible.length ? (
                <ul className="fsd-grid" aria-labelledby="fsd-boards-title">
                  {visible.map((b) => <BoardCard key={b.id} board={b} now={now} onAction={onAction} onRename={onRename} />)}
                </ul>
              ) : (
                <div className="fsd-nomatch" role="status">
                  <span>{copy.noMatches(query.trim())}</span>
                  <button type="button" className="fsc-btn fsc-btn--outline" onClick={() => setQuery('')}>
                    <X size={16} strokeWidth={ICON_STROKE} aria-hidden />
                    {copy.clearSearch}
                  </button>
                </div>
              )}
            </section>
          )}
        </main>

        <Toasts toasts={toasts} onDismiss={dismissToast} duration={UNDO_WINDOW_MS} />
      </div>
    </ChromeProvider>
  );
}
