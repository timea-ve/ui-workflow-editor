// Editor header: where this board stands on GitHub, next to "Saved on this device".
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, CloudOff, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ID } from '../../../model/types';
import { ICON_STROKE } from '../../../chrome/shared';
import { startSignIn } from '../auth';
import { ghCopy } from '../copy';
import { boardCloudStatus, getSyncSnapshot, startGitHubSync, subscribeSync } from '../runtime';
import { GitHubMark } from './GitHubMark';
import './github.css';

startGitHubSync();

export function CloudStatus({ boardId, localSaving = false }: { boardId: ID; localSaving?: boolean }) {
  const status = useSyncExternalStore(subscribeSync, () => boardCloudStatus(boardId, getSyncSnapshot()));
  const shown = status === 'saved' && localSaving ? 'saving' : status;
  let body;
  switch (shown) {
    case 'signed-out':
      body = (
        <button type="button" className="fsg-cloud__action" onClick={() => startSignIn()} data-testid="cloud-sign-in">
          <GitHubMark size={13} />{ghCopy.status.signedOut}
        </button>
      );
      break;
    case 'needs-setup':
      body = (
        <Link to="/" className="fsg-cloud__action">
          <GitHubMark size={13} />{ghCopy.status.needsSetup}
        </Link>
      );
      break;
    case 'saving':
    case 'connecting':
      body = <><LoaderCircle size={14} strokeWidth={ICON_STROKE} className="fsc-spin" aria-hidden />{shown === 'saving' ? ghCopy.status.saving : ghCopy.status.connecting}</>;
      break;
    case 'offline':
      body = <><CloudOff size={14} strokeWidth={ICON_STROKE} aria-hidden />{ghCopy.status.offline}</>;
      break;
    case 'error':
      body = <><RefreshCw size={14} strokeWidth={ICON_STROKE} aria-hidden />{ghCopy.status.error}</>;
      break;
    default:
      body = <><Cloud size={14} strokeWidth={ICON_STROKE} aria-hidden />{ghCopy.status.saved}</>;
  }
  return (
    <span className="fsg-cloud" role="status" aria-live="polite" data-status={shown} data-testid="cloud-status">
      {body}
    </span>
  );
}
