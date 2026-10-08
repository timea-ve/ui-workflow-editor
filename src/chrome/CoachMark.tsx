import { LayoutTemplate } from 'lucide-react';
import { ICON_STROKE, Kbd } from './shared';

export interface CoachMarkProps {
  onTemplate?: () => void;
}

/** Empty-board hint, centred on the canvas (UX doc §6). */
export function CoachMark({ onTemplate }: CoachMarkProps) {
  return (
    <div className="fsc-coach fsc-root" role="note" aria-label="Getting started">
      <p className="fsc-coach__title">This board is empty</p>
      <p className="fsc-coach__hints">
        <span>Press <Kbd>F</Kbd> to add a screen</span>
        <span className="fsc-coach__dot" aria-hidden>·</span>
        <span><Kbd>/</Kbd> to insert</span>
        <span className="fsc-coach__dot" aria-hidden>·</span>
        <span>or use a template</span>
      </p>
      {onTemplate && (
        <button type="button" className="fsc-btn fsc-btn--outline" onClick={onTemplate}>
          <LayoutTemplate size={16} strokeWidth={ICON_STROKE} aria-hidden /> Browse templates
        </button>
      )}
    </div>
  );
}
