// All dashboard strings in one place (reviewed in docs/phase-4/copy-deck.md).

export const copy = {
  appName: 'UI Workflow Editor',
  pageTitle: 'Your boards · UI Workflow Editor',

  newBoard: 'New board',
  newBoardShortcut: 'N',
  creating: 'Creating…',

  emptyTitle: 'Sketch your first flow',
  emptyBody: 'Sketch rough screens, link them into a flow, and click through it. Start blank or from a template.',

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
    moveTo: 'Move to folder',
    noFolder: 'No folder',
    newFolder: 'New folder…',
    delete: 'Delete',
  },
  renameLabel: 'Board name',
  inFolder: (name: string) => `in ${name}`,

  folders: {
    newFolder: 'New folder',
    count: (n: number) => (n === 0 ? 'Empty' : n === 1 ? '1 board' : `${n} boards`),
    menuLabel: (name: string) => `Options for folder ${name}`,
    open: 'Open',
    rename: 'Rename',
    delete: 'Delete folder',
    renameLabel: 'Folder name',
    back: 'Your boards',
    backHint: 'Back to your boards',
    empty: 'No boards here yet. Create one, or use “Move to folder” on any board.',
    notFound: 'This folder doesn’t exist anymore.',
    dropHint: (name: string) => `Drop to move into ${name}`,
    confirmTitle: (name: string) => `Delete “${name}”?`,
    confirmBody: (n: number) => (n === 0
      ? 'The folder moves to Trash. You can restore it there for 30 days.'
      : `The folder and its ${n === 1 ? 'board' : `${n} boards`} move to Trash. You can restore them there for 30 days.`),
    confirmAction: 'Move to Trash',
    cancel: 'Cancel',
  },

  trash: {
    link: 'Trash',
    linkCount: (n: number) => (n ? `Trash, ${n} item${n === 1 ? '' : 's'}` : 'Trash, empty'),
    pageTitle: 'Trash · UI Workflow Editor',
    title: 'Trash',
    hint: 'Deleted boards and folders stay here for 30 days, then they’re deleted for good.',
    empty: 'Trash is empty.',
    meta: (rel: string, days: number) => `Deleted ${rel} · ${days <= 1 ? 'deleted for good tomorrow' : `deleted for good in ${days} days`}`,
    folderTag: (n: number) => `Folder · ${n === 1 ? '1 board' : `${n} boards`}`,
    restore: 'Restore',
    restoreLabel: (name: string) => `Restore ${name}`,
    deleteForever: 'Delete forever',
    deleteForeverLabel: (name: string) => `Delete ${name} forever`,
    emptyTrash: 'Empty Trash',
    confirmForeverTitle: (name: string) => `Delete “${name}” forever?`,
    confirmForeverBody: (boards: number) => (boards
      ? `The folder and its ${boards === 1 ? 'board' : `${boards} boards`} will be deleted for good. This can’t be undone.`
      : 'It will be deleted for good. This can’t be undone.'),
    confirmEmptyTitle: 'Empty Trash?',
    confirmEmptyBody: (n: number) => `${n === 1 ? 'The item' : `All ${n} items`} in Trash will be deleted for good. This can’t be undone.`,
    restored: (name: string) => `“${name}” restored`,
    deleted: (name: string) => `“${name}” deleted for good`,
    emptied: 'Trash emptied',
    failed: "Couldn't delete everything. Please try again.",
  },

  loading: 'Loading your boards…',
  loadError: "Couldn't read your boards. Your browser may be blocking storage, for example in a private window.",
  retry: 'Try again',

  toast: {
    deleted: (title: string) => `“${title}” moved to Trash`,
    moved: (title: string, folder: string | null) => (folder ? `Moved “${title}” to ${folder}` : `Moved “${title}” out of its folder`),
    undo: 'Undo',
    restored: (title: string) => `“${title}” restored`,
    duplicated: (title: string) => `Created “${title}”`,
    linkCopied: 'Share link copied',
    linkCopyFailed: "Couldn't copy the link. Open the board to share it.",
    createFailed: "Couldn't create the board. Your browser's storage may be full — try again, or delete a board you don't need.",
    duplicateFailed: "Couldn't duplicate the board. Your original is safe.",
    deleteFailed: "Couldn't delete the board. Please try again.",
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
