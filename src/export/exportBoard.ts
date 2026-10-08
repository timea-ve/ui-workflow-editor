// Client-side export: render the doc offscreen → html-to-image → PNG (→ jsPDF → PDF).
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { BoardDoc, ID } from '../model/types';
import { StaticBoard } from './StaticBoard';
import {
  EXPORT_MARGIN, capPixelRatio, contentBounds, pdfPageSize, scopeDoc,
  type ExportBackground, type ExportFormat, type ExportScope,
} from './scope';

export interface ExportOptions {
  doc: BoardDoc;
  title: string;
  scope: ExportScope;
  selectionIds?: ID[];
  variantId?: ID;
  format: ExportFormat;
  background: ExportBackground;
}

export class ExportError extends Error {
  kind: 'empty' | 'render';
  constructor(kind: 'empty' | 'render', message: string) {
    super(message);
    this.kind = kind;
  }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

let fontCss: Promise<string | undefined> | undefined;

function surfaceColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--fs-surface').trim() || 'white';
}

export async function exportBoard(opts: ExportOptions): Promise<Blob> {
  const doc = scopeDoc(opts.doc, opts);
  const b = contentBounds(doc);
  if (!b) throw new ExportError('empty', 'There is nothing to export in this scope.');
  const width = Math.ceil(b.w + EXPORT_MARGIN * 2);
  const height = Math.ceil(b.h + EXPORT_MARGIN * 2);
  const background: ExportBackground = opts.format === 'pdf' ? 'white' : opts.background;

  const host = document.createElement('div');
  host.className = 'fs-export-host';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(createElement(StaticBoard, { doc, origin: { x: b.x - EXPORT_MARGIN, y: b.y - EXPORT_MARGIN }, width, height, background }));
    });
    if (document.fonts) await document.fonts.ready;
    await nextFrame();
    const node = host.firstElementChild as HTMLElement | null;
    if (!node) throw new ExportError('render', 'Could not prepare the export.');

    const { toCanvas, getFontEmbedCSS } = await import('html-to-image');
    fontCss ??= getFontEmbedCSS(node).catch(() => undefined);
    const fontEmbedCSS = await fontCss;
    const pixelRatio = capPixelRatio(width, height);
    const capture = {
      width, height, pixelRatio, skipAutoScale: true,
      backgroundColor: background === 'white' ? surfaceColor() : undefined,
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    };
    const canvas = await toCanvas(node, capture);

    if (opts.format === 'png') return await canvasToBlob(canvas);

    const { jsPDF } = await import('jspdf');
    const page = pdfPageSize(width, height);
    const pdf = new jsPDF({ orientation: page.orientation, unit: 'pt', format: [page.w, page.h], compress: true });
    pdf.setProperties({ title: opts.title, creator: 'FlowSketch' });
    pdf.addImage(canvas, 'PNG', 0, 0, page.w, page.h, undefined, 'FAST');
    return pdf.output('blob');
  } catch (e) {
    if (e instanceof ExportError) throw e;
    throw new ExportError('render', e instanceof Error ? e.message : 'Export failed');
  } finally {
    root.unmount();
    host.remove();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ExportError('render', 'The image was too large to create.'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
