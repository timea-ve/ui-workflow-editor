import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * The editor is a lazy chunk (src/App.tsx). For deep links (<base>b/…, <base>s/…) this injects a tiny inline
 * script that modulepreloads the page's chunks, so they download in parallel with the entry chunk
 * instead of after it. CSS is only preloaded (fetched, not applied) so the cascade order stays as Vite
 * sets it when the chunk loads. Build only; see docs/phase-4/performance.md.
 */
function deepLinkPreloadPlugin(): Plugin {
  let base = '/'
  return {
    name: 'fs-deep-link-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        const chunks = Object.values(bundle).filter((c) => c.type === 'chunk')
        const entry = chunks.find((c) => c.isEntry)
        const closure = (page: string) => {
          const start = chunks.find((c) => c.facadeModuleId?.endsWith(page))
          if (!start || !entry) return []
          const seen = new Set<string>()
          const skip = new Set([entry.fileName, ...entry.imports])
          const walk = (file: string) => {
            if (seen.has(file) || skip.has(file)) return
            seen.add(file)
            const c = bundle[file]
            if (c?.type === 'chunk') c.imports.forEach(walk)
          }
          walk(start.fileName)
          const css = [...seen].flatMap((f) => {
            const c = bundle[f]
            return c?.type === 'chunk' ? [...(c.viteMetadata?.importedCss ?? [])] : []
          })
          return [...seen, ...new Set(css)].map((f) => `${base}${f}`)
        }
        const routes = { [`${base}b/`]: closure('/src/pages/EditorPage.tsx'), [`${base}s/`]: closure('/src/pages/SharePage.tsx') }
        const script = `<script>(function(m,p){for(var k in m)if(p.indexOf(k)===0)m[k].forEach(function(h){var l=document.createElement('link'),c=/\\.css$/.test(h);l.rel=c?'preload':'modulepreload';if(c)l.as='style';l.crossOrigin='';l.href=h;document.head.appendChild(l)})})(${JSON.stringify(routes)},location.pathname)</script>`
        return html.replace('<script type="module"', `${script}\n    <script type="module"`)
      },
    },
  }
}

/**
 * GitHub Pages has no SPA rewrites: it serves 404.html for unknown paths. A copy of index.html there
 * makes deep links (/ui-workflow-editor/b/…, /ui-workflow-editor/s/v1#…) load the app. Harmless on other hosts.
 */
function spaFallbackPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'fs-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await copyFile(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // BASE_PATH: the sub-path the app is served from, e.g. '/ui-workflow-editor/' on GitHub Pages (see README).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), deepLinkPreloadPlugin(), spaFallbackPlugin()],
})
