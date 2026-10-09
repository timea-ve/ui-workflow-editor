// Share links carry the board itself: {title, doc} as JSON → deflate-raw → base64url, placed in the
// URL fragment (never sent to any server). Format: `<origin><base>s/v1#<data>`.
// Plain browser APIs only (no Vite env), so e2e fixtures can build links with it too.
import type { BoardDoc } from '../model/types.ts';
import { validateBoardDoc, validateTitle } from './validate.ts';

/** Path segment after `s/`; bump when the payload format changes. */
export const SHARE_VERSION = 'v1';
/** Decompressed payload cap — far above any real board; stops "zip bomb" links. */
export const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024;

export interface SharedBoard { title: string; doc: BoardDoc }

export class ShareLinkError extends Error {}

async function readAll(stream: ReadableStream<Uint8Array>, limit = Infinity): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ShareLinkError('payload too large');
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

function transform(bytes: Uint8Array, t: CompressionStream | DecompressionStream, limit?: number): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });
  return readAll(source.pipeThrough(t as unknown as ReadableWritablePair<Uint8Array, Uint8Array>), limit);
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new ShareLinkError('not base64url');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Any JSON value → link data: JSON → deflate-raw → base64url. Also used by flow links (src/platform/flowLink.ts). */
export async function compressJson(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  return toBase64Url(await transform(json, new CompressionStream('deflate-raw')));
}

/** Link data → parsed JSON. Throws ShareLinkError for anything incomplete, garbled or too large. */
export async function decompressJson(data: string): Promise<unknown> {
  if (!data) throw new ShareLinkError('empty');
  try {
    const bytes = await transform(fromBase64Url(data), new DecompressionStream('deflate-raw'), MAX_PAYLOAD_BYTES);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (e) {
    throw e instanceof ShareLinkError ? e : new ShareLinkError('garbled');
  }
}

/** Board → link data (the part after `#`). */
export function encodeShare(title: string, doc: BoardDoc): Promise<string> {
  return compressJson({ title, doc });
}

/** Link data → validated board. Throws ShareLinkError for anything incomplete or garbled. */
export async function decodeShare(data: string): Promise<SharedBoard> {
  const payload = await decompressJson(data);
  if (typeof payload !== 'object' || payload === null) throw new ShareLinkError('not an object');
  const p = payload as { title?: unknown; doc?: unknown };
  const title = validateTitle(p.title);
  const doc = validateBoardDoc(p.doc);
  if (!title.ok || !doc.ok) throw new ShareLinkError('invalid board');
  return { title: title.value, doc: doc.value };
}

/** Path (relative to the app base, no leading slash) + fragment for a link. */
export function sharePath(data: string): string {
  return `s/${SHARE_VERSION}#${data}`;
}
