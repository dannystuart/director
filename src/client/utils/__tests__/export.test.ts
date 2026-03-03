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
  quickActions: [{ category: 'font' as const, detail: 'too-small' as const, intent: 'User flagged font is too small' }],
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
    expect(md).toContain('font-size: 16px \u2192 24px')
  })

  it('includes screenshot path when present', () => {
    const md = buildExportMarkdown([makeAnnotation({ screenshot: 'screenshot_001.png' })])
    expect(md).toContain('.ui-annotations/screenshot_001.png')
  })

  it('omits screenshot line when null', () => {
    const md = buildExportMarkdown([makeAnnotation()])
    expect(md).not.toContain('Screenshot:')
  })

  it('includes viewport width for mobile', () => {
    const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 375 })])
    expect(md).toContain('**Viewport:** 375px (Mobile)')
  })

  it('labels viewport as Tablet for 768px', () => {
    const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 768 })])
    expect(md).toContain('**Viewport:** 768px (Tablet)')
  })

  it('omits viewport for desktop widths >= 1024', () => {
    const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 1440 })])
    expect(md).not.toContain('**Viewport:**')
  })

  it('includes text change when present', () => {
    const ann = makeAnnotation({
      textChange: { original: 'Dashboard Overview', updated: 'My Dashboard' },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('**Text change:** "Dashboard Overview" → "My Dashboard"')
  })

  it('includes color change with token name', () => {
    const ann = makeAnnotation({
      colorChange: {
        property: 'backgroundColor',
        from: 'rgb(0, 0, 0)',
        to: '#2563eb',
        tokenName: '--color-primary',
      },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('background-color: rgb(0, 0, 0) → var(--color-primary) (#2563eb)')
  })

  it('includes color change without token name', () => {
    const ann = makeAnnotation({
      colorChange: {
        property: 'color',
        from: 'rgb(0, 0, 0)',
        to: '#ff0000',
        tokenName: null,
      },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('color: rgb(0, 0, 0) → #ff0000')
  })

  it('formats insertion annotation', () => {
    const ann = makeAnnotation({
      insertion: {
        position: 'after',
        elementType: 'button',
        textContent: 'Get Started Free',
        description: 'Primary CTA, match existing button styles',
      },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('**Change type:** Insert new element')
    expect(md).toContain('**Position:** After')
    expect(md).toContain('**Insert:** Button — "Get Started Free"')
    expect(md).toContain('**Notes:** "Primary CTA, match existing button styles"')
  })
})
