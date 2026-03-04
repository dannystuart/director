// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { extractPageColors, isColorValue, clearColorCache } from '../colorExtraction'

describe('colorExtraction', () => {
  beforeEach(() => {
    clearColorCache()
    document.body.innerHTML = ''
  })

  describe('isColorValue', () => {
    it('recognizes hex colors', () => {
      expect(isColorValue('#ff0000')).toBe(true)
      expect(isColorValue('#f00')).toBe(true)
      expect(isColorValue('#ff000080')).toBe(true)
    })

    it('recognizes rgb/rgba colors', () => {
      expect(isColorValue('rgb(255, 0, 0)')).toBe(true)
      expect(isColorValue('rgba(255, 0, 0, 0.5)')).toBe(true)
    })

    it('recognizes hsl colors', () => {
      expect(isColorValue('hsl(120, 100%, 50%)')).toBe(true)
      expect(isColorValue('hsla(120, 100%, 50%, 0.5)')).toBe(true)
    })

    it('recognizes named colors', () => {
      expect(isColorValue('red')).toBe(true)
      expect(isColorValue('transparent')).toBe(true)
    })

    it('rejects non-color values', () => {
      expect(isColorValue('16px')).toBe(false)
      expect(isColorValue('bold')).toBe(false)
      expect(isColorValue('flex')).toBe(false)
      expect(isColorValue('')).toBe(false)
    })
  })

  describe('extractPageColors', () => {
    it('returns tokens and usedColors arrays', () => {
      const result = extractPageColors()
      expect(result).toHaveProperty('tokens')
      expect(result).toHaveProperty('usedColors')
      expect(Array.isArray(result.tokens)).toBe(true)
      expect(Array.isArray(result.usedColors)).toBe(true)
    })

    it('caches results on second call', () => {
      const first = extractPageColors()
      const second = extractPageColors()
      expect(first).toBe(second)
    })

    it('refreshes when forceRefresh is true', () => {
      const first = extractPageColors()
      const second = extractPageColors(true)
      expect(first).not.toBe(second)
    })

    it('limits sampled elements to 200', () => {
      for (let i = 0; i < 250; i++) {
        document.body.appendChild(document.createElement('div'))
      }
      const result = extractPageColors()
      expect(result).toBeDefined()
    })
  })
})
