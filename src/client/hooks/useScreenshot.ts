import { useContext, useCallback } from 'preact/hooks'
import { AppContext } from '../context'
import { saveScreenshot } from '../utils/api'

export function useScreenshot() {
  const { state } = useContext(AppContext)

  const capture = useCallback(async (element: Element): Promise<string | null> => {
    if (!state.visionMode) return null

    // Lazy-load html2canvas
    const { default: html2canvas } = await import('html2canvas')

    const rect = element.getBoundingClientRect()
    const padding = 200

    // Hide annotator UI during capture
    const container = document.querySelector('[data-vibe-annotator]') as HTMLElement | null
    if (container) container.style.display = 'none'

    try {
      const canvas = await html2canvas(document.body, {
        x: 0,
        y: Math.max(0, rect.top + window.scrollY - padding),
        width: window.innerWidth,
        height: rect.height + padding * 2,
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (el: Element) =>
          el.hasAttribute('data-vibe-annotator') || !!el.closest('[data-vibe-annotator]'),
      })

      // Draw highlight outline on the element's position within the capture
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const highlightY = Math.min(padding, rect.top + window.scrollY) * 2 // scale 2x
        ctx.strokeStyle = '#00ff41'
        ctx.lineWidth = 4
        ctx.setLineDash([8, 4])
        ctx.strokeRect(rect.left * 2, highlightY, rect.width * 2, rect.height * 2)
      }

      const dataUrl = canvas.toDataURL('image/png', 0.8)
      const base64 = dataUrl.split(',')[1]
      return await saveScreenshot(base64)
    } finally {
      if (container) container.style.display = ''
    }
  }, [state.visionMode])

  return { capture }
}
