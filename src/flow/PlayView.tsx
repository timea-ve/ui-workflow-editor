import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardDoc, ID } from '../model/types';
import type { VisualStyle } from '../kit/types';
import { kitRegistry, seedFromId } from '../kit/registry';
import { DeviceFrame } from '../kit/wireframe/DeviceFrame';
import { getLinksFromFrame } from './ops';
import { ElementView } from './KitNode';

/**
 * Minimal click-through ("Play") proof: one screen at 1:1, linked elements are real buttons.
 * Keys: Esc exit · Backspace/← back · → follow the only link · R restart.
 */
export function PlayView({ doc, startFrameId, style, title, onExit }: {
  doc: BoardDoc; startFrameId: ID; style: VisualStyle; title?: string; onExit: (lastFrameId: ID) => void;
}) {
  const [history, setHistory] = useState<ID[]>([startFrameId]);
  const current = history[history.length - 1];
  const frame = doc.frames[current];
  const links = useMemo(() => getLinksFromFrame(doc, current), [doc, current]);
  const targetBySource = useMemo(() => new Map(links.map((l) => [l.sourceElementId, l.targetFrameId])), [links]);
  const children = useMemo(
    () => Object.values(doc.elements).filter((e) => e.parentId === current).sort((a, b) => a.z.localeCompare(b.z)),
    [doc, current],
  );
  const stageRef = useRef<HTMLDivElement>(null);

  const go = useCallback((frameId: ID) => setHistory((h) => [...h, frameId]), []);
  const back = useCallback(() => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h)), []);
  const restart = useCallback(() => setHistory([startFrameId]), [startFrameId]);

  useEffect(() => { stageRef.current?.focus(); }, [current]);

  useEffect(() => {
    // Capture phase + stopPropagation so canvas shortcuts (e.g. Backspace/Delete) can't fire underneath.
    // Default actions (Tab, Enter/Space on buttons) still work.
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') onExit(current);
      else if (e.key === 'Backspace' || e.key === 'ArrowLeft') back();
      else if (e.key === 'ArrowRight' && links.length === 1) go(links[0].targetFrameId);
      else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) restart();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [current, links, back, go, restart, onExit]);

  if (!frame) return null;

  return (
    <div className="fs-play" data-kit-style={style} role="dialog" aria-label={`Playing ${title ?? 'flow'}`}>
      <div className="fs-play-bar">
        <strong>{title ? `${title} · ` : ''}{frame.name}</strong>
        <span className="fs-play-hint">Click the highlighted items · Esc to exit</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={back} disabled={history.length < 2}>← Back</button>
        <button type="button" onClick={restart}>Restart</button>
        <button type="button" onClick={() => onExit(current)}>Exit</button>
      </div>
      <div className="fs-play-stage" ref={stageRef} tabIndex={-1} aria-live="polite">
        <div style={{ position: 'relative', width: frame.w, height: frame.h, margin: '40px auto' }}>
          <DeviceFrame device={frame.device} w={frame.w} h={frame.h} name={frame.name} style={style} seed={seedFromId(frame.id)} />
          {children.map((el) => {
            const target = targetBySource.get(el.id);
            const box = { position: 'absolute' as const, left: el.x, top: el.y, width: el.w, height: el.h };
            if (!target) return <div key={el.id} style={box}><ElementView element={el} style={style} /></div>;
            const def = kitRegistry.get(el.type);
            const name = def ? def.describe({ ...def.defaultProps, ...el.props }) : el.type;
            return (
              <button key={el.id} type="button" className="fs-play-hotspot" style={box}
                onClick={() => go(target)} aria-label={`${name} — go to ${doc.frames[target]?.name ?? 'screen'}`}>
                <ElementView element={el} style={style} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
