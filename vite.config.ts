import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { shareApiPlugin } from './server/vitePlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  // shareApiPlugin: serves /api/shares (read-only share links) in dev and preview.
  plugins: [react(), shareApiPlugin()],
})
