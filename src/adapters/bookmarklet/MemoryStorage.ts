import type { Annotation } from '../../shared/types'
import type { StorageAdapter } from '../../shared/storage'

export class MemoryStorage implements StorageAdapter {
  private annotations = new Map<string, Annotation>()

  async load(): Promise<{ annotations: Annotation[]; settings: { visionMode: boolean } }> {
    return {
      annotations: [...this.annotations.values()],
      settings: { visionMode: true },
    }
  }

  async save(annotation: Annotation): Promise<void> {
    this.annotations.set(annotation.id, annotation)
  }

  async update(annotation: Annotation): Promise<void> {
    this.annotations.set(annotation.id, annotation)
  }

  async remove(id: string): Promise<void> {
    this.annotations.delete(id)
  }

  async saveImage(base64: string): Promise<string> {
    const byteString = atob(base64.includes(',') ? base64.split(',')[1] : base64)
    const mimeMatch = base64.match(/^data:(.+?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/png'
    const bytes = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mime })
    return URL.createObjectURL(blob)
  }

  resolveImageUrl(ref: string): string {
    // Blob URLs are already displayable
    return ref
  }
}
