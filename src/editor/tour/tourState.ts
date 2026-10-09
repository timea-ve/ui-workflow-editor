// First-run tour: which tips exist, where they point, and whether the tour has been seen.
import type { BoardDoc } from '../../model/types';

export const TOUR_SEEN_KEY = 'fs:tour:v1';
/** Automated browsers skip the tour unless this key is 'on' (so seeded e2e boards stay clickable). */
export const TOUR_E2E_KEY = 'fs:tour:e2e';

export type TourPlacement = 'right' | 'bottom';
/** Plain text, or a key cap such as `{ key: 'F' }`. */
export type TourText = string | { key: string };

export interface TourStep {
  id: 'screen' | 'insert' | 'link' | 'play';
  title: string;
  body: TourText[];
  /** CSS selector of the UI the tip points at. */
  anchor: string;
  placement: TourPlacement;
  /** A count that grows when the user has done this step; the tour then moves on by itself. */
  progress?: (doc: BoardDoc) => number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'screen',
    title: 'Add a screen',
    body: ['Press ', { key: 'F' }, ', then click the board to place a screen.'],
    anchor: '.fse-left .fsc-toolbar [aria-keyshortcuts="F"]',
    placement: 'right',
    progress: (doc) => Object.keys(doc.frames).length,
  },
  {
    id: 'insert',
    title: 'Insert a component',
    body: ['Select a screen and press ', { key: '/' }, ' to add a button, input, text and more.'],
    anchor: '.fse-left .fsc-toolbar [aria-keyshortcuts="/"]',
    placement: 'right',
    progress: (doc) => Object.values(doc.elements).filter((e) => e.parentId && doc.frames[e.parentId]).length,
  },
  {
    id: 'link',
    title: 'Link to the next screen',
    body: ['Select a button and press ', { key: 'L' }, ', then pick “New screen”. Linked screens make a flow.'],
    anchor: '.fse-left .fs-flows',
    placement: 'right',
    progress: (doc) => Object.keys(doc.links).length,
  },
  {
    id: 'play',
    title: 'Play your flow',
    body: ['Press ', { key: 'P' }, ' to click through your screens like a prototype.'],
    anchor: '[data-testid="play-button"]',
    placement: 'bottom',
  },
];

/** Plain-text version of a tip body (for screen readers and tests). */
export const tourText = (body: TourText[]) => body.map((p) => (typeof p === 'string' ? p : p.key)).join('');

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

function storage(): StorageLike | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function hasSeenTour(s: StorageLike | null = storage()): boolean {
  try { return s?.getItem(TOUR_SEEN_KEY) === 'seen'; } catch { return true; }
}

export function markTourSeen(s: StorageLike | null = storage()) {
  try { s?.setItem(TOUR_SEEN_KEY, 'seen'); } catch { /* private mode / storage full: the tour may show again */ }
}

/** Show the tour by itself only once, and never to automated test browsers (unless asked to). */
export function shouldAutoShowTour(
  s: StorageLike | null = storage(),
  automated = typeof navigator !== 'undefined' && navigator.webdriver === true,
): boolean {
  if (!s || hasSeenTour(s)) return false;
  if (!automated) return true;
  try { return s.getItem(TOUR_E2E_KEY) === 'on'; } catch { return false; }
}
