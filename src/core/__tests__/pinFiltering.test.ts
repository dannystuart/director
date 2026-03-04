// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { filterVisibleAnnotations } from '../utils/pinFiltering'
import type { Annotation } from '../../shared/types'

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
  computedStyles: {},
  targetStyles: {},
  comment: '',
  quickActions: [],
  screenshot: null,
  referenceImage: null,
  ...overrides,
})

describe('filterVisibleAnnotations', () => {
  it('shows all pins when current viewport is null (Full mode)', () => {
    const annotations = [
      makeAnnotation({ id: 'a', viewportWidth: null }),
      makeAnnotation({ id: 'b', viewportWidth: 375 }),
      makeAnnotation({ id: 'c', viewportWidth: 1024 }),
    ]
    const result = filterVisibleAnnotations(annotations, null)
    expect(result).toHaveLength(3)
  })

  it('shows Full mode pins on any viewport', () => {
    const annotations = [
      makeAnnotation({ id: 'a', viewportWidth: null }),
      makeAnnotation({ id: 'b', viewportWidth: 375 }),
    ]
    const result = filterVisibleAnnotations(annotations, 375)
    expect(result).toHaveLength(2)
  })

  it('hides pins from a different viewport', () => {
    const annotations = [
      makeAnnotation({ id: 'a', viewportWidth: 375 }),
      makeAnnotation({ id: 'b', viewportWidth: 768 }),
    ]
    const result = filterVisibleAnnotations(annotations, 375)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('shows pins with undefined viewportWidth (legacy compat)', () => {
    const annotations = [
      makeAnnotation({ id: 'a' }), // viewportWidth is undefined
    ]
    const result = filterVisibleAnnotations(annotations, 375)
    expect(result).toHaveLength(1)
  })
})
