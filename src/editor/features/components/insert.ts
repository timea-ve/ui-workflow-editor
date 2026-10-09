// Inserting a palette item into the board (shared by the "/" palette and drag-and-drop).
import type { BoardDoc, ID } from '../../../model/types';
import type { EditorApi } from '../../EditorContext';
import { placeScreen } from '../../placement';
import { frameAtPoint, insertAtPoint, insertIntoFrame, targetFrameFor, type Point } from './ops';
import type { PaletteItem } from './paletteItems';

/** Focus a canvas node once React Flow has rendered it (keyboard users continue from there). */
export function focusNode(id: ID) {
  let tries = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
    if (el) el.focus({ preventScroll: true });
    else if (++tries < 10) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Inserts `item` as one undo step, selects and announces it. With `at` (a drop point) it lands there,
 * inside the screen under the point; otherwise inside the selected screen (stacked below its content)
 * or at the viewport centre.
 */
export function insertPaletteItem(api: EditorApi, item: PaletteItem, at?: Point): ID | undefined {
  if (api.readOnly) return undefined;
  if (item.target.kind === 'tool') {
    // Connectors are drawn, not placed: switch to the tool and say how to use it.
    api.setTool(item.target.tool);
    api.announce('Arrow tool: drag from one shape or screen to another');
    return undefined;
  }
  let id: ID | undefined;
  let message = '';
  const op = (doc: BoardDoc): BoardDoc => {
    const t = item.target;
    if (t.kind === 'tool') return doc;
    if (t.kind === 'screen') {
      const r = placeScreen(doc, at ?? api.viewportCenter(), t.device);
      id = r.id;
      message = r.label;
      return r.doc;
    }
    const frameId = at ? frameAtPoint(doc, at) : targetFrameFor(doc, api.selection.nodes);
    const r = frameId && !at ? insertIntoFrame(doc, t.type, frameId, t.props)
      : insertAtPoint(doc, t.type, at ?? api.viewportCenter(), frameId, t.props);
    id = r.id;
    message = `${item.label} added${frameId ? ` to ${doc.frames[frameId].name}` : ''}`;
    return r.doc;
  };
  if (!api.apply(op, { label: `Add ${item.label}` }) || !id) return undefined;
  api.setSelection([id]);
  api.announce(message);
  return id;
}
