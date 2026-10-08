// The "/" Insert palette in the editor: claims the `insert` command, lists every component, shape
// and screen with a lo-fi preview, inserts on Enter / click, and supports dragging onto the canvas.
import { memo, useCallback, useRef, useState } from 'react';
import { InsertPalette } from '../../../chrome/InsertPalette';
import type { InsertItem } from '../../../chrome/insertSearch';
import { KitItemView } from '../../../kit/KitItemView';
import { kitRegistry } from '../../../kit/registry';
import { DEVICE_SIZES, type ID } from '../../../model/types';
import { useEditor, useEditorCommand } from '../../EditorContext';
import { focusNode, insertPaletteItem } from './insert';
import { DRAG_MIME, PALETTE_ITEMS, paletteItem, type PaletteItem } from './paletteItems';

const PREVIEW_W = 44;
const PREVIEW_H = 32;

/** A tiny, static rendering of the real kit item / device frame, scaled to fit the row. */
export const PalettePreview = memo(function PalettePreview({ item }: { item: PaletteItem }) {
  const t = item.target;
  if (t.kind === 'screen') {
    // Device outlines at true aspect ratio (a scaled-down device frame would lose its strokes).
    const d = DEVICE_SIZES[t.device];
    const s = Math.min((PREVIEW_W - 4) / d.w, (PREVIEW_H - 2) / d.h);
    return (
      <span className="fs-palette-preview">
        <span className={`fs-palette-device fs-palette-device--${t.device}`} style={{ width: Math.round(d.w * s), height: Math.round(d.h * s) }} />
      </span>
    );
  }
  const def = kitRegistry.get(t.type);
  if (!def) return null;
  // Render at ≈2× the slot size (not the full default size) so strokes and text stay legible when scaled.
  const fit = Math.min((PREVIEW_W * 2) / def.defaultSize.w, (PREVIEW_H * 2) / def.defaultSize.h, 1);
  const w = Math.max(def.minSize.w, Math.round(def.defaultSize.w * fit));
  const h = Math.max(def.minSize.h, Math.round(def.defaultSize.h * fit));
  const scale = Math.min(PREVIEW_W / w, PREVIEW_H / h, 1);
  return (
    <span className="fs-palette-preview">
      <span className="fs-palette-preview__item" style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <KitItemView def={def} w={w} h={h} style="clean" seed={1} />
      </span>
    </span>
  );
});

const renderIcon = (item: InsertItem) => <PalettePreview item={item as PaletteItem} />;
const dragData = (item: InsertItem) => ({ [DRAG_MIME]: item.id, 'text/plain': item.label });

export function InsertPaletteSlot() {
  const api = useEditor();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [open, setOpen] = useState(false);
  const inserted = useRef<ID | undefined>(undefined);

  useEditorCommand('insert', () => {
    if (apiRef.current.readOnly) return;
    inserted.current = undefined;
    setOpen(true);
  });

  const onSelect = useCallback((item: InsertItem) => {
    const p = paletteItem(item.id);
    if (p) inserted.current = insertPaletteItem(apiRef.current, p);
  }, []);

  const onCloseAutoFocus = useCallback((e: Event) => {
    const id = inserted.current;
    if (!id) return;
    e.preventDefault();
    focusNode(id);
  }, []);

  return (
    <InsertPalette
      open={open}
      onOpenChange={setOpen}
      items={PALETTE_ITEMS}
      onSelect={onSelect}
      renderIcon={renderIcon}
      iconClassName="fs-palette-icon"
      modal={false}
      dragData={dragData}
      onCloseAutoFocus={onCloseAutoFocus}
      placeholder="Search components, shapes and screens…"
    />
  );
}
