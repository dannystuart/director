import type { Annotation } from '../../shared/types'
import type { StorageAdapter } from '../../shared/storage'

const API = '/__annotations/api'

export class ServerStorage implements StorageAdapter {
  async load(): Promise<{ annotations: Annotation[]; settings: { visionMode: boolean } }> {
    const res = await fetch(`${API}/annotations`)
    const data = await res.json()
    return {
      annotations: data.annotations,
      settings: data.settings,
    }
  }

  async save(annotation: Annotation): Promise<void> {
    await fetch(`${API}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    })
  }

  async update(annotation: Annotation): Promise<void> {
    await fetch(`${API}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    })
  }

  async remove(id: string): Promise<void> {
    await fetch(`${API}/annotations/${id}`, { method: 'DELETE' })
  }

  async saveImage(base64: string): Promise<string> {
    const res = await fetch(`${API}/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    })
    const data = await res.json()
    return data.filename
  }

  resolveImageUrl(ref: string): string {
    return `${API}/images/${ref}`
  }
}
