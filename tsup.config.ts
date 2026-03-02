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
        path.resolve(__dirname, 'src/client/styles.css'),
        'utf-8',
      )
      return { contents: `export default ${JSON.stringify(css)}`, loader: 'js' }
    })
  },
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
  // Client build (browser IIFE, injected by plugin)
  {
    entry: { client: 'src/client/index.tsx' },
    format: ['iife'],
    globalName: 'VibeAnnotator',
    sourcemap: false,
    minify: true,
    esbuildPlugins: [inlineCssPlugin],
    esbuildOptions(options) {
      options.jsx = 'automatic'
      options.jsxImportSource = 'preact'
    },
    noExternal: ['preact', 'html2canvas'],
  },
])
