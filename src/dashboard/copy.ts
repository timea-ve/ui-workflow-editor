// All dashboard strings in one place for copy review. Drafts — the Copy agent polishes later.

export const copy = {
  appName: 'FlowSketch',
  pageTitle: 'Your boards · FlowSketch',

  newBoard: 'New board',
  newBoardShortcut: 'N',
  creating: 'Creating…',

  emptyTitle: 'Sketch your first flow',
  emptyBody: 'Draw rough screens, link them together, and click through the flow. Start blank or from a ready-made flow.',

  templatesTitle: 'Start from a template',
  templatesHint: 'Linked screens you can click through right away.',
  templateScreens: (n: number) => `${n} screens`,
  templateAction: (name: string) => `Use ${name} template`,

  boardsTitle: 'Your boards',
  searchLabel: 'Search boards',
  searchPlaceholder: 'Search by name',
  noMatches: (q: string) => `No boards match “${q}”.`,
  clearSearch: 'Clear search',
  boardCount: (n: number) => (n === 1 ? '1 board' : `${n} boards`),

  edited: (rel: string) => `Edited ${rel}`,
  menuLabel: (title: string) => `Options for ${title}`,
  menu: {
    open: 'Open',
    rename: 'Rename',
    duplicate: 'Duplicate',
    copyLink: 'Copy share link',
    copyLinkDisabledHint: 'Share from inside the board',
    delete: 'Delete',
  },
  renameLabel: 'Board name',

  loading: 'Loading your boards…',
  loadError: "Couldn't load your boards.",
  retry: 'Retry',

  toast: {
    deleted: (title: string) => `“${title}” deleted`,
    undo: 'Undo',
    restored: (title: string) => `“${title}” restored`,
    duplicated: (title: string) => `Created “${title}”`,
    linkCopied: 'Share link copied',
    linkCopyFailed: "Couldn't copy the link. Open the board to share it.",
    createFailed: "Couldn't create the board. Nothing was saved — please try again.",
    duplicateFailed: "Couldn't duplicate the board. Your original is safe.",
    deleteFailed: "Couldn't delete the board. Please try again.",
    undoTooLate: 'Too late to undo — the board was already removed.',
  },
} as const;

/** "just now", "3 min ago", "2 h ago", "yesterday", "4 days ago", else a short date. */
export function formatRelative(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return `on ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}`;
}
