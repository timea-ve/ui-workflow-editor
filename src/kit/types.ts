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
  kind: 'text' | 'multiline' | 'boolean' | 'select' | 'number';
  options?: string[];
}

export interface KitItemDef<P extends Record<string, unknown> = Record<string, unknown>> {
  type: ElementType;
  label: string;
  category: 'wireframe' | 'diagram';
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
  /** Screen-reader description, e.g. "Button 'Sign up'". */
  describe: (props: P) => string;
}
