// Orchestrator integration: mounts Share and Export into the editor's top bar.
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import { Tip } from '../../chrome';
import { ICON_STROKE } from '../../chrome/shared';
import { ExportDialog, useExportShortcut } from '../../export/ExportDialog';
import { SharePopover } from '../../share/SharePopover';
import { getBoard, subscribeBoards } from '../../platform/boardIndex';
import { useEditor, useEditorCommand } from '../EditorContext';

function useBoardTitle(boardId: string) {
  return useSyncExternalStore(subscribeBoards, () => getBoard(boardId)?.title ?? 'Untitled board');
}

export function ShareAction() {
  const { boardId, toast, store } = useEditor();
  const title = useBoardTitle(boardId);
  const getDoc = useCallback(() => store.getDoc(), [store]);
  return <SharePopover boardId={boardId} title={title} getDoc={getDoc} notify={(m) => toast(m)} />;
}

export function ExportAction() {
  const { boardId, doc, selection, toast } = useEditor();
  const title = useBoardTitle(boardId);
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  useExportShortcut(show);
  useEditorCommand('export', show);
  const firstSelected = selection.nodes.map((id) => doc.frames[id] ?? doc.elements[id]).find(Boolean);
  return (
    <>
      <Tip label="Export PNG or PDF" shortcut="⇧⌘E">
        <button type="button" className="fsc-btn" onClick={show} aria-keyshortcuts="Shift+Meta+E Shift+Control+E">
          <Download size={16} strokeWidth={ICON_STROKE} aria-hidden /> Export
        </button>
      </Tip>
      <ExportDialog
        open={open}
        onOpenChange={setOpen}
        doc={doc}
        title={title}
        selectionIds={selection.nodes}
        currentVariantId={firstSelected?.variantId}
        notify={(m) => toast(m)}
      />
    </>
  );
}
