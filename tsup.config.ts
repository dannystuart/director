import { defineConfig } from 'tsup'

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
    esbuildOptions(options) {
      options.jsx = 'automatic'
      options.jsxImportSource = 'preact'
    },
    noExternal: ['preact', 'html2canvas'],
  },
])
