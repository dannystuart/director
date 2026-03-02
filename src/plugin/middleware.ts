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
