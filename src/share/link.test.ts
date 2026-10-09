// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../flow/ops';
import { buildStressDoc } from '../editor/fixtures/stress';
import { decodeShare, encodeShare, fromBase64Url, MAX_PAYLOAD_BYTES, sharePath, ShareLinkError, toBase64Url } from './link';

async function deflate(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

describe('share links', () => {
  it('round-trips title and board, using only URL-safe characters', async () => {
    const doc = emptyDoc();
    doc.frames.a = { id: 'a', kind: 'frame', name: 'Hëllo ✓', device: 'mobile', x: 0, y: 0, w: 375, h: 812, z: 'a0' };
    const data = await encodeShare('Café board', doc);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sharePath(data)).toBe(`s/v1#${data}`);
    await expect(decodeShare(data)).resolves.toEqual({ title: 'Café board', doc });
  });

  it('base64url round-trips every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 * 3 + 1 }, (_, i) => i % 256);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it('fits a 60-screen board', async () => {
    const doc = buildStressDoc(60);
    const data = await encodeShare('Stress', doc);
    const back = await decodeShare(data);
    expect(Object.keys(back.doc.frames)).toHaveLength(Object.keys(doc.frames).length);
    expect(data.length).toBeLessThan(100_000);
  });

  it('rejects incomplete, garbled or invalid links', async () => {
    const data = await encodeShare('T', emptyDoc());
    for (const bad of ['', data.slice(0, Math.floor(data.length / 2)), 'not*base64', 'AAAA', await deflate('[1,2]'),
      await deflate('{"title":"x","doc":{"frames":{"a":{"id":"b"}}}}'), await deflate('not json')]) {
      await expect(decodeShare(bad)).rejects.toBeInstanceOf(ShareLinkError);
    }
  });

  it('refuses payloads that inflate past the cap', async () => {
    const huge = await deflate(`{"title":"${'a'.repeat(MAX_PAYLOAD_BYTES + 10)}"}`);
    await expect(decodeShare(huge)).rejects.toThrow('payload too large');
  });

  it('defaults a missing title and missing collections', async () => {
    const back = await decodeShare(await deflate('{"doc":{}}'));
    expect(back.title).toBe('Untitled board');
    expect(back.doc.frames).toEqual({});
  });
});
