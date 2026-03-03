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
      quickActions: [], screenshot: null, referenceImage: null,
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
      quickActions: [], screenshot: null, referenceImage: null,
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
