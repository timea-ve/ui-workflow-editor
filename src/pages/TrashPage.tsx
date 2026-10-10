// /trash — deleted boards and folders, kept for 30 days. Owner: Platform agent.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Folder as FolderIcon, LayoutPanelLeft, RotateCcw, Trash2 } from 'lucide-react';
import { BrandMark, ChromeProvider, Toasts, type ToastMessage } from '../chrome';
import { ICON_STROKE } from '../chrome/shared';
import { subscribeBoards } from '../platform/boardIndex';
import { commitPendingDeletes, flushPendingDeletes } from '../platform/boards';
import { subscribeFolders } from '../platform/folders';
import {
  daysLeft, deleteBoardForever, deleteFolderForever, emptyTrash, listTrash, purgeExpiredTrash, restoreBoard, restoreFolder, type TrashContents,
} from '../platform/trash';
import { ConfirmDialog, type ConfirmRequest } from '../dashboard/ConfirmDialog';
import { copy, formatRelative } from '../dashboard/copy';
import { useNow } from '../dashboard/useBoards';
import '../dashboard/dashboard.css';

let toastSeq = 0;

interface Row {
  key: string;
  kind: 'folder' | 'board';
  id: string;
  name: string;
  trashedAt: number;
  boards: number;
}

function useTrash(): TrashContents {
  const [trash, setTrash] = useState(listTrash);
  useEffect(() => {
    const refresh = () => setTrash(listTrash());
    const a = subscribeBoards(refresh);
    const b = subscribeFolders(refresh);
    return () => { a(); b(); };
  }, []);
  return trash;
}

export function TrashPage() {
  const trash = useTrash();
  const now = useNow();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((message: string) => {
    setToasts((ts) => [...ts, { id: `tt${++toastSeq}`, message }]);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = copy.trash.pageTitle;
    flushPendingDeletes().catch(() => {});
    purgeExpiredTrash().catch((err) => console.warn(err));
    return () => { document.title = prev; commitPendingDeletes(); };
  }, []);

  const rows = useMemo<Row[]>(() => [
    ...trash.folders.map(({ folder, boards }) => ({
      key: `f-${folder.id}`, kind: 'folder' as const, id: folder.id, name: folder.name, trashedAt: folder.trashedAt!, boards: boards.length,
    })),
    ...trash.boards.map((b) => ({ key: `b-${b.id}`, kind: 'board' as const, id: b.id, name: b.title, trashedAt: b.trashedAt!, boards: 0 })),
  ].sort((a, b) => b.trashedAt - a.trashedAt), [trash]);

  const restore = (row: Row) => {
    if (row.kind === 'folder') restoreFolder(row.id);
    else restoreBoard(row.id);
    toast(copy.trash.restored(row.name));
  };

  const askForever = (row: Row) => setConfirm({
    title: copy.trash.confirmForeverTitle(row.name),
    body: copy.trash.confirmForeverBody(row.kind === 'folder' ? row.boards : 0),
    confirmLabel: copy.trash.deleteForever,
    onConfirm: async () => {
      try {
        await (row.kind === 'folder' ? deleteFolderForever(row.id) : deleteBoardForever(row.id));
        toast(copy.trash.deleted(row.name));
      } catch (err) {
        console.error(err);
        toast(copy.trash.failed);
      }
    },
  });

  const askEmpty = () => setConfirm({
    title: copy.trash.confirmEmptyTitle,
    body: copy.trash.confirmEmptyBody(rows.length),
    confirmLabel: copy.trash.emptyTrash,
    onConfirm: async () => {
      try {
        await emptyTrash();
        toast(copy.trash.emptied);
      } catch (err) {
        console.error(err);
        toast(copy.trash.failed);
      }
    },
  });

  return (
    <ChromeProvider>
      <div className="fsd-page fsc-root" data-kit-style="clean">
        <header className="fsd-header">
          <Link to="/" className="fsd-brand fsd-brand--link"><BrandMark size={20} />{copy.appName}</Link>
        </header>
        <main className="fsd-main">
          <section className="fsd-section" aria-labelledby="fsd-trash-title">
            <Link to="/" className="fsd-back">
              <ArrowLeft size={16} strokeWidth={ICON_STROKE} aria-hidden />
              {copy.folders.back}
            </Link>
            <div className="fsd-section__head fsd-section__head--row">
              <div className="fsd-section__head">
                <h1 id="fsd-trash-title" className="fsd-section__title">{copy.trash.title}</h1>
                <p className="fsd-section__hint">{copy.trash.hint}</p>
              </div>
              <button type="button" className="fsc-btn fsc-btn--outline" onClick={askEmpty} disabled={!rows.length} data-testid="empty-trash">
                <Trash2 size={16} strokeWidth={ICON_STROKE} aria-hidden />
                {copy.trash.emptyTrash}
              </button>
            </div>
            {rows.length ? (
              <ul className="fsd-trash" aria-labelledby="fsd-trash-title">
                {rows.map((row) => (
                  <li key={row.key} className="fsd-trash__row" data-testid="trash-row">
                    <span className="fsd-trash__icon" aria-hidden>
                      {row.kind === 'folder'
                        ? <FolderIcon size={18} strokeWidth={ICON_STROKE} />
                        : <LayoutPanelLeft size={18} strokeWidth={ICON_STROKE} />}
                    </span>
                    <span className="fsd-trash__text">
                      <span className="fsd-trash__name">{row.name}</span>
                      <span className="fsd-trash__meta">
                        {row.kind === 'folder' && <>{copy.trash.folderTag(row.boards)} · </>}
                        {copy.trash.meta(formatRelative(row.trashedAt, now), daysLeft(row.trashedAt, now))}
                      </span>
                    </span>
                    <span className="fsd-trash__actions">
                      <button type="button" className="fsc-btn fsc-btn--outline" onClick={() => restore(row)} aria-label={copy.trash.restoreLabel(row.name)}>
                        <RotateCcw size={16} strokeWidth={ICON_STROKE} aria-hidden />
                        {copy.trash.restore}
                      </button>
                      <button type="button" className="fsc-btn" onClick={() => askForever(row)} aria-label={copy.trash.deleteForeverLabel(row.name)}>
                        {copy.trash.deleteForever}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="fsd-nomatch" role="status"><span>{copy.trash.empty}</span></div>
            )}
          </section>
        </main>
        <ConfirmDialog request={confirm} cancelLabel={copy.folders.cancel} onClose={() => setConfirm(null)} />
        <Toasts toasts={toasts} onDismiss={(id) => setToasts((ts) => ts.filter((t) => t.id !== id))} />
      </div>
    </ChromeProvider>
  );
}
