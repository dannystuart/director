import { render } from 'preact'
import { App } from './App'
import cssContent from 'virtual:inline-css'

function mount() {
  const container = document.createElement('div')
  container.setAttribute('data-vibe-annotator', '')
  document.body.appendChild(container)

  const style = document.createElement('style')
  style.textContent = cssContent
  container.appendChild(style)

  render(<App />, container)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
