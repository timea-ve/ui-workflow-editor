// Pure helpers for the context bar: which fields sit on the bar, and the list ("items") encoding.
import type { PropField } from '../../../kit/types';

/** At most this many fields go on the bar by default; the rest live in "More". */
export const MAX_INLINE = 3;

export const splitItems = (v: unknown): string[] => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
export const joinItems = (rows: string[]): string => rows.map((s) => s.trim()).filter(Boolean).join(', ');

/** Bar vs "More" placement for a kit element's fields (see docs/phase-3/context-bar.md). */
export function splitFields(fields: PropField[]): { inline: PropField[]; more: PropField[] } {
  const explicit = fields.filter((f) => f.bar === 'inline');
  const auto = fields.filter((f) => f.bar === undefined && f.kind !== 'text' && f.kind !== 'multiline' && f.kind !== 'number');
  const inline = [...explicit, ...auto.slice(0, Math.max(0, MAX_INLINE - explicit.length))];
  return { inline, more: fields.filter((f) => !inline.includes(f)) };
}
