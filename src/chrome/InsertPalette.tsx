import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { filterInsertItems, type InsertItem } from './insertSearch';
import { ICON_STROKE, Kbd } from './shared';

export interface InsertPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InsertItem[];
  onSelect: (item: InsertItem) => void;
  /** Optional icon/thumbnail per item. */
  renderIcon?: (item: InsertItem) => ReactNode;
  placeholder?: string;
  /**
   * Non-modal keeps the canvas interactive (needed for drag-and-drop onto it). Default true.
   */
  modal?: boolean;
  /** When set, items can be dragged out of the palette; returns the drag payload (MIME → data). */
  dragData?: (item: InsertItem) => Record<string, string> | undefined;
  /** Where focus goes after closing (preventDefault to manage it yourself). */
  onCloseAutoFocus?: (e: Event) => void;
  /** Extra class on the list items' icon slot (e.g. larger previews). */
  iconClassName?: string;
}

/** "/" Insert palette: type to filter, ↑↓ to move, Enter to insert (WAI-ARIA combobox + listbox). */
export function InsertPalette({
  open, onOpenChange, items, onSelect, renderIcon, placeholder = 'Search components and shapes…',
  modal = true, dragData, onCloseAutoFocus, iconClassName,
}: InsertPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => filterInsertItems(items, query), [items, query]);

  useEffect(() => { if (open) { setQuery(''); setActive(0); setDragging(false); } }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (item: InsertItem | undefined) => {
    if (!item) return;
    onSelect(item);
    onOpenChange(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = results.length;
    if (!n) return;
    const tile = results[active]?.tile;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const down = e.key === 'ArrowDown';
      const inGrid = tile ? gridNeighbour(listRef.current, active, down) : undefined;
      setActive((a) => inGrid ?? (down ? (a + 1) % n : (a - 1 + n) % n));
    } else if (tile && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      // In a tile grid, left/right move between tiles (the caret stays put).
      e.preventDefault();
      setActive((a) => (e.key === 'ArrowRight' ? Math.min(a + 1, n - 1) : Math.max(a - 1, 0)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    }
  };

  // Group headings appear only when not searching (results are ranked when searching).
  const grouped = !query.trim();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        <Dialog.Overlay className="fsc-overlay" />
        <Dialog.Content className={`fsc-float fsc-palette fsc-root${dragging ? ' is-dragging' : ''}`} aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector('input')?.focus(); }}>
          <Dialog.Title className="fsc-sr-only">Insert</Dialog.Title>
          <div className="fsc-palette__search">
            <Search size={18} strokeWidth={ICON_STROKE} aria-hidden />
            <input
              className="fsc-palette__input"
              role="combobox"
              aria-label="Search components and shapes"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results.length ? optionId(active) : undefined}
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {results.length ? (
            <ul ref={listRef} id={listId} role="listbox" aria-label="Results" className="fsc-palette__list">
              {results.map((item, i) => (
                <PaletteRow key={item.id} heading={grouped && item.group !== results[i - 1]?.group ? item.group : undefined}>
                  <li
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    className={`fsc-palette__item${item.tile ? ' fsc-palette__item--tile' : ''}`}
                    title={item.tile ? item.label : undefined}
                    onMouseMove={() => i !== active && setActive(i)}
                    onMouseDown={dragData ? undefined : (e) => e.preventDefault()} /* keep focus in the search box; draggable rows must not, or drag won't start */
                    onClick={() => choose(item)}
                    draggable={!!dragData}
                    onDragStart={dragData ? (e) => {
                      const data = dragData(item);
                      if (!data) { e.preventDefault(); return; }
                      for (const [k, v] of Object.entries(data)) e.dataTransfer.setData(k, v);
                      e.dataTransfer.effectAllowed = 'copy';
                      // Fade the palette out of the way (after the browser captured the drag image).
                      requestAnimationFrame(() => setDragging(true));
                    } : undefined}
                    onDragEnd={dragData ? () => { setDragging(false); onOpenChange(false); } : undefined}
                  >
                    {renderIcon && <span className={`fsc-palette__icon${iconClassName && !item.tile ? ` ${iconClassName}` : ''}`} aria-hidden>{renderIcon(item)}</span>}
                    {item.tile ? <span className="fsc-sr-only">{item.label}</span> : item.label}
                    {item.hint && !item.tile && <span className="fsc-palette__hint">{item.hint}</span>}
                  </li>
                </PaletteRow>
              ))}
            </ul>
          ) : (
            <p className="fsc-palette__empty" role="status">Nothing matches “{query}”. Try “button” or “screen”.</p>
          )}
          <div className="fsc-palette__foot" aria-hidden>
            <span><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span><Kbd>Enter</Kbd> insert</span>
            <span><Kbd>Esc</Kbd> close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Index of the tile in the next/previous visual row nearest horizontally (grid ↑↓), if any. */
function gridNeighbour(list: HTMLElement | null, index: number, down: boolean): number | undefined {
  const items = list ? [...list.querySelectorAll<HTMLElement>('[data-index]')] : [];
  const cur = items.find((el) => Number(el.dataset.index) === index);
  if (!cur) return undefined;
  const { top, left } = cur.getBoundingClientRect();
  let best: { i: number; dy: number; dx: number } | undefined;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    const dy = down ? r.top - top : top - r.top;
    if (dy < 4) continue;
    const dx = Math.abs(r.left - left);
    if (!best || dy < best.dy - 4 || (Math.abs(dy - best.dy) <= 4 && dx < best.dx)) best = { i: Number(el.dataset.index), dy, dx };
  }
  return best?.i;
}

function PaletteRow({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <>
      {heading && <li role="presentation" className="fsc-palette__group">{heading}</li>}
      {children}
    </>
  );
}
