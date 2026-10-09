import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Route-level code splitting: the dashboard ships in the entry chunk; the editor (React Flow, Yjs,
// the canvas), the share page and the dev previews load on demand. See docs/phase-4/performance.md.

/** A lazily loaded page that renders synchronously once its chunk is in (no Suspense fallback flash). */
function lazyPage<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  let loaded: ComponentType | undefined;
  let pending: Promise<ComponentType> | undefined;
  const preload = () => (pending ??= load().then((m) => (loaded = pick(m)), (e) => { pending = undefined; throw e; }));
  const Lazy = lazy(() => preload().then((c) => ({ default: c })));
  function Page() {
    const C = loaded;
    return C ? <C /> : <Lazy />;
  }
  return { Page, preload };
}

const editor = lazyPage(() => import('./pages/EditorPage'), (m) => m.EditorPage);
const share = lazyPage(() => import('./pages/SharePage'), (m) => m.SharePage);
const home = lazyPage(() => import('./pages/HomePage'), (m) => m.HomePage);
const gallery = lazyPage(() => import('./pages/GalleryPage'), (m) => m.GalleryPage);
const sandbox = lazyPage(() => import('./pages/FlowSandboxPage'), (m) => m.FlowSandboxPage);
const chrome = lazyPage(() => import('./pages/ChromePage'), (m) => m.ChromePage);

// Deep links start fetching their page as soon as this module runs (vite.config.ts also preloads the
// chunks from index.html), and the first render waits for it, so the editor appears in one go.
const deepLink = typeof location === 'undefined' ? undefined
  : location.pathname.startsWith('/b/') ? editor.preload()
    : location.pathname.startsWith('/s/') ? share.preload()
      : undefined;
deepLink?.catch(() => {});

function useDeepLinkReady(): boolean {
  const [ready, setReady] = useState(!deepLink);
  useEffect(() => {
    if (!ready) deepLink!.finally(() => setReady(true)).catch(() => {});
  }, [ready]);
  return ready;
}

/** Warms the editor chunk once the browser is idle, so opening a board from the dashboard doesn't wait on the network. */
function usePrefetchEditor() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    const prefetch = () => { editor.preload().catch(() => {}); };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(prefetch);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetch, 1500);
    return () => clearTimeout(t);
  }, []);
}

export function App() {
  usePrefetchEditor();
  if (!useDeepLinkReady()) return null;
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="fsc-root" aria-busy="true" />}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/b/:boardId" element={<editor.Page />} />
        <Route path="/s/:shareId" element={<share.Page />} />
        {/* Dev previews */}
        <Route path="/dev" element={<home.Page />} />
        <Route path="/gallery" element={<gallery.Page />} />
        <Route path="/sandbox" element={<sandbox.Page />} />
        <Route path="/chrome" element={<chrome.Page />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
