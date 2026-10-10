// Dashboard pieces for "Save to GitHub": the header account control and the "Choose where to save"
// panel. Lazy-loaded by DashboardPage only when the feature is configured.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import { ICON_STROKE } from '../../../chrome/shared';
import { githubConfig } from '../config';
import { getAuthState, rememberReturnTo, signOut, startSignIn, subscribeAuth } from '../auth';
import { NEW_REPO_URL, ghCopy, installUrl } from '../copy';
import { getSyncSnapshot, recheckSetup, repoUrl, requestSync, startGitHubSync, subscribeSync, syncNow, type SyncPhase } from '../runtime';
import { GitHubMark } from './GitHubMark';
import './github.css';

startGitHubSync();

function useSyncSnapshot() {
  return useSyncExternalStore(subscribeSync, getSyncSnapshot);
}

const MENU_STATUS: Partial<Record<SyncPhase, string>> = ghCopy.menuStatus;

export interface GitHubAccountProps {
  /** Shows a calm toast (sign-out confirmation, "kept both versions"). */
  onNotice?: (message: string) => void;
}

/** Header control: "Sign in with GitHub", or the avatar menu once signed in. */
export function GitHubAccount({ onNotice }: GitHubAccountProps) {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState);
  const snap = useSyncSnapshot();

  // Opening the dashboard pulls boards made on other devices.
  useEffect(() => { requestSync(5000); }, []);

  const lastEvent = useRef(snap.lastEvent);
  useEffect(() => {
    if (snap.lastEvent === lastEvent.current) return;
    lastEvent.current = snap.lastEvent;
    if (snap.lastEvent?.type === 'conflict') onNotice?.(`“${snap.lastEvent.title}” changed on two devices — kept both versions.`);
  }, [snap.lastEvent, onNotice]);

  if (auth.status !== 'signed-in') {
    const expired = auth.reason === 'expired';
    return (
      <div className="fsg-account">
        {expired && <span className="fsg-account__note" role="status">{ghCopy.sessionEnded}</span>}
        <button type="button" className="fsc-btn fsc-btn--outline fsg-signin" onClick={() => startSignIn()} data-testid="github-sign-in">
          <GitHubMark size={16} />
          {expired ? ghCopy.signInAgain : ghCopy.signIn}
        </button>
      </div>
    );
  }

  const user = auth.auth.user ?? snap.user;
  const login = user?.login ?? 'GitHub';
  const status = MENU_STATUS[snap.phase];
  const repoOwner = snap.repo?.owner ?? login;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="fsc-btn fsg-avatar-btn" aria-label={ghCopy.accountLabel(login)} data-testid="github-account" data-phase={snap.phase}>
          {user?.avatarUrl
            ? <img className="fsg-avatar" src={user.avatarUrl} alt="" width={24} height={24} />
            : <GitHubMark size={20} />}
          <span className="fsg-avatar-btn__login">{login}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="fsc-float fsc-menu fsc-root fsg-menu" align="end" sideOffset={6}>
          <DropdownMenu.Label className="fsg-menu__head">
            <span className="fsg-menu__who">{ghCopy.signedInAs(login)}</span>
            {status && <span className="fsg-menu__status">{status}</span>}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="fsc-menu__sep" />
          {snap.repo ? (
            <DropdownMenu.Item asChild className="fsc-menu__item">
              <a href={repoUrl(snap.repo)} target="_blank" rel="noreferrer noopener" data-testid="github-repo-link">
                <span className="fsc-menu__label">{ghCopy.savedTo(repoOwner, snap.repo.name)}</span>
                <ExternalLink size={14} strokeWidth={ICON_STROKE} aria-hidden />
                <span className="fsc-sr-only">{ghCopy.setup.newTab}</span>
              </a>
            </DropdownMenu.Item>
          ) : snap.phase === 'needs-setup' && (
            <DropdownMenu.Item className="fsc-menu__item" onSelect={() => { document.getElementById('fsg-setup-title')?.focus(); }}>
              <span className="fsc-menu__label">{ghCopy.chooseWhere}</span>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className="fsc-menu__item" disabled={!snap.repo} onSelect={() => { void syncNow(); }}>
            <RefreshCw size={14} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{ghCopy.syncNow}</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="fsc-menu__sep" />
          <DropdownMenu.Item className="fsc-menu__item" onSelect={() => { signOut(); onNotice?.(ghCopy.signedOutToast); }} data-testid="github-sign-out">
            <LogOut size={14} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-menu__label">{ghCopy.signOut}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Shown on the dashboard while signed in but no `ui-workflow-boards` repo is shared with the app. */
export function GitHubSetupPanel() {
  const snap = useSyncSnapshot();
  const needsSetup = snap.phase === 'needs-setup';
  // Stay on screen while re-checking (phase goes needs-setup → connecting → …).
  const [shown, setShown] = useState(needsSetup);
  if (needsSetup && !shown) setShown(true);
  if (shown && snap.phase !== 'needs-setup' && snap.phase !== 'connecting') setShown(false);
  const checking = snap.phase === 'connecting';

  // Coming back from GitHub in another tab: look again.
  useEffect(() => {
    if (!needsSetup) return;
    let last = 0;
    const onFocus = () => {
      if (Date.now() - last < 5000) return;
      last = Date.now();
      recheckSetup();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [needsSetup]);

  if (!shown) return null;
  return (
    <section className="fsg-setup" aria-labelledby="fsg-setup-title" data-testid="github-setup">
      <h2 id="fsg-setup-title" className="fsg-setup__title" tabIndex={-1}>{ghCopy.setup.title}</h2>
      <p className="fsg-setup__body">{ghCopy.setup.body}</p>
      <ol className="fsg-setup__steps">
        <li>
          <a className="fsc-btn fsc-btn--outline" href={NEW_REPO_URL} target="_blank" rel="noreferrer noopener">
            {ghCopy.setup.step1}
            <ExternalLink size={14} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="fsc-sr-only">{ghCopy.setup.newTab}</span>
          </a>
          <span className="fsg-setup__hint">{ghCopy.setup.step1Hint}</span>
        </li>
        <li>
          <a className="fsc-btn fsc-btn--primary" href={githubConfig ? installUrl(githubConfig.appSlug) : '#'} onClick={() => rememberReturnTo('/', undefined, true)}>
            <GitHubMark size={16} />
            {ghCopy.setup.step2}
          </a>
          <span className="fsg-setup__hint">{ghCopy.setup.step2Hint}</span>
        </li>
      </ol>
      <div>
        <button type="button" className="fsc-btn fsc-btn--outline" aria-disabled={checking || undefined} onClick={() => { if (!checking) recheckSetup(); }}>
          {checking ? ghCopy.setup.checking : ghCopy.setup.checkAgain}
        </button>
      </div>
    </section>
  );
}
