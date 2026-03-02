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
