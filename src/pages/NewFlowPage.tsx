// `/new/v1#<data>`: a flow link made by Copilot (`npm run flow`). Builds the flow spec carried in the
// fragment into a NEW board in this browser, then replaces the URL with the editor (`/b/<id>`).
// See src/platform/flowLink.ts and docs/AGENT-FLOWS.md.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Board } from '../model/types';
import { BoardOpError, importBoard } from '../platform/boards';
import { FLOW_LINK_VERSION, decodeFlowLink } from '../platform/flowLink';
import { buildFlowBoard } from '../platform/flowSpecBoard';
import '../chrome/chrome.css';
import '../editor/editor.css';

type State =
  | { kind: 'working' }
  | { kind: 'broken'; problems: string[] }
  | { kind: 'failed' };

class FlowLinkProblem extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super('invalid flow');
    this.problems = problems;
  }
}

/**
 * One import per link data while it's in flight, so React StrictMode's double effect (or a quick
 * re-render) doesn't create the board twice. Cleared once settled: opening the link again later makes
 * another board, like opening a template twice.
 */
const inFlight = new Map<string, Promise<Board>>();

function importFlow(data: string): Promise<Board> {
  let p = inFlight.get(data);
  if (!p) {
    p = (async () => {
      const result = await decodeFlowLink(data);
      if (!result.ok) throw new FlowLinkProblem(result.errors);
      const { doc } = buildFlowBoard(result.spec);
      return importBoard({ title: result.spec.name, doc });
    })();
    inFlight.set(data, p);
    const clear = () => { inFlight.delete(data); };
    p.then(clear, clear);
  }
  return p;
}

export function NewFlowPage() {
  const { version = '' } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const data = hash.replace(/^#/, '');
  const [failure, setFailure] = useState<{ data: string; state: State } | null>(null);
  const state: State = version !== FLOW_LINK_VERSION || !data ? { kind: 'broken', problems: [] }
    : failure?.data === data ? failure.state : { kind: 'working' };

  useEffect(() => {
    if (version !== FLOW_LINK_VERSION || !data) return;
    let alive = true;
    importFlow(data).then(
      (board) => { if (alive) navigate(`/b/${board.id}`, { replace: true }); },
      (e: unknown) => {
        if (!alive) return;
        const st: State = e instanceof FlowLinkProblem ? { kind: 'broken', problems: e.problems }
          : e instanceof BoardOpError ? { kind: 'failed' } : { kind: 'broken', problems: [] };
        setFailure({ data, state: st });
      },
    );
    return () => { alive = false; };
  }, [version, data, navigate]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'New flow · UI Workflow Editor';
    return () => { document.title = prev; };
  }, []);

  if (state.kind === 'working') {
    return (
      <main className="fse-state fsc-root" aria-busy="true">
        <p className="fse-state__text" role="status">Creating your board…</p>
      </main>
    );
  }

  return (
    <main className="fse-state fsc-root">
      <div className="fse-state__box" role="alert">
        {state.kind === 'failed' ? (
          <>
            <h1 className="fse-state__title">Couldn’t save the new board</h1>
            <p className="fse-state__text">Your browser didn’t let us save it. Check that this site may store data, then open the link again.</p>
          </>
        ) : (
          <>
            <h1 className="fse-state__title">This flow link is incomplete</h1>
            <p className="fse-state__text">Ask Copilot for a new one. If you copied it, part of it may have been cut off.</p>
            {state.problems.length > 0 && (
              <details className="fse-state__details">
                <summary>What’s wrong (for Copilot)</summary>
                <ul>{state.problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </details>
            )}
          </>
        )}
        <Link to="/" className="fsc-btn fsc-btn--outline">Back to your boards</Link>
      </div>
    </main>
  );
}
