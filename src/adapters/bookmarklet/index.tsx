import { mountApp } from '../../core/mount'
import { MemoryStorage } from './MemoryStorage'

declare global {
  interface Window {
    __vibeAnnotator?: {
      toggle: () => void
    }
  }
}

function init() {
  // Toggle if already loaded
  if (window.__vibeAnnotator) {
    window.__vibeAnnotator.toggle()
    return
  }

  const storage = new MemoryStorage()
  mountApp(storage)

  // Register toggle for subsequent bookmarklet clicks
  const container = document.querySelector('[data-vibe-annotator]') as HTMLElement | null
  let visible = true

  window.__vibeAnnotator = {
    toggle() {
      if (container) {
        visible = !visible
        container.style.display = visible ? '' : 'none'
      }
    },
  }
}

init()
