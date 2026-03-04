import { render } from 'preact'
import { App } from './App'
import cssContent from 'virtual:inline-css'
import { mountBridge } from './bridge'

function mount() {
  const container = document.createElement('div')
  container.setAttribute('data-vibe-annotator', '')
  document.body.appendChild(container)

  const style = document.createElement('style')
  style.textContent = cssContent
  container.appendChild(style)

  render(<App />, container)
}

if (window.self !== window.top) {
  // Iframe: mount lightweight selection bridge only (no UI)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBridge)
  } else {
    mountBridge()
  }
} else {
  // Normal: mount full app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount)
  } else {
    mount()
  }
}
