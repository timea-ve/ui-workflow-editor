import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { Download, Link2Off, Maximize, Play, RefreshCw } from 'lucide-react';
import type { BoardDoc, ID } from '../model/types';
import { BrandMark, ChromeProvider, ICON_STROKE, Tip } from '../chrome/shared';
import { PlayView } from '../flow/PlayView';
import { ExportDialog } from '../export/ExportDialog';
import type { ExportFormat } from '../export/scope';
import { fetchShare, ShareError } from '../share/client';
import { ReadOnlyBoard } from '../share/ReadOnlyBoard';
import { isEmptyDoc, normalizeDoc, playStart } from '../share/play';
import '../chrome/chrome.css';
import '../share/share.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; title: string; doc: BoardDoc }
  | { kind: 'gone' }
  | { kind: 'error' };

/** Keep the share view out of search engines while it's open (the API also sends X-Robots-Tag). */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

/** Dev-only test hook: `/s/:id?formats=png,pdf` also offers PDF in the share view's export dialog. */
function exportFormats(params: URLSearchParams): ExportFormat[] {
  if (import.meta.env.DEV && params.get('formats') === 'png,pdf') return ['png', 'pdf'];
  return ['png'];
}

export function SharePage() {
  const { shareId = '' } = useParams();
  const [params] = useSearchParams();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useNoIndex();
  useDocumentTitle(load.kind === 'ready' ? `${load.title} · FlowSketch` : 'Shared board · FlowSketch');

  useEffect(() => {
    let alive = true;
    setLoad({ kind: 'loading' });
    fetchShare(shareId)
      .then((s) => { if (alive) setLoad({ kind: 'ready', title: s.title || 'Untitled board', doc: normalizeDoc(s.doc) }); })
      .catch((e: unknown) => {
        if (!alive) return;
        const gone = e instanceof ShareError && (e.kind === 'not-found' || e.kind === 'revoked');
        setLoad({ kind: gone ? 'gone' : 'error' });
      });
    return () => { alive = false; };
  }, [shareId, attempt]);

  return (
    <ChromeProvider>
      <div className="fs-sharepage fsc-root" data-kit-style="clean">
        {load.kind === 'ready'
          ? <ReactFlowProvider><ShareView title={load.title} doc={load.doc} formats={exportFormats(params)} /></ReactFlowProvider>
          : (
            <>
              <ShareHeader title={load.kind === 'loading' ? 'Loading…' : 'Shared board'} />
              <main className="fs-sharepage__stage" aria-busy={load.kind === 'loading' || undefined}>
                {load.kind === 'loading' && <Skeleton />}
                {load.kind === 'gone' && (
                  <div className="fs-sharepage__state">
                    <Link2Off size={28} strokeWidth={ICON_STROKE} aria-hidden />
                    <h1>This link is no longer active.</h1>
                    <p>Ask the owner for a new link.</p>
                  </div>
                )}
                {load.kind === 'error' && (
                  <div className="fs-sharepage__state" role="alert">
                    <h1>Couldn’t load this board</h1>
                    <p>Check your connection, then try again.</p>
                    <button type="button" className="fsc-btn fsc-btn--outline" onClick={() => setAttempt((n) => n + 1)}>
                      <RefreshCw size={16} strokeWidth={ICON_STROKE} aria-hidden /> Try again
                    </button>
                  </div>
                )}
              </main>
            </>
          )}
      </div>
    </ChromeProvider>
  );
}

function ShareHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="fsc-topbar fs-sharepage__head">
      <span className="fsc-topbar__brand" aria-hidden><BrandMark /></span>
      <div className="fsc-topbar__title fs-sharepage__heading">
        <p className="fs-sharepage__title">{title}</p>
        <p className="fs-sharepage__banner">View only · made with <Link to="/">FlowSketch</Link></p>
      </div>
      {children && <div className="fsc-topbar__actions">{children}</div>}
    </header>
  );
}

function Skeleton() {
  return (
    <div className="fs-skel" aria-label="Loading board" role="status">
      {[0, 1, 2].map((i) => (
        <div key={i} className="fs-skel__item">
          <span className="fs-skel__line" />
          <span className="fs-skel__screen" />
        </div>
      ))}
    </div>
  );
}

function ShareView({ title, doc, formats }: { title: string; doc: BoardDoc; formats: ExportFormat[] }) {
  const { fitView } = useReactFlow();
  const [play, setPlay] = useState<{ frameId: ID; title: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selection, setSelection] = useState<ID[]>([]);
  const empty = isEmptyDoc(doc);
  const start = useMemo(() => playStart(doc), [doc]);

  const onPlayVariant = useCallback((variantId: ID) => {
    const s = playStart(doc, variantId);
    if (s) setPlay(s);
  }, [doc]);
  const view = useMemo(() => ({ style: 'clean' as const, onPlayVariant }), [onPlayVariant]);
  const zoomToFit = useCallback(() => { void fitView({ padding: 0.15, duration: 200 }); }, [fitView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (play || exportOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && e.code === 'Digit1') { e.preventDefault(); zoomToFit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play, exportOpen, zoomToFit]);

  const selectionIds = selection.filter((id) => !id.startsWith('lane:'));

  return (
    <>
      <ShareHeader title={title}>
        {!empty && (
          <>
            <Tip label="Fit the whole board on screen" shortcut="⇧1">
              <button type="button" className="fsc-btn" onClick={zoomToFit} aria-keyshortcuts="Shift+1">
                <Maximize size={16} strokeWidth={ICON_STROKE} aria-hidden /> Zoom to fit
              </button>
            </Tip>
            <button type="button" className="fsc-btn" onClick={() => setExportOpen(true)}>
              <Download size={16} strokeWidth={ICON_STROKE} aria-hidden /> {formats.length > 1 ? 'Export' : 'Export PNG'}
            </button>
            <span className="fsc-topbar__divider" aria-hidden />
            <button type="button" className="fsc-btn fsc-btn--primary" disabled={!start} onClick={() => start && setPlay(start)}>
              <Play size={15} strokeWidth={2} aria-hidden /> Play
            </button>
          </>
        )}
      </ShareHeader>
      <main className="fs-sharepage__stage">
        {empty ? (
          <div className="fs-sharepage__state">
            <h1>Nothing here yet</h1>
            <p>The owner hasn’t added any screens to this board.</p>
          </div>
        ) : (
          <ReadOnlyBoard doc={doc} view={view} onSelectionChange={setSelection} />
        )}
        {play && (
          <PlayView doc={doc} startFrameId={play.frameId} style="clean" title={play.title} onExit={() => setPlay(null)} />
        )}
      </main>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} doc={doc} title={title}
        selectionIds={selectionIds} formats={formats} />
    </>
  );
}
