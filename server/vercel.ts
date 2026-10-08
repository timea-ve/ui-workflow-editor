// Vercel Functions entry for the share API (not deployed yet — see docs/phase-3/export-share.md).
//
// To deploy: create `api/shares/[[...path]].ts` containing
//   export { GET, POST, PUT, DELETE } from '../../server/vercel';
// Vercel's Node runtime calls these Web-standard handlers (Request → Response).
//
// Storage: Vercel's filesystem is read-only and per-instance, so the file store can't be used
// there. Before going live, implement `ShareStore` on Supabase Postgres (one `shares` table:
// id text pk, title text, doc jsonb, token_hash text, created_at, updated_at, revoked_at).
// The in-memory store below only keeps shares for the lifetime of one warm instance (demo only).
import { createShareApi } from './shareApi.ts';
import { MemoryShareStore, type ShareStore } from './store.ts';

const store: ShareStore = new MemoryShareStore();
const app = createShareApi({ store });

const handler = (req: Request) => app.fetch(req);
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
export default app;
