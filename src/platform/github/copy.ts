// "Save to GitHub" strings in one place. Calm, plain, short (same voice as src/dashboard/copy.ts).
import { BOARDS_REPO } from './config';

export const ghCopy = {
  signIn: 'Sign in with GitHub',
  signInAgain: 'Sign in again',
  sessionEnded: 'Signed out of GitHub',
  accountLabel: (login: string) => `GitHub account: ${login}`,
  signedInAs: (login: string) => `Signed in as ${login}`,
  savedTo: (owner: string, repo = BOARDS_REPO) => `Saved to github.com/${owner}/${repo}`,
  chooseWhere: 'Choose where to save…',
  syncNow: 'Sync now',
  signOut: 'Sign out',
  signedOutToast: 'Signed out of GitHub. Your boards are still here.',

  menuStatus: {
    connecting: 'Connecting to GitHub…',
    syncing: 'Saving to GitHub…',
    synced: 'All boards saved to GitHub',
    offline: 'Offline — will save to GitHub when you’re back',
    error: 'Couldn’t reach GitHub — trying again soon',
    'needs-setup': 'Not saving yet — choose where to save',
  },

  setup: {
    title: 'Choose where to save on GitHub',
    body: `Your boards will be saved in a private repository called ${BOARDS_REPO}. Two quick steps:`,
    step1: 'Create the repository',
    step1Hint: 'Skip this if you already have it.',
    step2: 'Give access',
    step2Hint: `Pick only ${BOARDS_REPO}. The app can’t see your other repositories.`,
    checkAgain: 'Check again',
    checking: 'Checking…',
    newTab: '(opens in a new tab)',
  },

  status: {
    saved: 'Saved to GitHub',
    saving: 'Saving to GitHub…',
    connecting: 'Connecting to GitHub…',
    offline: 'Offline — saved on this device',
    error: 'Not saved to GitHub yet — retrying',
    signedOut: 'Not saved to GitHub — sign in',
    needsSetup: 'Not saved to GitHub — choose where',
  },

  callback: {
    working: 'Signing you in to GitHub…',
    deniedTitle: 'Sign-in cancelled',
    denied: 'Nothing changed. Your boards are still saved on this device.',
    failedTitle: 'Couldn’t sign in to GitHub',
    failed: 'Your boards are safe on this device. Please try again.',
    expiredLink: 'This sign-in link has expired or was already used. Please try again.',
    installedTitle: 'Access updated',
    installed: 'Taking you back to your boards…',
    tryAgain: 'Try again',
    back: 'Back to your boards',
  },
} as const;

export const NEW_REPO_URL = `https://github.com/new?name=${BOARDS_REPO}&visibility=private&description=Boards%20saved%20by%20UI%20Workflow%20Editor`;
export const installUrl = (slug: string) => `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;
