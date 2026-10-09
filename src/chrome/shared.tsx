import type { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  AppWindow, Circle, Diamond, Hand, MousePointer2, MoveUpRight, Play, Plus, Square, StickyNote, Type,
  type LucideIcon,
} from 'lucide-react';
import type { ToolAction, ToolId } from './tools';
import './chrome.css';

export const ICON_SIZE = 18;
export const ICON_STROKE = 1.75;

export const TOOL_ICONS: Record<ToolId | ToolAction, LucideIcon> = {
  select: MousePointer2,
  pan: Hand,
  screen: AppWindow,
  rect: Square,
  diamond: Diamond,
  ellipse: Circle,
  arrow: MoveUpRight,
  text: Type,
  sticky: StickyNote,
  insert: Plus,
  play: Play,
};

export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

/** A keyboard key cap. Pass several children for a combo. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="fsc-kbd">{children}</kbd>;
}

/** Wrap the editor (or preview) once so tooltips share timing. */
export function ChromeProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={400} skipDelayDuration={200}>{children}</Tooltip.Provider>;
}

/** Tooltip with an optional shortcut hint, e.g. "Rectangle  R". */
export function Tip({ label, shortcut, side = 'bottom', children }: { label: string; shortcut?: string; side?: 'top' | 'right' | 'bottom' | 'left'; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="fsc-tooltip" side={side} sideOffset={8}>
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** UI Workflow Editor mark: two boxes joined by an arrow. Drawn for this project. */
export function BrandMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1.5" y="2" width="5" height="5" rx="1" />
      <rect x="9.5" y="9" width="5" height="5" rx="1" />
      <path d="M4 7v4.5h4M6.8 10l1.4 1.5L6.8 13" />
    </svg>
  );
}
