import { LayoutTemplate } from 'lucide-react';
import { ICON_STROKE, Kbd } from './shared';

export interface CoachMarkProps {
  onTemplate?: () => void;
}

const FIRST_STEPS: { key: string; text: string }[] = [
  { key: 'F', text: 'Add a screen' },
  { key: '/', text: 'Insert a component' },
  { key: 'L', text: 'Link a button to a screen' },
];

/** Empty-board hint, centred on the canvas: the first three actions and their keys (UX doc §6). */
export function CoachMark({ onTemplate }: CoachMarkProps) {
  return (
    <div className="fsc-coach fsc-root" role="note" aria-label="Getting started">
      <p className="fsc-coach__title">Start your flow</p>
      <ol className="fsc-coach__steps">
        {FIRST_STEPS.map((s) => (
          <li key={s.key}><Kbd>{s.key}</Kbd><span>{s.text}</span></li>
        ))}
      </ol>
      <p className="fsc-coach__more">Press <Kbd>?</Kbd> for all shortcuts and the quick tour.</p>
      {onTemplate && (
        <button type="button" className="fsc-btn fsc-btn--outline" onClick={onTemplate}>
          <LayoutTemplate size={16} strokeWidth={ICON_STROKE} aria-hidden /> Browse templates
        </button>
      )}
    </div>
  );
}
