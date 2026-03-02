import { useContext, useState } from 'preact/hooks'
import { AppContext } from '../context'
import { buildExportMarkdown } from '../utils/export'

export function ControlPanel() {
  const { state, dispatch } = useContext(AppContext)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (state.annotations.length === 0) return
    const md = buildExportMarkdown(state.annotations)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toggleVision = () => {
    dispatch({ type: 'SET_VISION_MODE', enabled: !state.visionMode })
  }

  return (
    <div class="va-control-panel">
      <label class={`va-toggle ${state.visionMode ? 'va-toggle--active' : ''}`} onClick={toggleVision}>
        <span class="va-toggle-box">{state.visionMode ? '\u25A0' : ''}</span>
        VISION
      </label>
      <button
        class="va-btn va-btn--primary"
        onClick={handleCopy}
        disabled={state.annotations.length === 0}
      >
        {copied ? 'COPIED!' : `COPY (${state.annotations.length})`}
      </button>
    </div>
  )
}
