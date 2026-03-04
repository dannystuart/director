// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { generateSelector, generateXPath } from '../selector'

describe('generateSelector', () => {
  it('returns data-testid selector when present', () => {
    const el = document.createElement('button')
    el.setAttribute('data-testid', 'submit-btn')
    document.body.appendChild(el)
    expect(generateSelector(el)).toBe('[data-testid="submit-btn"]')
    el.remove()
  })

  it('returns id selector when element has id', () => {
    const el = document.createElement('div')
    el.id = 'hero'
    document.body.appendChild(el)
    expect(generateSelector(el)).toBe('#hero')
    el.remove()
  })

  it('builds class-based path for elements with classes', () => {
    const parent = document.createElement('main')
    const child = document.createElement('h1')
    child.className = 'page-title'
    parent.appendChild(child)
    document.body.appendChild(parent)
    const sel = generateSelector(child)
    expect(sel).toContain('.page-title')
    expect(document.querySelector(sel)).toBe(child)
    parent.remove()
  })

  it('falls back to nth-child path', () => {
    const parent = document.createElement('div')
    const child1 = document.createElement('span')
    const child2 = document.createElement('span')
    parent.appendChild(child1)
    parent.appendChild(child2)
    document.body.appendChild(parent)
    const sel = generateSelector(child2)
    expect(sel).toBeTruthy()
    expect(document.querySelector(sel)).toBe(child2)
    parent.remove()
  })
})

describe('generateXPath', () => {
  it('generates valid xpath', () => {
    const el = document.createElement('p')
    document.body.appendChild(el)
    const xpath = generateXPath(el)
    expect(xpath).toContain('/p')
    el.remove()
  })
})
