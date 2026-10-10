// /auth/callback — GitHub sends people here after "Sign in with GitHub" (and after installing the
// app). Checks `state`, swaps the one-time code for tokens via the worker, then goes back to where
// the user was. Errors are calm: nothing on this device is touched.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AuthError, checkCallback, clearPendingOAuth, exchangeCode, fetchUser, readPendingOAuth, safeReturnTo, saveAuth, startSignIn,
} from '../platform/github/auth';
import { ghCopy } from '../platform/github/copy';
import '../chrome/chrome.css';
import '../editor/editor.css';

type Outcome =
  | { kind: 'done'; returnTo: string; install: boolean }
  | { kind: 'error'; title: string; text: string; returnTo: string };

// A code can be used once; StrictMode runs effects twice, so share one attempt per URL.
let attempt: { search: string; result: Promise<Outcome> } | undefined;

async function complete(search: string): Promise<Outcome> {
  const pending = readPendingOAuth();
  const returnTo = safeReturnTo(pending?.returnTo);
  const check = checkCallback(new URLSearchParams(search), pending);
  if (!check.ok) {
    clearPendingOAuth();
    if (check.error === 'no-code-install') return { kind: 'done', returnTo, install: true };
    if (check.error === 'denied') return { kind: 'error', title: ghCopy.callback.deniedTitle, text: ghCopy.callback.denied, returnTo };
    return { kind: 'error', title: ghCopy.callback.failedTitle, text: ghCopy.callback.expiredLink, returnTo };
  }
  try {
    const tokens = await exchangeCode(check.code);
    const user = await fetchUser(tokens.accessToken);
    saveAuth({ ...tokens, user });
    clearPendingOAuth();
    return { kind: 'done', returnTo, install: check.install };
  } catch (e) {
    clearPendingOAuth();
    const used = e instanceof AuthError && e.code === 'bad_verification_code';
    return { kind: 'error', title: ghCopy.callback.failedTitle, text: used ? ghCopy.callback.expiredLink : ghCopy.callback.failed, returnTo };
  }
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    const search = location.search;
    if (attempt?.search !== search) attempt = { search, result: complete(search) };
    let alive = true;
    void attempt.result.then(async (o) => {
      if (!alive) return;
      if (o.kind === 'done') {
        if (o.install) (await import('../platform/github/runtime')).recheckSetup();
        navigate(o.returnTo, { replace: true });
      } else {
        setOutcome(o);
      }
    });
    return () => { alive = false; };
  }, [navigate]);

  useEffect(() => {
    document.title = 'Sign in with GitHub · UI Workflow Editor';
  }, []);

  if (outcome?.kind !== 'error') {
    return (
      <main className="fse-state fsc-root" aria-busy="true">
        <p className="fse-state__text" role="status">{ghCopy.callback.working}</p>
      </main>
    );
  }
  return (
    <main className="fse-state fsc-root">
      <div className="fse-state__box">
        <h1 className="fse-state__title">{outcome.title}</h1>
        <p className="fse-state__text">{outcome.text}</p>
        <div style={{ display: 'flex', gap: 'var(--fs-space-2)' }}>
          <Link to={outcome.returnTo} className="fsc-btn fsc-btn--outline" replace>{ghCopy.callback.back}</Link>
          <button type="button" className="fsc-btn fsc-btn--primary" onClick={() => startSignIn(outcome.returnTo)}>{ghCopy.callback.tryAgain}</button>
        </div>
      </div>
    </main>
  );
}
