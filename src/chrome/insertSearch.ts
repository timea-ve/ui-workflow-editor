// Pure search for the "/" Insert palette.

export interface InsertItem {
  id: string;
  label: string;
  /** Group heading, e.g. "Wireframe" or "Diagram". */
  group: string;
  keywords?: string[];
  /** Optional right-aligned hint, e.g. a shortcut. */
  hint?: string;
  /** Render as a compact tile (icon only, label as tooltip) that flows in a grid with its neighbours. */
  tile?: boolean;
}

function score(item: InsertItem, q: string): number {
  const label = item.label.toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.split(/[\s/–-]+/).some((w) => w.startsWith(q))) return 60;
  const kws = (item.keywords ?? []).map((k) => k.toLowerCase());
  if (kws.some((k) => k.startsWith(q))) return 40;
  if (q.length > 2 && label.includes(q)) return 20;
  return 0;
}

/** Filter + rank items. Empty query keeps the original order. Ties keep original order. */
export function filterInsertItems(items: InsertItem[], query: string): InsertItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items
    .map((item, i) => ({ item, i, s: score(item, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.item);
}
