// Flow links: a flow spec (src/platform/flowSpec.ts) compressed into the URL fragment, the same way
// share links carry boards. Opening `<base>new/v1#<data>` builds the flow as a NEW editable board in
// the visitor's browser (src/pages/NewFlowPage.tsx). The data never reaches a server.
// Pure module (no Vite env) so the `npm run flow` CLI can reuse it.
import { compressJson, decompressJson } from '../share/link.ts';
import { validateFlowSpec, type FlowSpecResult } from './flowSpec.ts';

/** Path segment after `new/`; bump when the payload format changes. */
export const FLOW_LINK_VERSION = 'v1';
export const LIVE_APP_URL = 'https://timea-ve.github.io/ui-workflow-editor/';
export const LOCAL_APP_URL = 'http://localhost:5173/';

/** Spec (parsed JSON, as written) → link data. */
export function encodeFlowSpec(spec: unknown): Promise<string> {
  return compressJson(spec);
}

/** Link data → validation result. Throws ShareLinkError when the data itself is cut off or garbled. */
export async function decodeFlowLink(data: string): Promise<FlowSpecResult> {
  return validateFlowSpec(await decompressJson(data));
}

/** Path relative to the app base (no leading slash) + fragment. */
export function flowLinkPath(data: string): string {
  return `new/${FLOW_LINK_VERSION}#${data}`;
}

/** Full link for an app served at `appUrl` (with or without a trailing slash). */
export function flowLinkUrl(appUrl: string, data: string): string {
  return `${appUrl.replace(/\/?$/, '/')}${flowLinkPath(data)}`;
}
