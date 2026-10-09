// First-run tour: 4 small tips pointing at real UI. Non-modal (the canvas stays usable), skippable,
// Esc closes it, and it moves on by itself when you do what a tip suggests.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Kbd, ICON_STROKE } from '../../chrome/shared';
import { isTypingTarget } from '../../chrome/tools';
import type { BoardDoc } from '../../model/types';
import { TOUR_STEPS, tourText, type TourPlacement } from './tourState';
import './tour.css';

export interface FirstRunTourProps {
  doc: BoardDoc;
  onClose: () => void;
  /** Move focus into the tip when it opens (when the user asked for it from the help menu). */
  autoFocus?: boolean;
}

interface Pos { left: number; top: number; placement: TourPlacement; arrow: number }

const GAP = 12;
const EDGE = 8;

const otherOverlayOpen = () =>
  !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');

export function FirstRunTour({ doc, onClose, autoFocus = false }: FirstRunTourProps) {
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const titleId = useId();
  const bodyId = useId();

  // Move on when the user does what the tip says (count goes up after the tip appeared).
  const baseline = useRef<number | null>(null);
  useEffect(() => { baseline.current = step.progress ? step.progress(doc) : null; }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!step.progress || baseline.current === null) return;
    if (step.progress(doc) > baseline.current) setIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
  }, [doc, step]);

  const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);

  // The last tip is done once Play opens.
  useEffect(() => {
    if (step.id !== 'play') return;
    const t = window.setInterval(() => { if (document.querySelector('.fs-play')) onClose(); }, 300);
    return () => window.clearInterval(t);
  }, [step.id, onClose]);

  const place = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const anchor = document.querySelector<HTMLElement>(step.anchor);
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!anchor) {
      setPos({ left: Math.max(EDGE, (vw - cw) / 2), top: vh - ch - 88, placement: 'bottom', arrow: -1 });
      return;
    }
    const r = anchor.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.min(Math.max(EDGE, v), max - EDGE);
    if (step.placement === 'right') {
      const top = clamp(r.top + r.height / 2 - ch / 2, vh - ch);
      setPos({ left: r.right + GAP, top, placement: 'right', arrow: r.top + r.height / 2 - top });
    } else {
      const left = clamp(r.right - cw, vw - cw);
      setPos({ left, top: r.bottom + GAP, placement: 'bottom', arrow: r.left + r.width / 2 - left });
    }
  }, [step]);

  useLayoutEffect(() => { place(); }, [place, doc]);
  useEffect(() => {
    window.addEventListener('resize', place);
    // Panels can open, close or move after layout settles.
    const t = window.setInterval(place, 600);
    return () => { window.removeEventListener('resize', place); window.clearInterval(t); };
  }, [place]);

  useEffect(() => {
    if (!autoFocus) return;
    // Wait for the help dialog that opened us to finish returning focus to its trigger.
    const t = window.setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(t);
  }, [autoFocus]);
  // Keep focus inside the tip when it changes step via its own buttons.
  const focusedInside = useRef(false);
  useEffect(() => {
    if (focusedInside.current) nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Esc closes the tour (unless something else is open or the user is typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const inside = !!cardRef.current?.contains(e.target as Node);
      if (!inside && (isTypingTarget(e.target) || otherOverlayOpen())) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      className="fse-tour fsc-root"
      role="region"
      aria-roledescription="tip"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-placement={pos?.placement ?? step.placement}
      data-step={step.id}
      style={pos ? { left: pos.left, top: pos.top, ['--fse-tour-arrow' as string]: `${pos.arrow}px` } : { visibility: 'hidden' }}
      onFocus={() => { focusedInside.current = true; }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) focusedInside.current = false; }}
    >
      {pos && pos.arrow >= 0 && <span className="fse-tour__arrow" aria-hidden />}
      <div className="fse-tour__head">
        <span className="fse-tour__count">Tip {index + 1} of {TOUR_STEPS.length}</span>
        <button type="button" className="fsc-btn fsc-btn--icon fse-tour__close" aria-label="Close tour" onClick={onClose}>
          <X size={14} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>
      <p id={titleId} className="fse-tour__title">{step.title}</p>
      <p id={bodyId} className="fse-tour__body">
        {step.body.map((part, i) => (typeof part === 'string' ? <span key={i}>{part}</span> : <Kbd key={i}>{part.key}</Kbd>))}
      </p>
      <div className="fse-tour__foot">
        {!last && <button type="button" className="fsc-btn fse-tour__skip" onClick={onClose}>Skip tour</button>}
        <button ref={nextRef} type="button" className="fsc-btn fsc-btn--primary" onClick={next}>
          {last ? 'Done' : 'Next'}
        </button>
      </div>
      <p className="fsc-sr-only" role="status" aria-live="polite">
        {`Tip ${index + 1} of ${TOUR_STEPS.length}: ${step.title}. ${tourText(step.body)} Press Escape to close the tour.`}
      </p>
    </div>
  );
}
