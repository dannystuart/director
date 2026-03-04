// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DOMStateManager } from '../domState'

describe('DOMStateManager', () => {
  let manager: DOMStateManager
  let el: HTMLElement

  beforeEach(() => {
    manager = new DOMStateManager()
    el = document.createElement('div')
    el.style.cssText = 'color: red; font-size: 16px;'
    el.textContent = 'Hello world'
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('snapshot', () => {
    it('captures inline styles and text content', () => {
      const snap = manager.snapshot(el)
      expect(snap.inlineStyles).toBe(el.style.cssText)
      expect(snap.textContent).toBe('Hello world')
      expect(snap.element).toBe(el)
    })

    it('captures innerHTML', () => {
      el.innerHTML = '<span>child</span>'
      const snap = manager.snapshot(el)
      expect(snap.innerHTML).toBe('<span>child</span>')
    })

    it('captures sibling index', () => {
      const sibling = document.createElement('span')
      document.body.appendChild(sibling)
      const snap = manager.snapshot(sibling)
      expect(snap.siblingIndex).toBe(1)
    })
  })

  describe('preview', () => {
    it('applies CSS changes to element', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      expect(el.style.color).toBe('blue')
    })

    it('applies text changes to element', () => {
      manager.preview(el, { type: 'text', text: 'New text' })
      expect(el.textContent).toBe('New text')
    })

    it('auto-snapshots on first preview', () => {
      expect(manager.hasPreview(el)).toBe(false)
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      expect(manager.hasPreview(el)).toBe(true)
    })

    it('preserves existing CSS when adding new properties', () => {
      manager.preview(el, { type: 'css', css: { 'background-color': 'green' } })
      expect(el.style.color).toBe('red')
      expect(el.style.backgroundColor).toBe('green')
    })
  })

  describe('revert', () => {
    it('restores original inline styles', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue', 'background-color': 'green' } })
      manager.revert(el)
      expect(el.style.color).toBe('red')
      expect(el.style.backgroundColor).toBe('')
    })

    it('restores original text content', () => {
      manager.preview(el, { type: 'text', text: 'Changed' })
      manager.revert(el)
      expect(el.textContent).toBe('Hello world')
    })

    it('clears tracking after revert', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      manager.revert(el)
      expect(manager.hasPreview(el)).toBe(false)
    })

    it('is a no-op for untracked elements', () => {
      manager.revert(el) // should not throw
      expect(el.style.color).toBe('red')
    })
  })

  describe('commit', () => {
    it('returns before snapshot and applied change', () => {
      const change = { type: 'css' as const, css: { color: 'blue' } }
      manager.preview(el, change)
      const result = manager.commit(el)
      expect(result.before.textContent).toBe('Hello world')
      expect(result.after).toEqual(change)
    })

    it('clears tracking after commit', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      manager.commit(el)
      expect(manager.hasPreview(el)).toBe(false)
    })

    it('throws when no active preview', () => {
      expect(() => manager.commit(el)).toThrow('No active preview')
    })
  })

  describe('revertAll', () => {
    it('reverts all tracked elements', () => {
      const el2 = document.createElement('p')
      el2.style.cssText = 'margin: 10px;'
      el2.textContent = 'Second'
      document.body.appendChild(el2)

      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      manager.preview(el2, { type: 'css', css: { margin: '20px' } })
      manager.revertAll()

      expect(el.style.color).toBe('red')
      expect(el2.style.margin).toBe('10px')
      expect(manager.hasPreview(el)).toBe(false)
      expect(manager.hasPreview(el2)).toBe(false)
    })
  })

  describe('unsupported types', () => {
    it('throws for reorder type', () => {
      expect(() => manager.preview(el, { type: 'reorder', reorder: { newIndex: 0 } }))
        .toThrow('not implemented')
    })

    it('throws for dom type', () => {
      expect(() => manager.preview(el, { type: 'dom', dom: { html: '<p>hi</p>' } }))
        .toThrow('not implemented')
    })
  })
})
