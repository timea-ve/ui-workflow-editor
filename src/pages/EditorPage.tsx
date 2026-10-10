// /b/:boardId — the board editor. Owner: Canvas Core.
import { Suspense, lazy, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Tip } from '../chrome';
import { EditorShell } from '../editor/EditorShell';
import { PERF_BOARD_ID, buildPerfDoc } from '../editor/fixtures/perf60';
import { STRESS_BOARD_ID, buildStressDoc } from '../editor/fixtures/stress';
import { getBoard, renameBoard, subscribeBoards, touchBoard } from '../platform/boardIndex';
import { getFolder, subscribeFolders } from '../platform/folders';
import { githubEnabled } from '../platform/github/config';
import { createMemoryStore } from '../store/boardStore';
import { useBoardSession, useSaveState } from '../store/useBoardSession';
import '../editor/editor.css';

const CloudStatus = githubEnabled ? lazy(() => import('../platform/github/ui/CloudStatus').then((m) => ({ default: m.CloudStatus }))) : null;

function BackLink({ boardId }: { boardId?: string }) {
  // Back to the board's folder when it's in one.
  const folderId = useSyncExternalStore(subscribeBoards, () => (boardId ? getBoard(boardId)?.folderId ?? null : null));
  const folderName = useSyncExternalStore(subscribeFolders, () => (folderId ? getFolder(folderId)?.name ?? null : null));
  const to = folderId && folderName ? `/folder/${folderId}` : '/';
  const label = folderName ? `Back to ${folderName}` : 'Back to all boards';
  return (
    <Tip label={folderName ?? 'All boards'}>
      <Link to={to} className="fse-back" aria-label={label}>
        <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
      </Link>
    </Tip>
  );
}

export function EditorPage() {
  const { boardId = '' } = useParams();
  const [params] = useSearchParams();
  if (boardId === STRESS_BOARD_ID || params.get('fixture') === 'stress') return <StressEditor />;
  const isPerf = boardId === PERF_BOARD_ID || params.get('fixture') === 'perf60';
  return isPerf ? <PerfEditor /> : <BoardEditor key={boardId} boardId={boardId} />;
}

/** Ephemeral 60-screen board for performance checks; nothing is saved. */
function PerfEditor() {
  const store = useMemo(() => createMemoryStore(buildPerfDoc()), []);
  return (
    <EditorShell boardId={PERF_BOARD_ID} store={store} title="Perf fixture · 60 screens (not saved)"
      saveStatus="saved" leading={<BackLink />} />
  );
}

/** Ephemeral 60-screen board with 86 routed lines for connector-routing performance checks; nothing is saved. */
function StressEditor() {
  const store = useMemo(() => createMemoryStore(buildStressDoc()), []);
  return (
    <EditorShell boardId={STRESS_BOARD_ID} store={store} title="Stress fixture · 60 screens, 86 lines (not saved)"
      saveStatus="saved" leading={<BackLink />} />
  );
}

function BoardEditor({ boardId }: { boardId: string }) {
  // A string snapshot: getBoard() returns a fresh object on every call.
  const title = useSyncExternalStore(subscribeBoards, () => getBoard(boardId)?.title ?? null);
  const session = useBoardSession(boardId, title !== null);
  const saveState = useSaveState(session);

  useEffect(() => {
    if (!session) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = session.onSaved(() => {
      clearTimeout(t);
      t = setTimeout(() => touchBoard(boardId), 1000);
    });
    return () => { off(); if (t) { clearTimeout(t); touchBoard(boardId); } };
  }, [session, boardId]);

  useEffect(() => {
    if (title !== null) document.title = `${title} — UI Workflow Editor`;
  }, [title]);

  if (title === null) {
    return (
      <main className="fse-state fsc-root">
        <div className="fse-state__box">
          <h1 className="fse-state__title">Board not found</h1>
          <p className="fse-state__text">It may have been deleted. Boards are saved in the browser where you made them, so it may be on another device or browser.</p>
          <Link to="/" className="fsc-btn fsc-btn--outline">Back to your boards</Link>
        </div>
      </main>
    );
  }
  if (!session) {
    return (
      <main className="fse-state fsc-root" aria-busy="true">
        <p className="fse-state__text" role="status">Opening {title}…</p>
      </main>
    );
  }
  return (
    <EditorShell
      boardId={boardId}
      store={session.store}
      title={title}
      onTitleChange={(t) => renameBoard(boardId, t)}
      saveStatus={saveState}
      cloudStatus={CloudStatus && <Suspense fallback={null}><CloudStatus boardId={boardId} localSaving={saveState === 'saving'} /></Suspense>}
      leading={<BackLink boardId={boardId} />}
    />
  );
}
