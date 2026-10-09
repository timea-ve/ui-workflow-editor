// Undo / Redo buttons on the board (bottom-left, next to the zoom controls).
import { Panel } from '@xyflow/react';
import { Redo2, Undo2 } from 'lucide-react';
import { useEditor } from './EditorContext';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

export function UndoRedo() {
  const api = useEditor();
  if (api.readOnly) return null;
  return (
    <Panel position="bottom-left" className="fs-undo-redo" aria-label="History">
      <button type="button" className="fs-undo-redo__btn" onClick={api.undo} disabled={!api.canUndo}
        aria-label="Undo" title={`Undo (${mod}Z)`}>
        <Undo2 size={16} strokeWidth={1.75} aria-hidden />
      </button>
      <button type="button" className="fs-undo-redo__btn" onClick={api.redo} disabled={!api.canRedo}
        aria-label="Redo" title={`Redo (${mod}Y)`}>
        <Redo2 size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </Panel>
  );
}
