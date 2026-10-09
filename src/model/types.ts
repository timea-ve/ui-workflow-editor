// FlowSketch data model. See docs/phase-1/tech-architecture.md §4.
// Flat maps keyed by id so each collection maps 1:1 onto a Y.Map later.

export type ID = string;
export type FIndex = string;

export type Device = 'desktop' | 'tablet' | 'mobile';

export const DEVICE_SIZES: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  tablet: { w: 768, h: 1024 },
  mobile: { w: 375, h: 812 },
};

export interface Board {
  id: ID;
  title: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  templateId?: string;
  thumbnailUrl?: string;
  ownerId?: ID;
  teamId?: ID;
  /** Set once the board has a public read-only link (see src/share). */
  shareId?: ID;
}

export interface Frame {
  id: ID;
  kind: 'frame';
  name: string;
  device: Device;
  x: number;
  y: number;
  w: number;
  h: number;
  z: FIndex;
  variantId?: ID;
  isStart?: boolean;
}

export type WireframeType =
  | 'header' | 'nav' | 'button' | 'input' | 'checkbox' | 'toggle' | 'dropdown' | 'card'
  | 'list' | 'table' | 'image' | 'text' | 'heading' | 'modal' | 'tabs' | 'icon'
  // Wave C, set A (text, actions, inputs)
  | 'caption' | 'link' | 'icon-button' | 'fab' | 'textarea' | 'search' | 'radio' | 'slider' | 'datepicker'
  // Wave C, set B (navigation, content, feedback)
  | 'sidebar' | 'menu' | 'breadcrumbs' | 'pagination' | 'video' | 'avatar' | 'calendar' | 'line-chart'
  | 'stacked-chart' | 'divider' | 'tooltip' | 'toast' | 'badge' | 'progress' | 'spinner';

export type DiagramType = 'rect' | 'diamond' | 'ellipse' | 'sticky' | 'label';

export type ElementType = WireframeType | DiagramType;

export interface Element {
  id: ID;
  type: ElementType;
  parentId?: ID;
  x: number;
  y: number;
  w: number;
  h: number;
  z: FIndex;
  props: Record<string, unknown>;
  variantId?: ID;
}

export type Anchor = 'top' | 'right' | 'bottom' | 'left' | 'auto';

export interface Endpoint {
  nodeId: ID;
  anchor?: Anchor;
}

export interface Connector {
  id: ID;
  from: Endpoint;
  to: Endpoint;
  label?: string;
  style: 'straight' | 'step' | 'curved';
  arrowheads: 'end' | 'both' | 'none';
  variantId?: ID;
}

export interface ScreenLink {
  id: ID;
  sourceElementId: ID;
  targetFrameId: ID;
  trigger: 'click';
  connectorId?: ID;
}

export interface VariantGroup {
  id: ID;
  flowId: ID;
  label: string;
  color?: string;
  duplicatedFromId?: ID;
  order: FIndex;
}

export interface BoardDoc {
  frames: Record<ID, Frame>;
  elements: Record<ID, Element>;
  connectors: Record<ID, Connector>;
  links: Record<ID, ScreenLink>;
  variants: Record<ID, VariantGroup>;
  /** User-given flow names, keyed by Flow id (the start screen's id). Missing → auto name. */
  flowNames: Record<ID, string>;
}
