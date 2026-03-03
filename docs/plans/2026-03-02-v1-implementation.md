# Vibe Annotator V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Vite plugin that lets users click elements in the browser, describe what's wrong, and export structured feedback as markdown.

**Architecture:** Preact IIFE injected by a Vite plugin via `transformIndexHtml`. REST middleware serves annotations CRUD at `/__annotations/api/`. All data persisted to `.ui-annotations/` on disk. State managed via `useReducer` + Preact context.

**Tech Stack:** Preact, tsup (dual build: ESM plugin + IIFE client), TypeScript strict, html2canvas (lazy-loaded), vitest for tests.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `.gitignore`

**Step 1: Initialize package.json**

```json
{
  "name": "vibe-annotator",
  "version": "0.1.0",
  "description": "Click elements, describe what's wrong, export structured feedback for AI agents",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "vite": ">=5.0.0"
  },
  "devDependencies": {
    "preact": "^10.25.0",
    "html2canvas": "^1.4.1",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  },
  "dependencies": {}
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "paths": {
      "react": ["./node_modules/preact/compat"],
      "react-dom": ["./node_modules/preact/compat"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create tsup.config.ts**

Two build entries — the plugin (ESM/CJS for Node) and the client (IIFE for browser injection).

```ts
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
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.ui-annotations/
.DS_Store
*.tsbuildinfo
```

**Step 5: Install dependencies**

Run: `cd /Users/Danny/CodeProjects/vibe-annotator && pnpm install`
Expected: lockfile created, node_modules populated.

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsup.config.ts .gitignore
git commit -m "feat: scaffold project with tsup dual build config"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/shared/types.ts`

**Step 1: Write all shared type definitions**

These types are used by both plugin (Node) and client (browser). Keep them serializable (no DOM types).

```ts
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ComputedStyles {
  fontSize?: string
  fontWeight?: string
  fontFamily?: string
  color?: string
  backgroundColor?: string
  lineHeight?: string
  letterSpacing?: string
  padding?: string
  margin?: string
  borderRadius?: string
  border?: string
  width?: string
  height?: string
  display?: string
  flexDirection?: string
  alignItems?: string
  justifyContent?: string
  gap?: string
  opacity?: string
  boxShadow?: string
  textAlign?: string
  textTransform?: string
}

export type Priority = 'high' | 'medium' | 'low'

export type QuickAction = 'color' | 'spacing' | 'font' | 'align' | 'reference' | 'comment'

export interface ElementData {
  selector: string
  xpath: string
  tag: string
  textContent: string
  boundingBox: BoundingBox
}

export interface Annotation {
  id: string
  number: number
  timestamp: string
  priority: Priority
  element: ElementData
  computedStyles: ComputedStyles
  targetStyles: Partial<ComputedStyles>
  comment: string
  quickActions: QuickAction[]
  quickActionIntents: string[]
  screenshot: string | null
  referenceImage: string | null
}

export interface PageInfo {
  url: string
  viewport: { width: number; height: number }
  userAgent: string
  capturedAt: string
}

export interface AnnotationsFile {
  annotations: Annotation[]
  settings: {
    visionMode: boolean
  }
  page: PageInfo
}

export interface PluginOptions {
  storagePath?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  screenshotPadding?: number
}
```

**Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 3: Storage Layer + Tests

**Files:**
- Create: `src/plugin/storage.ts`
- Create: `src/plugin/__tests__/storage.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Storage } from '../storage'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('Storage', () => {
  let tmpDir: string
  let storage: Storage

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'va-test-'))
    storage = new Storage(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates storage directory on init', async () => {
    await storage.init()
    expect(fs.existsSync(tmpDir)).toBe(true)
  })

  it('returns empty annotations when file does not exist', async () => {
    await storage.init()
    const data = await storage.loadAnnotations()
    expect(data.annotations).toEqual([])
  })

  it('saves and loads an annotation', async () => {
    await storage.init()
    const annotation = {
      id: 'ann_1',
      number: 1,
      timestamp: '2026-01-01T00:00:00Z',
      priority: 'high' as const,
      element: {
        selector: 'h1',
        xpath: '/html/body/h1',
        tag: 'h1',
        textContent: 'Hello',
        boundingBox: { x: 0, y: 0, width: 100, height: 40 },
      },
      computedStyles: { fontSize: '16px' },
      targetStyles: { fontSize: '24px' },
      comment: 'Make bigger',
      quickActions: ['font' as const],
      quickActionIntents: ['wrong font size'],
      screenshot: null,
      referenceImage: null,
    }
    await storage.saveAnnotation(annotation)
    const data = await storage.loadAnnotations()
    expect(data.annotations).toHaveLength(1)
    expect(data.annotations[0].id).toBe('ann_1')
  })

  it('updates an existing annotation', async () => {
    await storage.init()
    const ann = {
      id: 'ann_1', number: 1, timestamp: '2026-01-01T00:00:00Z',
      priority: 'high' as const,
      element: { selector: 'h1', xpath: '/h1', tag: 'h1', textContent: 'Hi', boundingBox: { x: 0, y: 0, width: 100, height: 40 } },
      computedStyles: {}, targetStyles: {}, comment: 'v1',
      quickActions: [], quickActionIntents: [], screenshot: null, referenceImage: null,
    }
    await storage.saveAnnotation(ann)
    await storage.saveAnnotation({ ...ann, comment: 'v2' })
    const data = await storage.loadAnnotations()
    expect(data.annotations).toHaveLength(1)
    expect(data.annotations[0].comment).toBe('v2')
  })

  it('deletes an annotation', async () => {
    await storage.init()
    const ann = {
      id: 'ann_1', number: 1, timestamp: '2026-01-01T00:00:00Z',
      priority: 'medium' as const,
      element: { selector: 'p', xpath: '/p', tag: 'p', textContent: '', boundingBox: { x: 0, y: 0, width: 0, height: 0 } },
      computedStyles: {}, targetStyles: {}, comment: '',
      quickActions: [], quickActionIntents: [], screenshot: null, referenceImage: null,
    }
    await storage.saveAnnotation(ann)
    await storage.deleteAnnotation('ann_1')
    const data = await storage.loadAnnotations()
    expect(data.annotations).toHaveLength(0)
  })

  it('saves and serves an image', async () => {
    await storage.init()
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    const filename = await storage.saveImage(base64, 'screenshot')
    expect(filename).toMatch(/^screenshot_\d+\.png$/)
    const buffer = await storage.getImage(filename)
    expect(buffer).toBeInstanceOf(Buffer)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/Danny/CodeProjects/vibe-annotator && pnpm test -- src/plugin/__tests__/storage.test.ts`
Expected: FAIL — module `../storage` not found.

**Step 3: Implement Storage class**

```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Annotation, AnnotationsFile } from '../shared/types'

export class Storage {
  private dir: string

  constructor(storagePath: string) {
    this.dir = storagePath
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
  }

  private get filePath(): string {
    return path.join(this.dir, 'annotations.json')
  }

  async loadAnnotations(): Promise<AnnotationsFile> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return {
        annotations: [],
        settings: { visionMode: true },
        page: {
          url: '',
          viewport: { width: 0, height: 0 },
          userAgent: '',
          capturedAt: '',
        },
      }
    }
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    const data = await this.loadAnnotations()
    const idx = data.annotations.findIndex((a) => a.id === annotation.id)
    if (idx >= 0) {
      data.annotations[idx] = annotation
    } else {
      data.annotations.push(annotation)
    }
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2))
  }

  async deleteAnnotation(id: string): Promise<void> {
    const data = await this.loadAnnotations()
    data.annotations = data.annotations.filter((a) => a.id !== id)
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2))
  }

  async saveImage(base64: string, prefix: 'screenshot' | 'reference'): Promise<string> {
    const files = await fs.readdir(this.dir).catch(() => [])
    const existing = files.filter((f) => f.startsWith(prefix)).length
    const filename = `${prefix}_${String(existing + 1).padStart(3, '0')}.png`
    const buffer = Buffer.from(base64, 'base64')
    await fs.writeFile(path.join(this.dir, filename), buffer)
    return filename
  }

  async getImage(filename: string): Promise<Buffer> {
    return fs.readFile(path.join(this.dir, filename))
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/Danny/CodeProjects/vibe-annotator && pnpm test -- src/plugin/__tests__/storage.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/plugin/storage.ts src/plugin/__tests__/storage.test.ts
git commit -m "feat: add storage layer with file I/O for annotations"
```

---

### Task 4: REST Middleware

**Files:**
- Create: `src/plugin/middleware.ts`
- Create: `src/plugin/__tests__/middleware.test.ts`

**Step 1: Write failing tests**

Test the middleware functions directly by mocking Vite's `Connect.Server` interface — create simple request/response objects.

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createAnnotationMiddleware } from '../middleware'
import { Storage } from '../storage'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'

function createMockReq(method: string, url: string, body?: unknown): IncomingMessage {
  const { Readable } = require('node:stream')
  const req = new Readable({
    read() {
      if (body) {
        this.push(JSON.stringify(body))
      }
      this.push(null)
    },
  }) as IncomingMessage
  req.method = method
  req.url = url
  req.headers = { 'content-type': 'application/json' }
  return req
}

function createMockRes(): ServerResponse & { _status: number; _body: string } {
  const res = {
    _status: 200,
    _body: '',
    _headers: {} as Record<string, string>,
    statusCode: 200,
    setHeader(name: string, value: string) { this._headers[name.toLowerCase()] = value },
    end(body?: string) { this._body = body ?? '' },
    writeHead(status: number) { this._status = status; this.statusCode = status },
  }
  return res as any
}

describe('Annotation Middleware', () => {
  let tmpDir: string
  let storage: Storage
  let middleware: ReturnType<typeof createAnnotationMiddleware>

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'va-mw-'))
    storage = new Storage(tmpDir)
    await storage.init()
    middleware = createAnnotationMiddleware(storage)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/annotations returns empty list', async () => {
    const req = createMockReq('GET', '/__annotations/api/annotations')
    const res = createMockRes()
    await middleware(req, res, () => {})
    expect(JSON.parse(res._body).annotations).toEqual([])
  })

  it('POST /api/annotations saves and returns annotation', async () => {
    const ann = {
      id: 'ann_1', number: 1, timestamp: '2026-01-01T00:00:00Z',
      priority: 'high', element: { selector: 'h1', xpath: '/h1', tag: 'h1', textContent: '', boundingBox: { x: 0, y: 0, width: 0, height: 0 } },
      computedStyles: {}, targetStyles: {}, comment: 'test',
      quickActions: [], quickActionIntents: [], screenshot: null, referenceImage: null,
    }
    const req = createMockReq('POST', '/__annotations/api/annotations', ann)
    const res = createMockRes()
    await middleware(req, res, () => {})
    expect(JSON.parse(res._body).id).toBe('ann_1')
  })

  it('DELETE /api/annotations/:id removes annotation', async () => {
    const ann = {
      id: 'ann_1', number: 1, timestamp: '2026-01-01T00:00:00Z',
      priority: 'high', element: { selector: 'h1', xpath: '/h1', tag: 'h1', textContent: '', boundingBox: { x: 0, y: 0, width: 0, height: 0 } },
      computedStyles: {}, targetStyles: {}, comment: '',
      quickActions: [], quickActionIntents: [], screenshot: null, referenceImage: null,
    }
    await storage.saveAnnotation(ann as any)

    const req = createMockReq('DELETE', '/__annotations/api/annotations/ann_1')
    const res = createMockRes()
    await middleware(req, res, () => {})
    expect(res.statusCode).toBe(200)

    const data = await storage.loadAnnotations()
    expect(data.annotations).toHaveLength(0)
  })

  it('POST /api/screenshot saves image and returns filename', async () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    const req = createMockReq('POST', '/__annotations/api/screenshot', { image: base64 })
    const res = createMockRes()
    await middleware(req, res, () => {})
    expect(JSON.parse(res._body).filename).toMatch(/^screenshot_\d+\.png$/)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/plugin/__tests__/middleware.test.ts`
Expected: FAIL — cannot find module `../middleware`.

**Step 3: Implement middleware**

```ts
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Storage } from './storage'
import type { Annotation } from '../shared/types'

const API_PREFIX = '/__annotations/api'

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status)
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(data))
}

export function createAnnotationMiddleware(storage: Storage) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = req.url ?? ''
    if (!url.startsWith(API_PREFIX)) return next()

    const route = url.slice(API_PREFIX.length)
    const method = req.method ?? 'GET'

    try {
      // GET /api/annotations
      if (route === '/annotations' && method === 'GET') {
        const data = await storage.loadAnnotations()
        return json(res, data)
      }

      // POST /api/annotations
      if (route === '/annotations' && method === 'POST') {
        const body = (await parseBody(req)) as Annotation
        await storage.saveAnnotation(body)
        return json(res, body)
      }

      // DELETE /api/annotations/:id
      if (route.startsWith('/annotations/') && method === 'DELETE') {
        const id = route.slice('/annotations/'.length)
        await storage.deleteAnnotation(id)
        return json(res, { ok: true })
      }

      // POST /api/screenshot
      if (route === '/screenshot' && method === 'POST') {
        const { image } = (await parseBody(req)) as { image: string }
        const filename = await storage.saveImage(image, 'screenshot')
        return json(res, { filename })
      }

      // POST /api/reference
      if (route === '/reference' && method === 'POST') {
        const { image } = (await parseBody(req)) as { image: string }
        const filename = await storage.saveImage(image, 'reference')
        return json(res, { filename })
      }

      // GET /api/images/:filename
      if (route.startsWith('/images/') && method === 'GET') {
        const filename = route.slice('/images/'.length)
        const buffer = await storage.getImage(filename)
        res.writeHead(200)
        res.setHeader('content-type', 'image/png')
        res.end(buffer)
        return
      }

      next()
    } catch (err) {
      json(res, { error: String(err) }, 500)
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/plugin/__tests__/middleware.test.ts`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/plugin/middleware.ts src/plugin/__tests__/middleware.test.ts
git commit -m "feat: add REST middleware for annotations API"
```

---

### Task 5: Vite Plugin Entry

**Files:**
- Create: `src/plugin/index.ts`

**Step 1: Implement the Vite plugin**

```ts
import type { Plugin, ViteDevServer } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { Storage } from './storage'
import { createAnnotationMiddleware } from './middleware'
import type { PluginOptions } from '../shared/types'

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
      storage.init()
      const middleware = createAnnotationMiddleware(storage)
      server.middlewares.use(middleware as any)
    },

    transformIndexHtml() {
      // Read the pre-built client IIFE
      const clientPath = path.resolve(__dirname, 'client.iife.js')
      let clientCode = ''
      try {
        clientCode = fs.readFileSync(clientPath, 'utf-8')
      } catch {
        console.warn('[vibe-annotator] Client bundle not found. Run `pnpm build` first.')
        return []
      }

      return [
        {
          tag: 'script',
          attrs: {
            'data-vibe-annotator-config': JSON.stringify({ position, screenshotPadding }),
          },
          children: clientCode,
          injectTo: 'body',
        },
      ]
    },
  }
}

export type { PluginOptions } from '../shared/types'
```

**Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Produces `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`. Client IIFE will fail until client code exists (that's OK — the plugin gracefully warns).

**Step 3: Commit**

```bash
git add src/plugin/index.ts
git commit -m "feat: add Vite plugin entry with HTML injection and server config"
```

---

### Task 6: Client Entry, App Shell & Styles

**Files:**
- Create: `src/client/index.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/context.ts`
- Create: `src/client/styles.css`
- Create: `src/client/components/FloatingIcon.tsx`

**Step 1: Create the Preact context and state model**

`src/client/context.ts`:

```ts
import { createContext } from 'preact'
import type { Annotation } from '../shared/types'

export type Mode = 'inactive' | 'selecting' | 'annotating'

export interface AppState {
  mode: Mode
  annotations: Annotation[]
  activeAnnotation: string | null
  visionMode: boolean
  hoveredElement: HTMLElement | null
}

export type AppAction =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_ANNOTATIONS'; annotations: Annotation[] }
  | { type: 'SET_ACTIVE'; id: string | null }
  | { type: 'SET_VISION_MODE'; enabled: boolean }
  | { type: 'SET_HOVERED'; element: HTMLElement | null }
  | { type: 'ADD_ANNOTATION'; annotation: Annotation }
  | { type: 'UPDATE_ANNOTATION'; annotation: Annotation }
  | { type: 'REMOVE_ANNOTATION'; id: string }

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode, hoveredElement: null }
    case 'SET_ANNOTATIONS':
      return { ...state, annotations: action.annotations }
    case 'SET_ACTIVE':
      return { ...state, activeAnnotation: action.id }
    case 'SET_VISION_MODE':
      return { ...state, visionMode: action.enabled }
    case 'SET_HOVERED':
      return { ...state, hoveredElement: action.element }
    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.annotation] }
    case 'UPDATE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.annotation.id ? action.annotation : a
        ),
      }
    case 'REMOVE_ANNOTATION':
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
        activeAnnotation: state.activeAnnotation === action.id ? null : state.activeAnnotation,
      }
    default:
      return state
  }
}

export const initialState: AppState = {
  mode: 'inactive',
  annotations: [],
  activeAnnotation: null,
  visionMode: true,
  hoveredElement: null,
}

export const AppContext = createContext<{
  state: AppState
  dispatch: (action: AppAction) => void
}>({ state: initialState, dispatch: () => {} })
```

**Step 2: Create FloatingIcon component**

`src/client/components/FloatingIcon.tsx`:

```tsx
import { useContext } from 'preact/hooks'
import { AppContext } from '../context'

export function FloatingIcon() {
  const { state, dispatch } = useContext(AppContext)

  const positions: Record<string, { bottom?: string; top?: string; left?: string; right?: string }> = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
  }

  const config = (() => {
    try {
      const el = document.querySelector('[data-vibe-annotator-config]')
      return el ? JSON.parse(el.getAttribute('data-vibe-annotator-config') ?? '{}') : {}
    } catch { return {} }
  })()

  const pos = positions[config.position ?? 'bottom-right'] ?? positions['bottom-right']
  const isActive = state.mode !== 'inactive'

  const toggle = () => {
    if (state.mode === 'inactive') {
      dispatch({ type: 'SET_MODE', mode: 'selecting' })
    } else {
      dispatch({ type: 'SET_MODE', mode: 'inactive' })
      dispatch({ type: 'SET_ACTIVE', id: null })
    }
  }

  return (
    <button
      class={`va-floating-icon ${isActive ? 'va-floating-icon--active' : ''}`}
      style={pos}
      onClick={toggle}
      title={isActive ? 'Deactivate annotator' : 'Activate annotator'}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" />
        <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="1.5" />
        <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.5" />
        <line x1="6" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>
  )
}
```

**Step 3: Create App root component**

`src/client/App.tsx`:

```tsx
import { useReducer, useEffect } from 'preact/hooks'
import { AppContext, appReducer, initialState } from './context'
import { FloatingIcon } from './components/FloatingIcon'
import { ElementSelector } from './components/ElementSelector'
import { AnnotationCard } from './components/AnnotationCard'
import { PinMarker } from './components/PinMarker'
import { ControlPanel } from './components/ControlPanel'
import { fetchAnnotations } from './utils/api'

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    fetchAnnotations().then((data) => {
      dispatch({ type: 'SET_ANNOTATIONS', annotations: data.annotations })
      dispatch({ type: 'SET_VISION_MODE', enabled: data.settings.visionMode })
    })
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <FloatingIcon />
      {state.mode === 'selecting' && <ElementSelector />}
      {state.mode === 'selecting' && <ControlPanel />}
      {state.mode === 'annotating' && state.activeAnnotation && <AnnotationCard />}
      {state.mode !== 'inactive' &&
        state.annotations.map((ann) => <PinMarker key={ann.id} annotation={ann} />)}
    </AppContext.Provider>
  )
}
```

Note: `ElementSelector`, `AnnotationCard`, `PinMarker`, and `ControlPanel` will be created in subsequent tasks. For now, create minimal placeholder files so the build doesn't break.

**Step 4: Create placeholder components**

Create these minimal stubs so the import chain works. They'll be fully implemented in later tasks.

`src/client/components/ElementSelector.tsx`:
```tsx
export function ElementSelector() {
  return null
}
```

`src/client/components/AnnotationCard.tsx`:
```tsx
export function AnnotationCard() {
  return null
}
```

`src/client/components/PinMarker.tsx`:
```tsx
import type { Annotation } from '../../shared/types'
export function PinMarker(_props: { annotation: Annotation }) {
  return null
}
```

`src/client/components/ControlPanel.tsx`:
```tsx
export function ControlPanel() {
  return null
}
```

**Step 5: Create API util stub**

`src/client/utils/api.ts`:
```ts
import type { Annotation, AnnotationsFile } from '../../shared/types'

const API = '/__annotations/api'

export async function fetchAnnotations(): Promise<AnnotationsFile> {
  const res = await fetch(`${API}/annotations`)
  return res.json()
}

export async function saveAnnotation(annotation: Annotation): Promise<Annotation> {
  const res = await fetch(`${API}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annotation),
  })
  return res.json()
}

export async function deleteAnnotation(id: string): Promise<void> {
  await fetch(`${API}/annotations/${id}`, { method: 'DELETE' })
}

export async function saveScreenshot(base64: string): Promise<string> {
  const res = await fetch(`${API}/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  })
  const data = await res.json()
  return data.filename
}

export async function saveReferenceImage(base64: string): Promise<string> {
  const res = await fetch(`${API}/reference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  })
  const data = await res.json()
  return data.filename
}

export function imageUrl(filename: string): string {
  return `${API}/images/${filename}`
}
```

**Step 6: Create client entry point**

`src/client/index.tsx`:
```tsx
import { render } from 'preact'
import { App } from './App'

function mount() {
  const container = document.createElement('div')
  container.setAttribute('data-vibe-annotator', '')
  document.body.appendChild(container)

  // Inject styles
  const style = document.createElement('style')
  style.textContent = CSS_CONTENT
  container.appendChild(style)

  render(<App />, container)
}

// CSS will be inlined during build — for now, placeholder
declare const CSS_CONTENT: string

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
```

**Step 7: Create base styles.css**

`src/client/styles.css` — terminal/pixel aesthetic:

```css
/* Vibe Annotator — Terminal Aesthetic */

/* === Reset within container === */
[data-vibe-annotator] *,
[data-vibe-annotator] *::before,
[data-vibe-annotator] *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

[data-vibe-annotator] {
  font-family: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #e0e0e0;
  -webkit-font-smoothing: antialiased;
}

/* === Floating Icon === */
.va-floating-icon {
  position: fixed;
  z-index: 2147483647;
  width: 40px;
  height: 40px;
  background: #0a0a0a;
  border: 1px solid #333;
  color: #e0e0e0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
  padding: 0;
  border-radius: 0;
}

.va-floating-icon:hover {
  border-color: #e0e0e0;
}

.va-floating-icon--active {
  border-color: #00ff41;
  color: #00ff41;
}

/* === Element Highlight === */
.va-highlight {
  position: fixed;
  z-index: 2147483640;
  pointer-events: none;
  border: 2px dashed #00ff41;
  background: rgba(0, 255, 65, 0.05);
  animation: va-march 0.5s linear infinite;
}

@keyframes va-march {
  to { stroke-dashoffset: -8; }
}

.va-highlight-tooltip {
  position: fixed;
  z-index: 2147483641;
  background: #0a0a0a;
  border: 1px solid #333;
  color: #e0e0e0;
  padding: 2px 6px;
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === Annotation Card === */
.va-card {
  position: fixed;
  z-index: 2147483645;
  width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  background: #0a0a0a;
  border: 1px solid #333;
  color: #e0e0e0;
}

.va-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #333;
  font-weight: 700;
}

.va-card-close {
  background: none;
  border: none;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.va-card-close:hover {
  color: #ff4444;
}

/* === Quick Actions === */
.va-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid #333;
}

.va-quick-action {
  background: none;
  border: 1px solid #333;
  color: #888;
  padding: 2px 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.va-quick-action:hover {
  border-color: #e0e0e0;
  color: #e0e0e0;
}

.va-quick-action--active {
  border-color: #00ff41;
  color: #00ff41;
}

/* === Comment Area === */
.va-comment-area {
  padding: 8px 10px;
  border-bottom: 1px solid #333;
}

.va-textarea {
  width: 100%;
  min-height: 80px;
  background: #111;
  border: 1px solid #333;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 12px;
  padding: 8px;
  resize: vertical;
}

.va-textarea:focus {
  outline: none;
  border-color: #00ff41;
}

.va-textarea::placeholder {
  color: #555;
}

/* === Reference Image Thumbnail === */
.va-ref-thumb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 4px;
  border: 1px solid #333;
  max-width: 100%;
}

.va-ref-thumb img {
  max-height: 60px;
  max-width: 100%;
}

.va-ref-thumb-remove {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
}

.va-ref-thumb-remove:hover {
  color: #ff4444;
}

/* === Priority === */
.va-priority {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #333;
  align-items: center;
}

.va-priority-label {
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
  margin-right: 4px;
}

.va-priority-btn {
  background: none;
  border: 1px solid #333;
  color: #888;
  padding: 2px 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
}

.va-priority-btn:hover {
  border-color: #e0e0e0;
}

.va-priority-btn--active {
  border-color: #e0e0e0;
  color: #e0e0e0;
}

.va-priority-btn--high.va-priority-btn--active {
  border-color: #ff4444;
  color: #ff4444;
}

.va-priority-btn--medium.va-priority-btn--active {
  border-color: #ffaa00;
  color: #ffaa00;
}

.va-priority-btn--low.va-priority-btn--active {
  border-color: #00ff41;
  color: #00ff41;
}

/* === Styles Diff === */
.va-styles-diff {
  border-bottom: 1px solid #333;
}

.va-styles-diff-toggle {
  width: 100%;
  background: none;
  border: none;
  color: #888;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}

.va-styles-diff-toggle:hover {
  color: #e0e0e0;
}

.va-styles-diff-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.va-styles-diff-table th {
  text-align: left;
  padding: 4px 10px;
  color: #888;
  border-bottom: 1px solid #222;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.va-styles-diff-table td {
  padding: 3px 10px;
  border-bottom: 1px solid #1a1a1a;
}

.va-styles-diff-input {
  background: #111;
  border: 1px solid #222;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 11px;
  padding: 2px 4px;
  width: 100%;
}

.va-styles-diff-input:focus {
  outline: none;
  border-color: #00ff41;
}

.va-styles-diff-changed {
  color: #00ff41;
}

/* === Card Actions === */
.va-card-actions {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
}

.va-card-actions-right {
  display: flex;
  gap: 6px;
}

.va-btn {
  background: none;
  border: 1px solid #333;
  color: #e0e0e0;
  padding: 4px 12px;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}

.va-btn:hover {
  border-color: #e0e0e0;
}

.va-btn--primary {
  border-color: #00ff41;
  color: #00ff41;
}

.va-btn--primary:hover {
  background: rgba(0, 255, 65, 0.1);
}

.va-btn--danger {
  border-color: #ff4444;
  color: #ff4444;
}

.va-btn--danger:hover {
  background: rgba(255, 68, 68, 0.1);
}

/* === Pin Marker === */
.va-pin {
  position: absolute;
  z-index: 2147483643;
  width: 22px;
  height: 22px;
  background: #0a0a0a;
  border: 1px solid #00ff41;
  color: #00ff41;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.va-pin:hover {
  background: #00ff41;
  color: #0a0a0a;
}

.va-pin--high {
  border-color: #ff4444;
  color: #ff4444;
}

.va-pin--high:hover {
  background: #ff4444;
  color: #0a0a0a;
}

.va-pin--medium {
  border-color: #ffaa00;
  color: #ffaa00;
}

.va-pin--medium:hover {
  background: #ffaa00;
  color: #0a0a0a;
}

.va-pin-tooltip {
  position: absolute;
  top: -30px;
  left: 0;
  background: #0a0a0a;
  border: 1px solid #333;
  color: #e0e0e0;
  padding: 2px 6px;
  font-size: 11px;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  display: none;
}

.va-pin:hover .va-pin-tooltip {
  display: block;
}

/* === Control Panel === */
.va-control-panel {
  position: fixed;
  z-index: 2147483646;
  bottom: 68px;
  right: 20px;
  background: #0a0a0a;
  border: 1px solid #333;
  padding: 8px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.va-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 11px;
  color: #888;
}

.va-toggle-box {
  width: 14px;
  height: 14px;
  border: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: center;
}

.va-toggle--active {
  color: #e0e0e0;
}

.va-toggle--active .va-toggle-box {
  border-color: #00ff41;
  color: #00ff41;
}

/* === Scrollbar === */
.va-card::-webkit-scrollbar {
  width: 6px;
}

.va-card::-webkit-scrollbar-track {
  background: #0a0a0a;
}

.va-card::-webkit-scrollbar-thumb {
  background: #333;
}
```

**Step 8: Commit**

```bash
git add src/client/ src/shared/
git commit -m "feat: add client shell with App, context, FloatingIcon, API utils, and styles"
```

---

### Task 7: Selector & Styles Utilities + Tests

**Files:**
- Create: `src/client/utils/selector.ts`
- Create: `src/client/utils/styles.ts`
- Create: `src/client/utils/__tests__/selector.test.ts`
- Create: `src/client/utils/__tests__/export.test.ts`
- Create: `src/client/utils/export.ts`

**Step 1: Write failing tests for selector generation**

Since selector generation runs in browser, we'll test the logic with minimal DOM mocking via `jsdom` (vitest default). Create `src/client/utils/__tests__/selector.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateSelector, generateXPath } from '../selector'

describe('generateSelector', () => {
  it('returns data-testid selector when present', () => {
    const el = document.createElement('button')
    el.setAttribute('data-testid', 'submit-btn')
    document.body.appendChild(el)
    expect(generateSelector(el)).toBe('[data-testid="submit-btn"]')
    el.remove()
  })

  it('returns id selector when element has id', () => {
    const el = document.createElement('div')
    el.id = 'hero'
    document.body.appendChild(el)
    expect(generateSelector(el)).toBe('#hero')
    el.remove()
  })

  it('builds class-based path for elements with classes', () => {
    const parent = document.createElement('main')
    const child = document.createElement('h1')
    child.className = 'page-title'
    parent.appendChild(child)
    document.body.appendChild(parent)
    const sel = generateSelector(child)
    expect(sel).toContain('.page-title')
    expect(document.querySelector(sel)).toBe(child)
    parent.remove()
  })

  it('falls back to nth-child path', () => {
    const parent = document.createElement('div')
    const child1 = document.createElement('span')
    const child2 = document.createElement('span')
    parent.appendChild(child1)
    parent.appendChild(child2)
    document.body.appendChild(parent)
    const sel = generateSelector(child2)
    expect(sel).toBeTruthy()
    expect(document.querySelector(sel)).toBe(child2)
    parent.remove()
  })
})

describe('generateXPath', () => {
  it('generates valid xpath', () => {
    const el = document.createElement('p')
    document.body.appendChild(el)
    const xpath = generateXPath(el)
    expect(xpath).toContain('/p')
    el.remove()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/client/utils/__tests__/selector.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement selector.ts**

```ts
const GENERIC_CLASSES = new Set([
  'active', 'disabled', 'hidden', 'visible', 'open', 'closed',
  'selected', 'focused', 'hover', 'container', 'wrapper', 'inner', 'outer',
])

export function generateSelector(el: Element): string {
  // Priority 1: data-testid
  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${testId}"]`

  // Priority 2: id
  if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
    return `#${CSS.escape(el.id)}`
  }

  // Priority 3: meaningful class path
  const classPath = buildClassPath(el)
  if (classPath && document.querySelectorAll(classPath).length === 1) {
    return classPath
  }

  // Priority 4: structural nth-child path
  return buildStructuralPath(el)
}

function buildClassPath(el: Element): string | null {
  const parts: string[] = []
  let current: Element | null = el

  for (let depth = 0; current && depth < 5; depth++) {
    const tag = current.tagName.toLowerCase()
    const meaningful = Array.from(current.classList).filter((c) => !GENERIC_CLASSES.has(c))

    if (meaningful.length > 0) {
      parts.unshift(`${tag}.${meaningful[0]}`)
    } else if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`)
      break
    } else {
      parts.unshift(tag)
    }

    current = current.parentElement
    if (current === document.body || current === document.documentElement) break
  }

  return parts.length > 0 ? parts.join(' > ') : null
}

function buildStructuralPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase()
    const parent = current.parentElement
    if (!parent) break

    const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName)
    if (siblings.length > 1) {
      const idx = siblings.indexOf(current) + 1
      parts.unshift(`${tag}:nth-child(${idx})`)
    } else {
      parts.unshift(tag)
    }

    current = parent
    if (current === document.body) break
  }

  return parts.join(' > ')
}

export function generateXPath(el: Element): string {
  const parts: string[] = []
  let current: Node | null = el

  while (current && current !== document) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element
      const tag = element.tagName.toLowerCase()
      const parent = element.parentNode
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === element.tagName)
        if (siblings.length > 1) {
          const idx = siblings.indexOf(element) + 1
          parts.unshift(`${tag}[${idx}]`)
        } else {
          parts.unshift(tag)
        }
      } else {
        parts.unshift(tag)
      }
    }
    current = current.parentNode
  }

  return '/' + parts.join('/')
}
```

**Step 4: Implement styles.ts**

`src/client/utils/styles.ts`:

```ts
import type { ComputedStyles } from '../../shared/types'

const CAPTURED_PROPERTIES: (keyof ComputedStyles)[] = [
  'fontSize', 'fontWeight', 'fontFamily', 'color', 'backgroundColor',
  'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius',
  'border', 'width', 'height', 'display', 'flexDirection', 'alignItems',
  'justifyContent', 'gap', 'opacity', 'boxShadow', 'textAlign', 'textTransform',
]

export function captureComputedStyles(el: Element): ComputedStyles {
  const computed = getComputedStyle(el)
  const styles: ComputedStyles = {}

  for (const prop of CAPTURED_PROPERTIES) {
    const cssKey = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    const value = computed.getPropertyValue(cssKey)
    if (value) {
      styles[prop] = value
    }
  }

  return styles
}

export const QUICK_ACTION_STYLES: Record<string, (keyof ComputedStyles)[]> = {
  color: ['color', 'backgroundColor'],
  spacing: ['padding', 'margin', 'gap'],
  font: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'],
  align: ['display', 'flexDirection', 'alignItems', 'justifyContent', 'textAlign'],
}
```

**Step 5: Write export util + tests**

`src/client/utils/__tests__/export.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildExportMarkdown } from '../export'
import type { Annotation } from '../../../shared/types'

const makeAnnotation = (overrides: Partial<Annotation> = {}): Annotation => ({
  id: 'ann_1',
  number: 1,
  timestamp: '2026-01-01T00:00:00Z',
  priority: 'high',
  element: {
    selector: 'main > h1',
    xpath: '/html/body/main/h1',
    tag: 'h1',
    textContent: 'Welcome',
    boundingBox: { x: 0, y: 0, width: 200, height: 40 },
  },
  computedStyles: { fontSize: '16px', fontWeight: '400' },
  targetStyles: { fontSize: '24px', fontWeight: '700' },
  comment: 'Make it bigger',
  quickActions: ['font'],
  quickActionIntents: ['wrong typography'],
  screenshot: null,
  referenceImage: null,
  ...overrides,
})

describe('buildExportMarkdown', () => {
  it('generates header with annotation count', () => {
    const md = buildExportMarkdown([makeAnnotation()])
    expect(md).toContain('I have 1 UI annotation')
  })

  it('orders by priority: high first', () => {
    const annotations = [
      makeAnnotation({ id: 'low', number: 2, priority: 'low' }),
      makeAnnotation({ id: 'high', number: 1, priority: 'high' }),
    ]
    const md = buildExportMarkdown(annotations)
    const highIdx = md.indexOf('HIGH')
    const lowIdx = md.indexOf('LOW')
    expect(highIdx).toBeLessThan(lowIdx)
  })

  it('includes style changes when target styles set', () => {
    const md = buildExportMarkdown([makeAnnotation()])
    expect(md).toContain('font-size: 16px → 24px')
  })

  it('includes screenshot path when present', () => {
    const md = buildExportMarkdown([makeAnnotation({ screenshot: 'screenshot_001.png' })])
    expect(md).toContain('.ui-annotations/screenshot_001.png')
  })

  it('omits screenshot line when null', () => {
    const md = buildExportMarkdown([makeAnnotation()])
    expect(md).not.toContain('Screenshot:')
  })
})
```

`src/client/utils/export.ts`:

```ts
import type { Annotation, ComputedStyles } from '../../shared/types'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

export function buildExportMarkdown(annotations: Annotation[]): string {
  const sorted = [...annotations].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  )

  const count = sorted.length
  const lines: string[] = [
    `I have ${count} UI annotation${count !== 1 ? 's' : ''} to implement. Annotations are ordered by priority.`,
    '',
    'Screenshots and reference images are in .ui-annotations/',
    '',
    '---',
  ]

  for (const ann of sorted) {
    lines.push('')
    lines.push(`## Annotation ${ann.number} (${ann.priority.toUpperCase()}) — ${ann.element.tag}${ann.element.selector.includes('.') ? '.' + ann.element.selector.split('.').pop() : ''}`)
    lines.push('')
    lines.push(`**Element:** \`${ann.element.tag}\``)
    lines.push(`**Selector:** \`${ann.element.selector}\``)
    if (ann.element.textContent) {
      lines.push(`**Current text:** "${ann.element.textContent}"`)
    }
    lines.push('')

    // Style changes
    const changes = Object.entries(ann.targetStyles).filter(
      ([key, val]) => val && val !== ann.computedStyles[key as keyof ComputedStyles]
    )
    if (changes.length > 0) {
      lines.push('**Style changes:**')
      for (const [key, val] of changes) {
        const current = ann.computedStyles[key as keyof ComputedStyles] ?? 'unset'
        lines.push(`- ${camelToKebab(key)}: ${current} → ${val}`)
      }
    } else if (ann.quickActions.length > 0) {
      const relevantStyles = Object.entries(ann.computedStyles)
      if (relevantStyles.length > 0) {
        lines.push('**Current styles:**')
        for (const [key, val] of relevantStyles) {
          lines.push(`- ${camelToKebab(key)}: ${val}`)
        }
      }
    }

    lines.push('')

    if (ann.quickActionIntents.length > 0) {
      lines.push(`**Intent:** ${ann.quickActionIntents.join(', ')}`)
    }
    if (ann.comment) {
      lines.push(`**Comment:** "${ann.comment}"`)
    }

    if (ann.screenshot) {
      lines.push('')
      lines.push(`**Screenshot:** .ui-annotations/${ann.screenshot}`)
    }
    if (ann.referenceImage) {
      lines.push(`**Reference image:** .ui-annotations/${ann.referenceImage}`)
    }

    lines.push('')
    lines.push('---')
  }

  return lines.join('\n')
}
```

**Step 6: Run all util tests**

Run: `pnpm test -- src/client/utils/__tests__/`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add src/client/utils/
git commit -m "feat: add selector, styles, and export utilities with tests"
```

---

### Task 8: ElementSelector Component

**Files:**
- Modify: `src/client/components/ElementSelector.tsx`

**Step 1: Implement the full ElementSelector**

Replaces the placeholder. Handles mousemove highlight and click capture.

```tsx
import { useContext, useEffect, useRef, useCallback } from 'preact/hooks'
import { AppContext } from '../context'
import { generateSelector, generateXPath } from '../utils/selector'
import { captureComputedStyles } from '../utils/styles'

export function ElementSelector() {
  const { state, dispatch } = useContext(AppContext)
  const highlightRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const isAnnotatorElement = useCallback((el: Element): boolean => {
    return !!el.closest('[data-vibe-annotator]')
  }, [])

  useEffect(() => {
    if (state.mode !== 'selecting') return

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target || isAnnotatorElement(target)) {
        dispatch({ type: 'SET_HOVERED', element: null })
        if (highlightRef.current) highlightRef.current.style.display = 'none'
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        return
      }

      dispatch({ type: 'SET_HOVERED', element: target as HTMLElement })
      const rect = target.getBoundingClientRect()

      if (highlightRef.current) {
        highlightRef.current.style.display = 'block'
        highlightRef.current.style.top = `${rect.top}px`
        highlightRef.current.style.left = `${rect.left}px`
        highlightRef.current.style.width = `${rect.width}px`
        highlightRef.current.style.height = `${rect.height}px`
      }

      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'block'
        tooltipRef.current.style.top = `${rect.top - 24}px`
        tooltipRef.current.style.left = `${rect.left}px`
        const tag = target.tagName.toLowerCase()
        const cls = target.className && typeof target.className === 'string'
          ? '.' + target.className.split(' ').filter(Boolean).slice(0, 2).join('.')
          : ''
        tooltipRef.current.textContent = `${tag}${cls}`
      }
    }

    const onClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const target = e.target as Element
      if (!target || isAnnotatorElement(target)) return

      const rect = target.getBoundingClientRect()
      const textContent = (target.textContent ?? '').trim().slice(0, 100)

      const id = `ann_${Date.now()}`
      const number = state.annotations.length + 1

      const annotation = {
        id,
        number,
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        element: {
          selector: generateSelector(target),
          xpath: generateXPath(target),
          tag: target.tagName.toLowerCase(),
          textContent,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        },
        computedStyles: captureComputedStyles(target),
        targetStyles: {},
        comment: '',
        quickActions: [],
        quickActionIntents: [],
        screenshot: null,
        referenceImage: null,
      }

      dispatch({ type: 'ADD_ANNOTATION', annotation })
      dispatch({ type: 'SET_ACTIVE', id })
      dispatch({ type: 'SET_MODE', mode: 'annotating' })
    }

    document.addEventListener('mousemove', onMouseMove, { capture: true })
    document.addEventListener('click', onClick, { capture: true })

    return () => {
      document.removeEventListener('mousemove', onMouseMove, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
    }
  }, [state.mode, state.annotations.length, dispatch, isAnnotatorElement])

  return (
    <>
      <div ref={highlightRef} class="va-highlight" style={{ display: 'none' }} />
      <div ref={tooltipRef} class="va-highlight-tooltip" style={{ display: 'none' }} />
    </>
  )
}
```

**Step 2: Verify build compiles**

Run: `pnpm build`
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/client/components/ElementSelector.tsx
git commit -m "feat: add element selector with highlight overlay and click capture"
```

---

### Task 9: AnnotationCard Component

**Files:**
- Modify: `src/client/components/AnnotationCard.tsx`
- Create: `src/client/components/StylesDiff.tsx`

**Step 1: Implement StylesDiff panel**

```tsx
import { useState } from 'preact/hooks'
import type { ComputedStyles } from '../../shared/types'

interface StylesDiffProps {
  computedStyles: ComputedStyles
  targetStyles: Partial<ComputedStyles>
  onTargetChange: (key: keyof ComputedStyles, value: string) => void
}

const STYLE_KEYS: (keyof ComputedStyles)[] = [
  'fontSize', 'fontWeight', 'fontFamily', 'color', 'backgroundColor',
  'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius',
  'border', 'width', 'height', 'display', 'flexDirection', 'alignItems',
  'justifyContent', 'gap', 'opacity', 'boxShadow', 'textAlign', 'textTransform',
]

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

export function StylesDiff({ computedStyles, targetStyles, onTargetChange }: StylesDiffProps) {
  const [expanded, setExpanded] = useState(false)

  const rows = STYLE_KEYS.filter((key) => computedStyles[key])

  return (
    <div class="va-styles-diff">
      <button class="va-styles-diff-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▼' : '▶'} Target styles
      </button>
      {expanded && (
        <table class="va-styles-diff-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Current</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => {
              const current = computedStyles[key] ?? ''
              const target = targetStyles[key] ?? ''
              const changed = target && target !== current
              return (
                <tr key={key}>
                  <td>{camelToKebab(key)}</td>
                  <td>{current}</td>
                  <td>
                    <input
                      class={`va-styles-diff-input ${changed ? 'va-styles-diff-changed' : ''}`}
                      value={target}
                      placeholder={current}
                      onInput={(e) => onTargetChange(key, (e.target as HTMLInputElement).value)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

**Step 2: Implement full AnnotationCard**

```tsx
import { useContext, useState, useEffect, useCallback, useRef } from 'preact/hooks'
import { AppContext } from '../context'
import { StylesDiff } from './StylesDiff'
import { saveAnnotation, deleteAnnotation, saveReferenceImage, imageUrl } from '../utils/api'
import { QUICK_ACTION_STYLES } from '../utils/styles'
import type { Annotation, Priority, QuickAction, ComputedStyles } from '../../shared/types'

const QUICK_ACTIONS: { key: QuickAction; label: string; intent: string }[] = [
  { key: 'color', label: 'COLOR', intent: 'User flagged incorrect color' },
  { key: 'spacing', label: 'SPACING', intent: 'User flagged incorrect spacing' },
  { key: 'font', label: 'FONT', intent: 'User flagged incorrect typography' },
  { key: 'align', label: 'ALIGN', intent: 'User flagged alignment issue' },
  { key: 'reference', label: 'REFERENCE', intent: 'Does not match design reference' },
  { key: 'comment', label: 'COMMENT', intent: '' },
]

export function AnnotationCard() {
  const { state, dispatch } = useContext(AppContext)
  const annotation = state.annotations.find((a) => a.id === state.activeAnnotation)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isExisting = useRef(false)

  const [comment, setComment] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [quickActions, setQuickActions] = useState<QuickAction[]>([])
  const [targetStyles, setTargetStyles] = useState<Partial<ComputedStyles>>({})
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)

  useEffect(() => {
    if (!annotation) return
    setComment(annotation.comment)
    setPriority(annotation.priority)
    setQuickActions([...annotation.quickActions])
    setTargetStyles({ ...annotation.targetStyles })
    setReferenceImage(annotation.referenceImage)
    setReferencePreview(annotation.referenceImage ? imageUrl(annotation.referenceImage) : null)
    // Track if we're editing an existing saved annotation (has a comment or was previously saved)
    isExisting.current = !!annotation.comment
  }, [annotation?.id])

  const toggleQuickAction = (key: QuickAction) => {
    setQuickActions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleTargetStyleChange = (key: keyof ComputedStyles, value: string) => {
    setTargetStyles((prev) => ({ ...prev, [key]: value || undefined }))
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const base64 = await fileToBase64(file)
        const filename = await saveReferenceImage(base64)
        setReferenceImage(filename)
        setReferencePreview(imageUrl(filename))
        if (!quickActions.includes('reference')) {
          setQuickActions((prev) => [...prev, 'reference'])
        }
        break
      }
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const base64 = await fileToBase64(file)
    const filename = await saveReferenceImage(base64)
    setReferenceImage(filename)
    setReferencePreview(imageUrl(filename))
    if (!quickActions.includes('reference')) {
      setQuickActions((prev) => [...prev, 'reference'])
    }
  }

  const handleSave = async () => {
    if (!annotation) return

    const intents = quickActions
      .map((k) => QUICK_ACTIONS.find((q) => q.key === k)?.intent)
      .filter(Boolean) as string[]

    const updated: Annotation = {
      ...annotation,
      comment,
      priority,
      quickActions,
      quickActionIntents: intents,
      targetStyles,
      referenceImage,
    }

    await saveAnnotation(updated)
    dispatch({ type: 'UPDATE_ANNOTATION', annotation: updated })
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  const handleCancel = () => {
    // If it's a brand-new annotation (never saved), remove it
    if (annotation && !isExisting.current) {
      dispatch({ type: 'REMOVE_ANNOTATION', id: annotation.id })
    }
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  const handleDelete = async () => {
    if (!annotation) return
    await deleteAnnotation(annotation.id)
    dispatch({ type: 'REMOVE_ANNOTATION', id: annotation.id })
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  if (!annotation) return null

  const cardStyle = computeCardPosition(annotation.element.boundingBox)

  return (
    <div class="va-card" style={cardStyle}>
      <div class="va-card-header">
        <span>#{annotation.number} {annotation.element.tag}.{annotation.element.selector.split('.').pop() ?? ''}</span>
        <button class="va-card-close" onClick={handleCancel}>✕</button>
      </div>

      <div class="va-quick-actions">
        {QUICK_ACTIONS.map(({ key, label }) => (
          <button
            key={key}
            class={`va-quick-action ${quickActions.includes(key) ? 'va-quick-action--active' : ''}`}
            onClick={() => toggleQuickAction(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div class="va-comment-area">
        <textarea
          ref={textareaRef}
          class="va-textarea"
          placeholder="Describe what should change..."
          value={comment}
          onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
          onPaste={handlePaste as any}
          onDrop={handleDrop as any}
          onDragOver={(e) => e.preventDefault()}
        />
        {referencePreview && (
          <div class="va-ref-thumb">
            <img src={referencePreview} alt="Reference" />
            <button
              class="va-ref-thumb-remove"
              onClick={() => {
                setReferenceImage(null)
                setReferencePreview(null)
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div class="va-priority">
        <span class="va-priority-label">Priority:</span>
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <button
            key={p}
            class={`va-priority-btn va-priority-btn--${p} ${priority === p ? 'va-priority-btn--active' : ''}`}
            onClick={() => setPriority(p)}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      <StylesDiff
        computedStyles={annotation.computedStyles}
        targetStyles={targetStyles}
        onTargetChange={handleTargetStyleChange}
      />

      <div class="va-card-actions">
        <div>
          {isExisting.current && (
            <button class="va-btn va-btn--danger" onClick={handleDelete}>DELETE</button>
          )}
        </div>
        <div class="va-card-actions-right">
          <button class="va-btn" onClick={handleCancel}>CANCEL</button>
          <button class="va-btn va-btn--primary" onClick={handleSave}>SAVE</button>
        </div>
      </div>
    </div>
  )
}

function computeCardPosition(box: { x: number; y: number; width: number; height: number }) {
  const cardWidth = 360
  const gap = 12
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Try right
  if (box.x + box.width + gap + cardWidth < vw) {
    return { left: `${box.x + box.width + gap}px`, top: `${Math.max(8, box.y)}px` }
  }
  // Try left
  if (box.x - gap - cardWidth > 0) {
    return { left: `${box.x - gap - cardWidth}px`, top: `${Math.max(8, box.y)}px` }
  }
  // Below
  if (box.y + box.height + gap + 200 < vh) {
    return { left: `${Math.max(8, box.x)}px`, top: `${box.y + box.height + gap}px` }
  }
  // Above
  return { left: `${Math.max(8, box.x)}px`, bottom: `${vh - box.y + gap}px` }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // strip data:... prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

**Step 3: Verify build compiles**

Run: `pnpm build`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/client/components/AnnotationCard.tsx src/client/components/StylesDiff.tsx
git commit -m "feat: add AnnotationCard with quick actions, styles diff, and reference images"
```

---

### Task 10: PinMarker & ControlPanel Components

**Files:**
- Modify: `src/client/components/PinMarker.tsx`
- Modify: `src/client/components/ControlPanel.tsx`

**Step 1: Implement PinMarker**

```tsx
import { useContext, useEffect, useState, useRef } from 'preact/hooks'
import { AppContext } from '../context'
import type { Annotation } from '../../shared/types'

interface PinMarkerProps {
  annotation: Annotation
}

export function PinMarker({ annotation }: PinMarkerProps) {
  const { dispatch } = useContext(AppContext)
  const [pos, setPos] = useState({ x: annotation.element.boundingBox.x, y: annotation.element.boundingBox.y })
  const observerRef = useRef<MutationObserver | null>(null)
  const resizeRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const updatePos = () => {
      const el = document.querySelector(annotation.element.selector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY })
      }
    }

    updatePos()

    // Observe DOM changes to reposition
    observerRef.current = new MutationObserver(updatePos)
    observerRef.current.observe(document.body, { childList: true, subtree: true, attributes: true })

    const el = document.querySelector(annotation.element.selector)
    if (el) {
      resizeRef.current = new ResizeObserver(updatePos)
      resizeRef.current.observe(el)
    }

    return () => {
      observerRef.current?.disconnect()
      resizeRef.current?.disconnect()
    }
  }, [annotation.element.selector])

  const handleClick = () => {
    dispatch({ type: 'SET_ACTIVE', id: annotation.id })
    dispatch({ type: 'SET_MODE', mode: 'annotating' })
  }

  const priorityClass = `va-pin--${annotation.priority}`

  return (
    <div
      class={`va-pin ${priorityClass}`}
      style={{ left: `${pos.x - 11}px`, top: `${pos.y - 11}px` }}
      onClick={handleClick}
    >
      {annotation.number}
      <span class="va-pin-tooltip">
        {annotation.comment || 'No comment'}
      </span>
    </div>
  )
}
```

**Step 2: Implement ControlPanel**

```tsx
import { useContext, useState } from 'preact/hooks'
import { AppContext } from '../context'
import { buildExportMarkdown } from '../utils/export'

export function ControlPanel() {
  const { state, dispatch } = useContext(AppContext)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (state.annotations.length === 0) return
    const md = buildExportMarkdown(state.annotations)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toggleVision = () => {
    dispatch({ type: 'SET_VISION_MODE', enabled: !state.visionMode })
  }

  return (
    <div class="va-control-panel">
      <label class={`va-toggle ${state.visionMode ? 'va-toggle--active' : ''}`} onClick={toggleVision}>
        <span class="va-toggle-box">{state.visionMode ? '■' : ''}</span>
        VISION
      </label>
      <button
        class="va-btn va-btn--primary"
        onClick={handleCopy}
        disabled={state.annotations.length === 0}
      >
        {copied ? 'COPIED!' : `COPY (${state.annotations.length})`}
      </button>
    </div>
  )
}
```

**Step 3: Verify build compiles**

Run: `pnpm build`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/client/components/PinMarker.tsx src/client/components/ControlPanel.tsx
git commit -m "feat: add PinMarker and ControlPanel components"
```

---

### Task 11: Screenshot Hook

**Files:**
- Create: `src/client/hooks/useScreenshot.ts`
- Modify: `src/client/components/ElementSelector.tsx` (integrate screenshot capture)

**Step 1: Implement useScreenshot hook**

```ts
import { useContext, useCallback } from 'preact/hooks'
import { AppContext } from '../context'
import { saveScreenshot } from '../utils/api'

export function useScreenshot() {
  const { state } = useContext(AppContext)

  const capture = useCallback(async (element: Element): Promise<string | null> => {
    if (!state.visionMode) return null

    // Lazy-load html2canvas
    const { default: html2canvas } = await import('html2canvas')

    const rect = element.getBoundingClientRect()
    const padding = 200

    // Hide annotator UI during capture
    const container = document.querySelector('[data-vibe-annotator]') as HTMLElement | null
    if (container) container.style.display = 'none'

    try {
      const canvas = await html2canvas(document.body, {
        x: 0,
        y: Math.max(0, rect.top + window.scrollY - padding),
        width: window.innerWidth,
        height: rect.height + padding * 2,
        scale: 2,
        useCORS: true,
        logging: false,
      })

      // Draw highlight outline on the element's position within the capture
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const highlightY = Math.min(padding, rect.top + window.scrollY) * 2  // scale 2x
        ctx.strokeStyle = '#00ff41'
        ctx.lineWidth = 4
        ctx.setLineDash([8, 4])
        ctx.strokeRect(rect.left * 2, highlightY, rect.width * 2, rect.height * 2)
      }

      const dataUrl = canvas.toDataURL('image/png', 0.8)
      const base64 = dataUrl.split(',')[1]
      return await saveScreenshot(base64)
    } finally {
      if (container) container.style.display = ''
    }
  }, [state.visionMode])

  return { capture }
}
```

**Step 2: Integrate screenshot into ElementSelector click handler**

Modify `src/client/components/ElementSelector.tsx` — add screenshot capture on click, before transitioning to annotating mode. Add import for `useScreenshot` and call `capture(target)` inside the `onClick` handler, storing the result in the annotation's `screenshot` field.

In the `onClick` handler, after creating the `annotation` object but before dispatching:

```tsx
// Add import at top:
import { useScreenshot } from '../hooks/useScreenshot'

// Inside component, add:
const { capture } = useScreenshot()

// In onClick, change annotation creation to:
const screenshot = await capture(target)
const annotation = {
  // ... same as before ...
  screenshot,
  // ...
}
```

Make the `onClick` handler `async`.

**Step 3: Verify build compiles**

Run: `pnpm build`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/client/hooks/useScreenshot.ts src/client/components/ElementSelector.tsx
git commit -m "feat: add screenshot capture with html2canvas"
```

---

### Task 12: CSS Injection & Build Wiring

**Files:**
- Modify: `src/client/index.tsx` (inline CSS at build time)
- Modify: `tsup.config.ts` (add CSS inlining)

**Step 1: Update tsup config to inline CSS**

Add an `esbuildPlugins` option to the client build that reads `styles.css` and defines it as a constant:

```ts
import { defineConfig } from 'tsup'
import fs from 'node:fs'
import path from 'node:path'

const inlineCssPlugin = {
  name: 'inline-css',
  setup(build: any) {
    build.onResolve({ filter: /^CSS_INLINE$/ }, () => ({
      path: 'CSS_INLINE',
      namespace: 'inline-css',
    }))
    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, () => {
      const css = fs.readFileSync(path.resolve('src/client/styles.css'), 'utf-8')
      return { contents: `export default ${JSON.stringify(css)}`, loader: 'js' }
    })
  },
}

export default defineConfig([
  // Plugin build
  {
    entry: { index: 'src/plugin/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['vite'],
  },
  // Client build
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
    esbuildPlugins: [inlineCssPlugin],
    noExternal: ['preact', 'html2canvas'],
  },
])
```

**Step 2: Update client entry to use inline CSS**

```tsx
import { render } from 'preact'
import { App } from './App'
// @ts-expect-error — virtual module from esbuild plugin
import cssContent from 'CSS_INLINE'

function mount() {
  const container = document.createElement('div')
  container.setAttribute('data-vibe-annotator', '')
  document.body.appendChild(container)

  const style = document.createElement('style')
  style.textContent = cssContent
  container.appendChild(style)

  render(<App />, container)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
```

**Step 3: Full build and verify outputs**

Run: `pnpm build`
Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/client.iife.js` all produced.

**Step 4: Commit**

```bash
git add tsup.config.ts src/client/index.tsx
git commit -m "feat: wire CSS injection and finalize dual build pipeline"
```

---

### Task 13: Integration Test with Demo App

**Files:**
- Create: `demo/vite.config.ts`
- Create: `demo/index.html`
- Create: `demo/package.json`

**Step 1: Create a minimal demo app to test the plugin**

`demo/package.json`:
```json
{
  "name": "vibe-annotator-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vibe-annotator": "link:.."
  }
}
```

`demo/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import { annotateUI } from 'vibe-annotator'

export default defineConfig({
  plugins: [annotateUI()],
})
```

`demo/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Vibe Annotator Demo</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    .hero { padding: 60px 0; }
    .hero h1 { font-size: 48px; font-weight: 700; }
    .hero p { font-size: 18px; color: #666; margin-top: 12px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; }
    .card { padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px; }
    .card h3 { font-size: 18px; margin-bottom: 8px; }
    .card p { color: #888; font-size: 14px; }
    .btn { display: inline-block; padding: 12px 24px; background: #0066ff; color: white; border: none; margin-top: 20px; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <section class="hero">
    <h1 data-testid="hero-title">Welcome to the Demo</h1>
    <p>Click elements to annotate them with feedback for your AI agent.</p>
    <button class="btn">Get Started</button>
  </section>
  <section class="cards">
    <div class="card">
      <h3>Feature One</h3>
      <p>Description of the first feature with some detail.</p>
    </div>
    <div class="card">
      <h3>Feature Two</h3>
      <p>Description of the second feature with some detail.</p>
    </div>
    <div class="card">
      <h3>Feature Three</h3>
      <p>Description of the third feature with some detail.</p>
    </div>
  </section>
</body>
</html>
```

**Step 2: Build the plugin, install demo deps, and test**

```bash
cd /Users/Danny/CodeProjects/vibe-annotator && pnpm build
cd demo && pnpm install && pnpm dev
```

Expected: Dev server starts. Page loads with demo content. Floating icon visible in bottom-right. Clicking it enables selection mode. Hovering elements shows dashed highlight. Clicking an element opens annotation card.

**Step 3: Manual verification checklist**

- [ ] Floating icon renders in bottom-right corner
- [ ] Clicking icon toggles selecting mode (green border)
- [ ] Hovering elements shows highlight overlay with tag tooltip
- [ ] Clicking an element opens annotation card next to it
- [ ] Quick action buttons toggle on/off
- [ ] Comment textarea accepts text input
- [ ] Priority buttons switch between high/med/low
- [ ] Save button persists annotation, shows pin marker
- [ ] Pin marker click reopens card for editing
- [ ] Delete button removes saved annotation
- [ ] Cancel on new annotation removes it
- [ ] Copy button generates markdown to clipboard
- [ ] Vision toggle and screenshot capture work
- [ ] Paste image into textarea shows thumbnail

**Step 4: Commit demo**

```bash
cd /Users/Danny/CodeProjects/vibe-annotator
git add demo/
git commit -m "feat: add demo app for integration testing"
```

---

## Summary

| Task | Description | Test Coverage |
|------|-------------|---------------|
| 1 | Project scaffolding | — |
| 2 | Shared types | — |
| 3 | Storage layer | 5 unit tests |
| 4 | REST middleware | 4 unit tests |
| 5 | Vite plugin entry | build verification |
| 6 | Client shell + styles | build verification |
| 7 | Selector/styles/export utils | 9 unit tests |
| 8 | ElementSelector component | manual |
| 9 | AnnotationCard + StylesDiff | manual |
| 10 | PinMarker + ControlPanel | manual |
| 11 | Screenshot hook | manual |
| 12 | CSS injection + build wiring | build verification |
| 13 | Integration test with demo | manual checklist |

Total: ~18 unit tests + manual integration verification.
