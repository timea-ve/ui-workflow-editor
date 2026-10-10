// Contract shared by the Wireframe Kit and the Diagram Kit.
// Every kit item is a pure renderer: given props + size + visual style it draws itself
// inside a w×h box using design tokens (CSS variables) only — never hard-coded colours.

import type { ReactNode } from 'react';
import type { ElementType } from '../model/types';

export type VisualStyle = 'sketchy' | 'clean';

export interface KitRenderContext {
  w: number;
  h: number;
  style: VisualStyle;
  /** Stable seed so sketchy strokes don't "wobble" between renders. */
  seed: number;
  selected?: boolean;
}

export interface PropField {
  key: string;
  label: string;
  /**
   * - `items`: a comma-separated string edited as a list (add / rename / remove / reorder rows).
   * - `icon`: a name from `KIT_ICON_NAMES` (src/kit/icons.tsx), picked from a searchable grid.
   */
  kind: 'text' | 'multiline' | 'boolean' | 'select' | 'number' | 'items' | 'icon';
  options?: string[];
  /** For a `number` that is a 0-based index into another `items` prop: the bar shows a menu of those item names. */
  itemsFrom?: string;
  /** Where the context bar shows it: right on the bar, or inside its "More" popover. Default decided by the bar. */
  bar?: 'inline' | 'more';
}

/** Insert-palette section for wireframe components. */
export type KitGroup = 'text' | 'actions' | 'inputs' | 'navigation' | 'content' | 'feedback';

/** A tappable part of a component (row, tab, link…) in the component's own coordinates. */
export interface KitItemRect { label: string; x: number; y: number; w: number; h: number }

export interface KitItemDef<P extends Record<string, unknown> = Record<string, unknown>> {
  type: ElementType;
  label: string;
  category: 'wireframe' | 'diagram';
  /** Palette section (wireframe components only). */
  group?: KitGroup;
  /** Search keywords for the "/" insert palette. */
  keywords: string[];
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  /** Resize behaviour: which axes the item may grow on. */
  resize: 'both' | 'horizontal' | 'vertical' | 'none';
  defaultProps: P;
  /** Which prop holds the main editable text (edited inline on double-click / Enter). */
  textProp?: keyof P & string;
  editableProps: PropField[];
  /** Can this item be the source of a prototype link (element → screen)? */
  linkable: boolean;
  render: (props: P, ctx: KitRenderContext) => ReactNode;
  /** Where each visible tappable part sits (rows, tabs, links…), matching `render`. Flows use it to highlight what is tapped. */
  itemRects?: (props: P, size: { w: number; h: number }) => KitItemRect[];
  /** Screen-reader description, e.g. "Button 'Sign up'". */
  describe: (props: P) => string;
}
