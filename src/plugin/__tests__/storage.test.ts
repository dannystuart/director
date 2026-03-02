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
