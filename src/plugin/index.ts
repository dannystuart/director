import type { Plugin, ViteDevServer } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Storage } from './storage'
import { createAnnotationMiddleware } from './middleware'
import type { PluginOptions } from '../shared/types'

/**
 * Resolve the directory of the current module at runtime.
 *
 * tsup produces both ESM (dist/index.js) and CJS (dist/index.cjs).
 * - In ESM, `import.meta.url` is available and `__dirname` is not.
 * - In CJS, `__dirname` is available and `import.meta.url` may not resolve correctly.
 *
 * We try `import.meta.url` first and fall back to `__dirname` for CJS.
 */
function getDistDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url))
  } catch {
    // CJS fallback — __dirname is defined at runtime in CommonJS
    return __dirname
  }
}

export function annotateUI(options: PluginOptions = {}): Plugin {
  const {
    storagePath = '.ui-annotations',
    position = 'bottom-right',
    screenshotPadding = 200,
  } = options

  let storage: Storage

  return {
    name: 'vibe-annotator',
    apply: 'serve',

    configResolved(config) {
      const fullPath = path.resolve(config.root, storagePath)
      storage = new Storage(fullPath)
    },

    configureServer(server: ViteDevServer) {
      // Storage.init() is async — fire-and-forget is acceptable here
      // because the first API request won't arrive before the dir is created.
      storage.init()
      const middleware = createAnnotationMiddleware(storage)
      server.middlewares.use(middleware as any)
    },

    transformIndexHtml() {
      const distDir = getDistDir()
      const clientPath = path.resolve(distDir, 'client.global.js')

      let clientCode = ''
      try {
        clientCode = fs.readFileSync(clientPath, 'utf-8')
      } catch {
        console.warn(
          '[vibe-annotator] Client bundle not found at ' +
            clientPath +
            '. Run `pnpm build` first.',
        )
        return []
      }

      return [
        {
          tag: 'script',
          attrs: {
            'data-vibe-annotator-config': JSON.stringify({
              position,
              screenshotPadding,
            }),
          },
          children: clientCode,
          injectTo: 'body' as const,
        },
      ]
    },
  }
}

export type { PluginOptions } from '../shared/types'
