import { useEffect, useRef, useState } from 'react';
import type { BoardDoc, ID } from '../model/types';
import { DocPreview } from './DocPreview';

// Real mini previews of saved boards, read from this device's storage when a card scrolls into
// view. Reads run one at a time; content is cached per board version (updatedAt).
const cache = new Map<ID, { version: number; doc: BoardDoc | null }>();
let queue: Promise<unknown> = Promise.resolve();

function loadDoc(id: ID, version: number): Promise<BoardDoc | null> {
  const hit = cache.get(id);
  if (hit && hit.version === version) return Promise.resolve(hit.doc);
  const job = queue.then(async () => {
    try {
      const doc = await (await import('../store/persistence')).readBoardDoc(id);
      return doc && Object.keys(doc.frames ?? {}).length + Object.keys(doc.elements ?? {}).length ? doc : null;
    } catch {
      return null;
    }
  }).then((doc) => {
    // Only real content is cached: a board can be listed a moment before its content is saved.
    if (doc) cache.set(id, { version, doc });
    return doc;
  });
  queue = job;
  return job;
}

export function BoardPreview({ boardId, version, fallback }: { boardId: ID; version: number; fallback: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number }>();
  const [doc, setDoc] = useState<BoardDoc | null | undefined>(() => {
    const hit = cache.get(boardId);
    return hit && hit.version === version ? hit.doc : undefined;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.max(0, el.clientWidth - 16), h: Math.max(0, el.clientHeight - 12) });
    if (typeof IntersectionObserver === 'undefined') { measure(); setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { measure(); setVisible(true); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    void loadDoc(boardId, version).then((d) => { if (live) setDoc(d); });
    return () => { live = false; };
  }, [visible, boardId, version]);

  return (
    <span ref={ref} className="fsd-thumb fsd-thumb--board" aria-hidden data-testid="board-preview" data-state={doc ? 'ready' : doc === null ? 'empty' : 'loading'}>
      {doc && size && size.w > 0 ? <DocPreview doc={doc} width={size.w} height={size.h} /> : fallback}
    </span>
  );
}
