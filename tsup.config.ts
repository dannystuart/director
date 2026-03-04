import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'
import type { Plugin } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const inlineCssPlugin: Plugin = {
  name: 'inline-css',
  setup(build) {
    build.onResolve({ filter: /^virtual:inline-css$/ }, () => ({
      path: 'virtual:inline-css',
      namespace: 'inline-css',
    }))
    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, () => {
      const css = fs.readFileSync(
        path.resolve(__dirname, 'src/core/styles.css'),
        'utf-8',
      )
      return { contents: `export default ${JSON.stringify(css)}`, loader: 'js' }
    })
  },
}

const browserOptions = {
  esbuildPlugins: [inlineCssPlugin],
  esbuildOptions(options: any) {
    options.jsx = 'automatic'
    options.jsxImportSource = 'preact'
  },
  noExternal: ['preact', 'html2canvas'],
}

export default defineConfig([
  // Plugin build (Node.js, consumed via vite.config.js)
  {
    entry: { index: 'src/plugin/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['vite'],
  },
  // Client build (browser IIFE, injected by Vite plugin)
  {
    entry: { client: 'src/adapters/vite/client.tsx' },
    format: ['iife'],
    globalName: 'VibeAnnotator',
    sourcemap: false,
    minify: true,
    ...browserOptions,
  },
  // Bookmarklet build (browser IIFE, standalone)
  {
    entry: { bookmarklet: 'src/adapters/bookmarklet/index.tsx' },
    format: ['iife'],
    globalName: 'VibeAnnotatorBookmarklet',
    sourcemap: false,
    minify: true,
    ...browserOptions,
  },
])
