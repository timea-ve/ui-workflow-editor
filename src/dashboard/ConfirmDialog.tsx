import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

/** Small "are you sure?" dialog. Focus starts on Cancel so Enter never deletes by accident. */
export function ConfirmDialog({ request, cancelLabel, onClose }: {
  request: ConfirmRequest | null;
  cancelLabel: string;
  onClose: () => void;
}) {
  const [working, setWorking] = useState(false);
  const confirm = async () => {
    if (!request || working) return;
    setWorking(true);
    try { await request.onConfirm(); } finally { setWorking(false); onClose(); }
  };
  return (
    <Dialog.Root open={request !== null} onOpenChange={(o) => { if (!o && !working) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fsc-overlay" />
        <Dialog.Content role="alertdialog" className="fsd-dialog fsc-float fsc-root" data-kit-style="clean" aria-busy={working || undefined}>
          {request && (
            <>
              <Dialog.Title className="fsd-dialog__title">{request.title}</Dialog.Title>
              <Dialog.Description className="fsd-dialog__desc">{request.body}</Dialog.Description>
              <div className="fsd-dialog__foot">
                <Dialog.Close asChild>
                  <button type="button" className="fsc-btn fsc-btn--outline" disabled={working}>{cancelLabel}</button>
                </Dialog.Close>
                <button type="button" className="fsc-btn fsd-btn--danger" onClick={() => void confirm()} disabled={working} data-testid="confirm-action">
                  {request.confirmLabel}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
