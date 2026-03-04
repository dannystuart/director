import { useContext } from 'preact/hooks'
import { AppContext } from '../context'

export function FloatingIcon() {
  const { state, dispatch } = useContext(AppContext)

  const positions: Record<string, { bottom?: string; top?: string; left?: string; right?: string }> = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
  }

  const config = (() => {
    try {
      const el = document.querySelector('[data-vibe-annotator-config]')
      return el ? JSON.parse(el.getAttribute('data-vibe-annotator-config') ?? '{}') : {}
    } catch { return {} }
  })()

  const pos = positions[config.position ?? 'bottom-right'] ?? positions['bottom-right']
  const isActive = state.mode !== 'inactive'

  const toggle = () => {
    if (state.mode === 'inactive') {
      dispatch({ type: 'SET_MODE', mode: 'selecting' })
    } else {
      dispatch({ type: 'SET_MODE', mode: 'inactive' })
      dispatch({ type: 'SET_ACTIVE', id: null })
    }
  }

  return (
    <button
      class={`va-floating-icon ${isActive ? 'va-floating-icon--active' : ''}`}
      style={pos}
      onClick={toggle}
      title={isActive ? 'Deactivate annotator' : 'Activate annotator'}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" />
        <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="1.5" />
        <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.5" />
        <line x1="6" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>
  )
}
