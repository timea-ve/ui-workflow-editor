import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { BoardDoc, ID } from '../model/types';
import type { VisualStyle } from '../kit/types';
import { FlowCanvas } from '../flow/FlowCanvas';
import { PlayView } from '../flow/PlayView';
import { buildSandboxBoard } from '../flow/seed';
import { detectFlows, duplicateAsOption, flowForNode, framesInVariant, getStartFrame, variantsInFlow } from '../flow/ops';

// Owner: Diagram & Flow agent. Gate 2 sandbox: a small board proving
// screens + components + connectors + links + an Option B variant render on the canvas.

/** The flow (screens) the user means: the selected node's flow, else the first option's flow. */
function targetFlowFrames(doc: BoardDoc, selection: ID[]): ID[] | undefined {
  for (const id of selection) {
    const flow = flowForNode(doc, id);
    if (flow) return flow.frameIds;
  }
  return detectFlows(doc)[0]?.frameIds;
}

export function FlowSandboxPage() {
  const [doc, setDoc] = useState<BoardDoc>(buildSandboxBoard);
  const [style, setStyle] = useState<VisualStyle>('clean');
  const [selection, setSelection] = useState<ID[]>([]);
  const [play, setPlay] = useState<{ frameId: ID; title: string } | null>(null);

  const playVariant = useCallback((variantId: ID) => {
    const frames = framesInVariant(doc, variantId).map((f) => f.id);
    const start = getStartFrame(doc, frames);
    if (start) setPlay({ frameId: start, title: doc.variants[variantId]?.label ?? 'Flow' });
  }, [doc]);

  const onPlay = () => {
    const frames = targetFlowFrames(doc, selection);
    if (!frames) return;
    const start = getStartFrame(doc, frames);
    const variantId = start ? doc.frames[start].variantId : undefined;
    if (start) setPlay({ frameId: start, title: (variantId && doc.variants[variantId]?.label) || 'Flow' });
  };

  const onDuplicate = () => {
    const frames = targetFlowFrames(doc, selection);
    if (frames) setDoc((d) => duplicateAsOption(d, frames).doc);
  };

  const view = useMemo(() => ({ style, onPlayVariant: playVariant }), [style, playVariant]);
  const optionCount = useMemo(() => {
    const first = Object.values(doc.variants)[0];
    return first ? variantsInFlow(doc, first.flowId).length : 0;
  }, [doc]);

  return (
    <div data-kit-style={style} style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'var(--fs-surface)', borderBottom: '1px solid var(--fs-hairline)', fontSize: 14 }}>
        <Link to="/">← Home</Link>
        <strong>Flow sandbox</strong>
        <div role="group" aria-label="Visual style" style={{ display: 'flex', gap: 4 }}>
          {(['sketchy', 'clean'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={style === s} onClick={() => setStyle(s)}
              style={{ fontWeight: style === s ? 700 : 400 }}>
              {s === 'sketchy' ? 'Sketchy' : 'Clean'}
            </button>
          ))}
        </div>
        <button type="button" onClick={onDuplicate} title="Copies the selected flow (or the first one) as a new option lane below">
          Duplicate as option
        </button>
        <button type="button" onClick={onPlay} title="Click through the selected option from its start screen">▶ Play</button>
        <span style={{ color: 'var(--fs-muted)', fontSize: 12 }}>
          {optionCount} options · drag from a handle onto a screen to link · select + Delete removes
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ReactFlowProvider>
          <FlowCanvas doc={doc} setDoc={setDoc} view={view} onSelectionChange={setSelection} />
        </ReactFlowProvider>
        {play && (
          <PlayView doc={doc} startFrameId={play.frameId} style={style} title={play.title} onExit={() => setPlay(null)} />
        )}
      </div>
    </div>
  );
}
