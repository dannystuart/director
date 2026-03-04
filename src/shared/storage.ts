import type { Annotation } from './types'

export interface StorageAdapter {
  /** Load all annotations and settings */
  load(): Promise<{ annotations: Annotation[]; settings: { visionMode: boolean } }>

  /** Save a new annotation */
  save(annotation: Annotation): Promise<void>

  /** Update an existing annotation */
  update(annotation: Annotation): Promise<void>

  /** Remove an annotation by ID */
  remove(id: string): Promise<void>

  /** Save an image (screenshot or reference), returns a storable reference */
  saveImage(base64: string): Promise<string>

  /** Resolve a stored image reference to a displayable URL */
  resolveImageUrl(ref: string): string
}
