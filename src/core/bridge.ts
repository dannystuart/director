/**
 * SelectionBridge — lightweight iframe-side selection handler.
 * Mounted instead of the full app when running inside an iframe.
 * Communicates with the parent via postMessage.
 */
import { generateSelector, generateXPath } from './utils/selector'
import { captureComputedStyles } from './utils/styles'

// Inline styles matching the main app's highlight/tooltip aesthetic
const BRIDGE_CSS = `
.va-bridge-highlight {
  position: fixed;
  z-index: 2147483640;
  pointer-events: none;
  border: 2px dashed #00ff41;
  background: rgba(0, 255, 65, 0.05);
  display: none;
}
.va-bridge-tooltip {
  position: fixed;
  z-index: 2147483641;
  background: #0a0a0a;
  border: 1px solid #333;
  color: #e0e0e0;
  padding: 2px 6px;
  font-family: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: none;
}
`

let highlight: HTMLDivElement | null = null
let tooltip: HTMLDivElement | null = null
let active = false
let visionMode = false

function ensureDOM() {
  if (highlight) return

  const style = document.createElement('style')
  style.textContent = BRIDGE_CSS
  document.head.appendChild(style)

  highlight = document.createElement('div')
  highlight.className = 'va-bridge-highlight'
  document.body.appendChild(highlight)

  tooltip = document.createElement('div')
  tooltip.className = 'va-bridge-tooltip'
  document.body.appendChild(tooltip)
}

function onMouseMove(e: MouseEvent) {
  const target = e.target as Element
  if (!target || !highlight || !tooltip) return

  const rect = target.getBoundingClientRect()

  highlight.style.display = 'block'
  highlight.style.top = `${rect.top}px`
  highlight.style.left = `${rect.left}px`
  highlight.style.width = `${rect.width}px`
  highlight.style.height = `${rect.height}px`

  tooltip.style.display = 'block'
  tooltip.style.top = `${rect.top - 24}px`
  tooltip.style.left = `${rect.left}px`
  const tag = target.tagName.toLowerCase()
  const cls =
    target.className && typeof target.className === 'string'
      ? '.' + target.className.split(' ').filter(Boolean).slice(0, 2).join('.')
      : ''
  tooltip.textContent = `${tag}${cls}`
}

async function onClick(e: MouseEvent) {
  const target = e.target as Element
  if (!target) return

  e.preventDefault()
  e.stopPropagation()

  // Hide highlight during screenshot
  if (highlight) highlight.style.display = 'none'
  if (tooltip) tooltip.style.display = 'none'

  let screenshotBase64: string | null = null

  if (visionMode) {
    try {
      const { default: html2canvas } = await import('html2canvas')

      const rect = target.getBoundingClientRect()
      const padding = 200

      const canvas = await html2canvas(document.body, {
        x: 0,
        y: Math.max(0, rect.top + window.scrollY - padding),
        width: window.innerWidth,
        height: rect.height + padding * 2,
        scale: 2,
        useCORS: true,
        logging: false,
      })

      // Draw highlight outline
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const highlightY = Math.min(padding, rect.top + window.scrollY) * 2
        ctx.strokeStyle = '#00ff41'
        ctx.lineWidth = 4
        ctx.setLineDash([8, 4])
        ctx.strokeRect(rect.left * 2, highlightY, rect.width * 2, rect.height * 2)
      }

      const dataUrl = canvas.toDataURL('image/png', 0.8)
      screenshotBase64 = dataUrl.split(',')[1]
    } catch {
      // Screenshot failed — continue without it
    }
  }

  const rect = target.getBoundingClientRect()

  // Send raw data to parent — parent handles storage via adapter
  window.parent.postMessage(
    {
      type: 'va:element-selected',
      element: {
        selector: generateSelector(target),
        xpath: generateXPath(target),
        tag: target.tagName.toLowerCase(),
        textContent: (target.textContent ?? '').trim().slice(0, 100),
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      },
      computedStyles: captureComputedStyles(target),
      screenshotBase64,
      viewportWidth: window.innerWidth,
    },
    '*'
  )
}

function suppressDefault(e: Event) {
  e.preventDefault()
}

function startSelecting() {
  if (active) return
  active = true
  ensureDOM()
  document.addEventListener('mousemove', onMouseMove, { capture: true })
  document.addEventListener('mousedown', suppressDefault, { capture: true })
  document.addEventListener('touchstart', suppressDefault, { capture: true, passive: false })
  document.addEventListener('click', onClick, { capture: true })
}

function stopSelecting() {
  if (!active) return
  active = false
  document.removeEventListener('mousemove', onMouseMove, { capture: true })
  document.removeEventListener('mousedown', suppressDefault, { capture: true })
  document.removeEventListener('touchstart', suppressDefault, { capture: true })
  document.removeEventListener('click', onClick, { capture: true })
  if (highlight) highlight.style.display = 'none'
  if (tooltip) tooltip.style.display = 'none'
}

function onMessage(e: MessageEvent) {
  if (e.source !== window.parent) return

  const data = e.data
  if (!data || typeof data.type !== 'string') return

  switch (data.type) {
    case 'va:start-selecting':
      visionMode = !!data.visionMode
      startSelecting()
      break
    case 'va:stop-selecting':
      stopSelecting()
      break
  }
}

export function mountBridge() {
  window.addEventListener('message', onMessage)
}
