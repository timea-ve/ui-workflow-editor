// Mounts the share API inside `vite` (dev) and `vite preview`, so `npm run dev` stays one command.
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import type { Connect, Plugin } from 'vite';
import { createShareApi } from './shareApi.ts';
import { FileShareStore } from './store.ts';

export function shareApiPlugin(opts: { dataDir?: string } = {}): Plugin {
  const mount = (server: { middlewares: Connect.Server; config: { root: string } }) => {
    const dir = opts.dataDir ?? path.resolve(server.config.root, '.data/shares');
    const app = createShareApi({ store: new FileShareStore(dir) });
    const listener = getRequestListener(app.fetch);
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/shares' || req.url?.startsWith('/api/shares/') || req.url?.startsWith('/api/shares?')) {
        void listener(req, res);
        return;
      }
      next();
    });
  };
  return {
    name: 'flowsketch-share-api',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
