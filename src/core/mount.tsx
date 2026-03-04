import { render } from 'preact'
import { App } from './App'
import { StorageContext } from './StorageContext'
import { mountBridge } from './bridge'
import type { StorageAdapter } from '../shared/storage'
import cssContent from 'virtual:inline-css'

export function mountApp(adapter: StorageAdapter) {
  if (window.self !== window.top) {
    // Iframe: mount lightweight selection bridge only (no UI)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountBridge)
    } else {
      mountBridge()
    }
    return
  }

  // Normal: mount full app with storage adapter
  function mount() {
    const container = document.createElement('div')
    container.setAttribute('data-vibe-annotator', '')
    document.body.appendChild(container)

    const style = document.createElement('style')
    style.textContent = cssContent
    container.appendChild(style)

    render(
      <StorageContext.Provider value={adapter}>
        <App />
      </StorageContext.Provider>,
      container,
    )
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount)
  } else {
    mount()
  }
}
