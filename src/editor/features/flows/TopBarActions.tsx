// Top-bar Compare and Play buttons (Play is the primary action).
import { Columns2, Play } from 'lucide-react';
import { Tip } from '../../../chrome';
import { ICON_STROKE } from '../../../chrome/shared';
import { useEditor } from '../../EditorContext';
import { targetGroup } from './flowIndex';

export function CompareAction() {
  const { doc, selection, runCommand } = useEditor();
  const group = targetGroup(doc, selection.nodes);
  const ok = !!group && group.options.length > 1;
  return (
    <Tip label={ok ? `Compare options – ${group!.name}` : 'Compare needs 2 options. Duplicate a flow as an option (⇧D) first.'} shortcut={ok ? '⇧C' : undefined}>
      <button
        type="button"
        className="fsc-btn"
        aria-disabled={!ok || undefined}
        data-testid="compare-button"
        onClick={() => ok && runCommand('compare', { groupKey: group!.key })}
        aria-keyshortcuts="Shift+C"
      >
        <Columns2 size={16} strokeWidth={ICON_STROKE} aria-hidden /> Compare
      </button>
    </Tip>
  );
}

export function PlayAction() {
  const { runCommand } = useEditor();
  return (
    <Tip label="Play the selected flow" shortcut="P">
      <button type="button" className="fsc-btn fsc-btn--primary" onClick={() => runCommand('play')} aria-keyshortcuts="P" data-testid="play-button">
        <Play size={16} strokeWidth={ICON_STROKE} aria-hidden /> Play
      </button>
    </Tip>
  );
}
