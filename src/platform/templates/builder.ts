// Tiny imperative wrapper around the pure ops in src/flow/ops.ts so templates read top-to-bottom.
// Every mutation still goes through an op; the builder only threads `doc` along.
import { DEVICE_SIZES, type BoardDoc, type Device, type ElementType, type ID } from '../../model/types';
import {
  SCREEN_GAP, addConnector, addElement, createScreen, emptyDoc, linkElementToScreen,
  type ConnectorInput,
} from '../../flow/ops';

/** Mobile layout: 24px side margins inside a 375×812 frame, content below the 44px status bar. */
export const M = { x: 24, w: 327, top: 44, footer: 812 - 24 - 48 - 24 } as const;

export class TemplateBuilder {
  doc: BoardDoc = emptyDoc();
  readonly device: Device;
  private readonly step: number;

  constructor(device: Device) {
    this.device = device;
    this.step = DEVICE_SIZES[device].w + SCREEN_GAP;
  }

  /** Screen in column `col` (left→right); `row` > 0 places side paths below the main row. */
  screen(name: string, col: number, opts: { row?: number; isStart?: boolean } = {}): ID {
    const rowStep = DEVICE_SIZES[this.device].h + 200;
    const r = createScreen(this.doc, {
      device: this.device, name, x: col * this.step, y: (opts.row ?? 0) * rowStep, isStart: opts.isStart,
    });
    this.doc = r.doc;
    return r.id;
  }

  /** Element inside a screen; coordinates are relative to the frame's top-left. */
  el(frame: ID, type: ElementType, x: number, y: number, w?: number, h?: number, props: Record<string, unknown> = {}): ID {
    const r = addElement(this.doc, { type, parentId: frame, x, y, w, h, props });
    this.doc = r.doc;
    return r.id;
  }

  /** Free-floating canvas element (diagram shapes, notes); board coordinates. */
  shape(type: ElementType, x: number, y: number, w?: number, h?: number, props: Record<string, unknown> = {}): ID {
    const r = addElement(this.doc, { type, x, y, w, h, props });
    this.doc = r.doc;
    return r.id;
  }

  link(elementId: ID, frame: ID, opts?: ConnectorInput) {
    this.doc = linkElementToScreen(this.doc, elementId, frame, opts).doc;
  }

  connect(from: ID, to: ID, opts?: ConnectorInput) {
    this.doc = addConnector(this.doc, from, to, opts).doc;
  }

  /** Board x of a column's left edge. */
  colX(col: number) {
    return col * this.step;
  }
}
