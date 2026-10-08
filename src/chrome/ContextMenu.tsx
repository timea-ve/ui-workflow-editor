import type { ReactNode } from 'react';
import * as RadixContextMenu from '@radix-ui/react-context-menu';

export type MenuEntry =
  | { type?: 'item'; id: string; label: string; shortcut?: string; disabled?: boolean }
  | { type: 'separator'; id: string };

export interface ContextMenuProps {
  items: MenuEntry[];
  onSelect: (id: string) => void;
  /** The area that opens the menu on right-click, long-press, Shift+F10 or the Menu key. */
  children: ReactNode;
}

/** Right-click menu. Wraps exactly one element (passed via asChild). */
export function ContextMenu({ items, onSelect, children }: ContextMenuProps) {
  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className="fsc-float fsc-menu fsc-root">
          {items.map((it) =>
            it.type === 'separator' ? (
              <RadixContextMenu.Separator key={it.id} className="fsc-menu__sep" />
            ) : (
              <RadixContextMenu.Item key={it.id} className="fsc-menu__item" disabled={it.disabled} onSelect={() => onSelect(it.id)}>
                <span className="fsc-menu__label">{it.label}</span>
                {it.shortcut && <span className="fsc-menu__shortcut">{it.shortcut}</span>}
              </RadixContextMenu.Item>
            ),
          )}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}
