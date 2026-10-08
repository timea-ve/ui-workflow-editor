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
}

/** "/" Insert palette: type to filter, ↑↓ to move, Enter to insert (WAI-ARIA combobox + listbox). */
export function InsertPalette({ open, onOpenChange, items, onSelect, renderIcon, placeholder = 'Search components and shapes…' }: InsertPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => filterInsertItems(items, query), [items, query]);

  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);
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
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    }
  };

  // Group headings appear only when not searching (results are ranked when searching).
  const grouped = !query.trim();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fsc-overlay" />
        <Dialog.Content className="fsc-float fsc-palette fsc-root" aria-describedby={undefined}
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
                    className="fsc-palette__item"
                    onMouseMove={() => i !== active && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(item)}
                  >
                    {renderIcon && <span className="fsc-palette__icon" aria-hidden>{renderIcon(item)}</span>}
                    {item.label}
                    {item.hint && <span className="fsc-palette__hint">{item.hint}</span>}
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

function PaletteRow({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <>
      {heading && <li role="presentation" className="fsc-palette__group">{heading}</li>}
      {children}
    </>
  );
}
