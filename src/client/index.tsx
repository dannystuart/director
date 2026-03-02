import { render } from 'preact'
import { App } from './App'

function mount() {
  const container = document.createElement('div')
  container.setAttribute('data-vibe-annotator', '')
  document.body.appendChild(container)

  render(<App />, container)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
