import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Kbd, MOD_KEY } from '../chrome/shared';
import { shortcutGroups } from './shortcuts';

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fse-dialog-overlay" />
        <Dialog.Content className="fse-dialog fsc-root" aria-describedby={undefined}>
          <div className="fse-dialog__head">
            <Dialog.Title className="fse-dialog__title">Keyboard shortcuts</Dialog.Title>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
