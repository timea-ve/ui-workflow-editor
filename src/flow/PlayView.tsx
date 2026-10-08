import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { BoardDoc, ID } from '../model/types';
import type { VisualStyle } from '../kit/types';
import { kitRegistry, seedFromId } from '../kit/registry';
import { DeviceFrame } from '../kit/wireframe/DeviceFrame';
import { OptionChip } from '../chrome/OptionChip';
import { compareZ, flowForNode } from './ops';
import { ElementView } from './KitNode';
import {
  brokenLinks, canGoBack, correspondingFrame, fitScale, flowOrder, hotspots, playBack, playCurrent, playGo, playRestart,
  playStart, type PlayHistory,
} from '../editor/features/flows/playModel';

export interface PlayOption { id: string; letter: string; label: string; frameIds: ID[]; startFrameId: ID }

export interface PlayViewProps {
  doc: BoardDoc;
  startFrameId: ID;
  style: VisualStyle;
  title?: string;
  onExit: (lastFrameId: ID) => void;
  /** Options of the flow being played (shows a switcher when 2+). */
  options?: PlayOption[];
  initialOption?: number;
  /** When given, the host routes keydown events here instead of PlayView listening on window. */
  keyHandlerRef?: MutableRefObject<((e: KeyboardEvent) => void) | null>;
}

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Play: one screen at a time, fit to the window; only links are clickable (hotspots).
 * Keys: Esc exit · ← / Backspace back · → follow the only link · R restart.
 */
export function PlayView({ doc, startFrameId, style, title, onExit, options, initialOption = 0, keyHandlerRef }: PlayViewProps) {
  const [optionIndex, setOptionIndex] = useState(Math.min(initialOption, Math.max(0, (options?.length ?? 1) - 1)));
  const option = options?.[optionIndex];
  const [history, setHistory] = useState<PlayHistory>(() => playStart(startFrameId));
  // A screen deleted meanwhile (remote edit) falls back to the start.
  const current = doc.frames[playCurrent(history)] ? playCurrent(history) : history.start;
  const frame = doc.frames[current];
  const spots = useMemo(() => hotspots(doc, current), [doc, current]);
  const targetBySource = useMemo(() => new Map(spots.map((s) => [s.elementId, s.targetFrameId])), [spots]);
  const broken = useMemo(() => brokenLinks(doc, current).length > 0, [doc, current]);
  const children = useMemo(
    () => Object.values(doc.elements).filter((e) => e.parentId === current).sort((a, b) => compareZ(a.z, b.z) || compareZ(a.id, b.id)),
    [doc, current],
  );
  const order = useMemo(() => {
    if (option) return flowOrder(doc, option.frameIds, option.startFrameId);
    const flow = flowForNode(doc, history.start);
    return flow ? flowOrder(doc, flow.frameIds, history.start) : [history.start];
  }, [doc, option, history.start]);
  const position = order.indexOf(current);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = frame && stage.w ? fitScale(frame, stage) : 1;

  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(0), REDUCED ? 1600 : 900);
    return () => window.clearTimeout(t);
  }, [flash]);

  const go = useCallback((id: ID) => { setHistory((h) => playGo(h, id)); setFlash(0); }, []);
  const back = useCallback(() => setHistory(playBack), []);
  const restart = useCallback(() => setHistory(playRestart), []);
  const switchOption = useCallback((i: number) => {
    if (!options?.[i] || i === optionIndex) return;
    const from = options[optionIndex];
    const to = options[i];
    const mapped = from ? correspondingFrame(doc, from, to, current) : to.startFrameId;
    setOptionIndex(i);
    setHistory(mapped === to.startFrameId ? playStart(to.startFrameId) : playGo(playStart(to.startFrameId), mapped));
  }, [options, optionIndex, doc, current]);


  useEffect(() => { stageRef.current?.focus({ preventScroll: true }); }, [current]);

  const onKey = useCallback((e: KeyboardEvent) => {
    const k = e.key;
    if (k === 'Escape') onExit(current);
    else if (k === 'Backspace' || k === 'ArrowLeft') back();
    else if (k === 'ArrowRight' && spots.length === 1) go(spots[0].targetFrameId);
    else if (k.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) restart();
    else if (options && options.length > 1 && /^[1-9]$/.test(k) && !e.metaKey && !e.ctrlKey) switchOption(Number(k) - 1);
    else return;
    e.preventDefault();
  }, [onExit, current, back, spots, go, restart, options, switchOption]);

  useEffect(() => {
    if (keyHandlerRef) {
      keyHandlerRef.current = onKey;
      return () => { if (keyHandlerRef.current === onKey) keyHandlerRef.current = null; };
    }
    // Standalone (share page): capture phase + stopPropagation so canvas shortcuts can't fire underneath.
    const listener = (e: KeyboardEvent) => { e.stopPropagation(); onKey(e); };
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, [keyHandlerRef, onKey]);

  if (!frame) return null;
  const announce = `${frame.name}${position >= 0 ? `, screen ${position + 1} of ${order.length}` : ''}`;

  return (
    <div className="fs-play fsc-root" data-kit-style={style} role="dialog" aria-modal="true" aria-label={`Playing ${title ?? 'flow'}`}>
      <div className="fs-play-bar">
        <div className="fs-play-bar__start">
          {title && <strong className="fs-play-title">{title}</strong>}
          {options && options.length > 1 && (
            <div className="fs-play-options" role="radiogroup" aria-label="Option">
              {options.map((o, i) => (
                <OptionChip key={o.id} letter={o.letter} label={o.label} active={i === optionIndex} role="radio" onClick={() => switchOption(i)} />
              ))}
            </div>
          )}
        </div>
        <div className="fs-play-bar__mid" aria-hidden>
          <span className="fs-play-screen">{frame.name}</span>
          {position >= 0 && <span className="fs-play-count">Screen {position + 1} of {order.length}</span>}
        </div>
        <div className="fs-play-bar__end">
          <button type="button" className="fsc-btn" onClick={back} disabled={!canGoBack(history)} aria-keyshortcuts="ArrowLeft Backspace">
            ← Back
          </button>
          <button type="button" className="fsc-btn" onClick={restart} aria-keyshortcuts="R">
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden /> Restart
          </button>
          <button type="button" className="fsc-btn fsc-btn--outline" onClick={() => onExit(current)} aria-keyshortcuts="Escape">
            <X size={16} strokeWidth={1.75} aria-hidden /> Exit <kbd className="fsc-kbd">Esc</kbd>
          </button>
        </div>
      </div>
      <div className="fs-play-stage" ref={stageRef} tabIndex={-1} aria-label={announce}>
        <p className="fsc-sr-only" aria-live="polite">{announce}</p>
        <div className="fs-play-screen-box" style={{ width: frame.w * scale, height: frame.h * scale }}>
          <div
            className={`fs-play-screen-inner${flash ? ' is-flashing' : ''}`}
            data-testid="play-screen"
            data-frame-id={frame.id}
            style={{ width: frame.w, height: frame.h, transform: `scale(${scale})` }}
            onClick={(e) => { if (!(e.target as HTMLElement).closest('.fs-play-hotspot')) setFlash((n) => n + 1); }}
          >
            <DeviceFrame device={frame.device} w={frame.w} h={frame.h} name={frame.name} style={style} seed={seedFromId(frame.id)} />
            {children.map((el) => {
              const target = targetBySource.get(el.id);
              const box = { position: 'absolute' as const, left: el.x, top: el.y, width: el.w, height: el.h };
              if (!target) return <div key={el.id} style={box} aria-hidden><ElementView element={el} style={style} /></div>;
              const def = kitRegistry.get(el.type);
              const name = def ? def.describe({ ...def.defaultProps, ...el.props }) : el.type;
              return (
                <button key={el.id} type="button" className="fs-play-hotspot" style={box} data-element-id={el.id}
                  onClick={() => go(target)} aria-label={`${name} — go to ${doc.frames[target]?.name ?? 'screen'}`}>
                  <ElementView element={el} style={style} />
                </button>
              );
            })}
          </div>
        </div>
        <p className="fs-play-note" role="status">
          {flash ? 'Click a highlighted item to move on.'
            : spots.length === 0 ? (broken ? 'A link here points to a screen that was removed.' : 'End of this path — press R to restart or ← to go back.')
              : ''}
        </p>
      </div>
    </div>
  );
}
