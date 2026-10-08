// Fixture board for share/export e2e: Home --(Continue button)--> Details, plus a connector label.
import type { APIRequestContext } from '@playwright/test';

export const fixtureDoc = {
  frames: {
    home: { id: 'home', kind: 'frame', name: 'Home', device: 'mobile', x: 0, y: 0, w: 375, h: 812, z: 'a0', isStart: true },
    details: { id: 'details', kind: 'frame', name: 'Details', device: 'mobile', x: 600, y: 0, w: 375, h: 812, z: 'a1' },
  },
  elements: {
    title: { id: 'title', type: 'heading', parentId: 'home', x: 24, y: 80, w: 300, h: 40, z: 'a2', props: { text: 'Welcome' } },
    cta: { id: 'cta', type: 'button', parentId: 'home', x: 24, y: 700, w: 200, h: 44, z: 'a3', props: { label: 'Continue' } },
    back: { id: 'back', type: 'text', parentId: 'details', x: 24, y: 80, w: 300, h: 40, z: 'a4', props: { text: 'All the details' } },
  },
  connectors: {
    c1: { id: 'c1', from: { nodeId: 'cta', anchor: 'auto' }, to: { nodeId: 'details', anchor: 'auto' }, style: 'step', arrowheads: 'end', label: 'tap' },
  },
  links: { l1: { id: 'l1', sourceElementId: 'cta', targetFrameId: 'details', trigger: 'click', connectorId: 'c1' } },
  variants: {},
  flowNames: {},
};

export async function publishFixture(request: APIRequestContext, doc: unknown = fixtureDoc, title = 'Checkout e2e') {
  const res = await request.post('/api/shares', { data: { title, doc } });
  if (res.status() !== 201) throw new Error(`publish failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; editToken: string };
}
