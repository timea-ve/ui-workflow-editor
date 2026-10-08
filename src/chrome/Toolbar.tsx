import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { TOOLS, TOOL_ACTIONS, type ToolAction, type ToolId } from './tools';
import { ICON_SIZE, ICON_STROKE, TOOL_ICONS, Tip } from './shared';

export interface ToolbarProps {
  activeTool: ToolId;
  onToolChange: (tool: ToolId) => void;
  /** Insert palette ("/") and Play ("P") are actions, not tools. */
  onAction: (action: ToolAction) => void;
  orientation?: 'vertical' | 'horizontal';
  /** Hide the small corner key letters (tooltips still show them). */
  hideKeyHints?: boolean;
}

/** Drawing tools with single-key shortcut hints (UX doc §5.1). */
export function Toolbar({ activeTool, onToolChange, onAction, orientation = 'vertical', hideKeyHints }: ToolbarProps) {
  const side = orientation === 'vertical' ? 'right' : 'bottom';
  return (
    <div className="fsc-toolbar fsc-root" role="group" aria-label="Tools" data-orientation={orientation}>
      <ToggleGroup.Root
        className="fsc-toolbar__group"
        type="single"
        orientation={orientation}
        value={activeTool}
        onValueChange={(v) => v && onToolChange(v as ToolId)}
        aria-label="Drawing tool"
      >
        {TOOLS.map((t, i) => {
          const Icon = TOOL_ICONS[t.id];
          return (
            <span key={t.id} style={{ display: 'contents' }}>
              {(i === 2 || i === 3) && <span className="fsc-toolbar__sep" aria-hidden />}
              <Tip label={t.label} shortcut={t.key} side={side}>
                <ToggleGroup.Item className="fsc-tool" value={t.id} aria-label={t.label} aria-keyshortcuts={t.key}>
                  <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
                  {!hideKeyHints && <span className="fsc-tool__key" aria-hidden>{t.key}</span>}
                </ToggleGroup.Item>
              </Tip>
            </span>
          );
        })}
      </ToggleGroup.Root>
      <span className="fsc-toolbar__sep" aria-hidden />
      {TOOL_ACTIONS.map((a) => {
        const Icon = TOOL_ICONS[a.id];
        return (
          <Tip key={a.id} label={a.label} shortcut={a.key} side={side}>
            <button type="button" className="fsc-tool" aria-label={a.label} aria-keyshortcuts={a.key} onClick={() => onAction(a.id)}>
              <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
              {!hideKeyHints && <span className="fsc-tool__key" aria-hidden>{a.key}</span>}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
