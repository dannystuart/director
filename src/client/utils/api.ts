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
