import * as Dialog from '@radix-ui/react-dialog';
import { Lightbulb, X } from 'lucide-react';
import { ICON_STROKE, Kbd, MOD_KEY } from '../chrome/shared';
import { shortcutGroups } from './shortcuts';
import { useReturnFocus } from '../chrome/returnFocus';

export function ShortcutsDialog({ open, onOpenChange, onShowTour }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Re-opens the first-run tour (hidden when not given, e.g. read-only). */
  onShowTour?: () => void;
}) {
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fse-dialog-overlay" />
        <Dialog.Content className="fse-dialog fsc-root" aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
          <div className="fse-dialog__head">
            <Dialog.Title className="fse-dialog__title">Keyboard shortcuts</Dialog.Title>
            {onShowTour && (
              <button type="button" className="fsc-btn fsc-btn--outline fse-dialog__aside" onClick={onShowTour}>
                <Lightbulb size={16} strokeWidth={ICON_STROKE} aria-hidden /> Show quick tour
              </button>
            )}
            <Dialog.Close className="fsc-btn fsc-btn--icon" aria-label="Close">
              <X size={16} aria-hidden />
            </Dialog.Close>
          </div>
          <div className="fse-shortcuts">
            {shortcutGroups(MOD_KEY).map((g) => (
              <section key={g.title} aria-labelledby={`fse-sc-${g.title}`}>
                <h3 id={`fse-sc-${g.title}`} className="fse-shortcuts__group">{g.title}</h3>
                <dl>
                  {g.items.map((s) => (
                    <div key={s.label} className="fse-shortcuts__row">
                      <dt>{s.label}</dt>
                      <dd>{s.keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <p className="fse-shortcuts__note">
            Using Safari? Press <Kbd>⌥</Kbd> <Kbd>Tab</Kbd> to move between buttons, or turn on “Press Tab to highlight each item” in Safari’s Advanced settings.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
