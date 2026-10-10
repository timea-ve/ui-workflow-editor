// "Save to GitHub" configuration. All three values are public (they ship in the page) and come from
// build-time env vars; see docs/GITHUB-SAVE.md. If any is missing the whole feature stays hidden.

export interface GitHubConfig {
  clientId: string;
  appSlug: string;
  /** Token-exchange worker, without a trailing slash. */
  workerUrl: string;
}

export const BOARDS_REPO = 'ui-workflow-boards';

export function readGitHubConfig(env: Record<string, string | undefined>): GitHubConfig | null {
  const clientId = env.VITE_GITHUB_CLIENT_ID?.trim();
  const appSlug = env.VITE_GITHUB_APP_SLUG?.trim();
  const workerUrl = env.VITE_AUTH_WORKER_URL?.trim().replace(/\/+$/, '');
  if (!clientId || !appSlug || !workerUrl) return null;
  return { clientId, appSlug, workerUrl };
}

export const githubConfig: GitHubConfig | null = readGitHubConfig(import.meta.env as Record<string, string | undefined>);
export const githubEnabled = githubConfig !== null;

/** Where GitHub sends people back after sign-in: <origin><base>auth/callback. */
export function callbackUrl(origin = location.origin, base = import.meta.env.BASE_URL): string {
  return `${origin}${base.endsWith('/') ? base : `${base}/`}auth/callback`;
}
