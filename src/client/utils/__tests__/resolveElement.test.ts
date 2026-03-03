// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveElement, resolveRect, getComputedStyleSafe } from '../resolveElement'

describe('resolveElement', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = document.createElement('div')
    el.id = 'test-el'
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('queries parent document when no iframe', () => {
    const result = resolveElement('#test-el', null)
    expect(result).toBe(el)
  })

  it('returns null for missing selector with no iframe', () => {
    const result = resolveElement('#nonexistent', null)
    expect(result).toBeNull()
  })
})

describe('resolveRect', () => {
  it('returns element rect directly when no iframe', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const rect = resolveRect(el, null)
    expect(rect).toHaveProperty('x')
    expect(rect).toHaveProperty('y')
    expect(rect).toHaveProperty('width')
    expect(rect).toHaveProperty('height')
    document.body.innerHTML = ''
  })
})

describe('getComputedStyleSafe', () => {
  it('returns computed style for parent document element', () => {
    const el = document.createElement('div')
    el.style.color = 'red'
    document.body.appendChild(el)
    const cs = getComputedStyleSafe(el)
    expect(cs).toBeDefined()
    document.body.innerHTML = ''
  })
})
