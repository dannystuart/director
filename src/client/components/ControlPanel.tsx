import { useContext, useState } from 'preact/hooks'
import { AppContext } from '../context'
import { buildExportMarkdown } from '../utils/export'
import { saveAnnotation, deleteAnnotation } from '../utils/api'

const VIEWPORT_PRESETS = [
  { label: '375', width: 375 },
  { label: '768', width: 768 },
  { label: '1024', width: 1024 },
  { label: 'Full', width: null as number | null },
]

export function ControlPanel() {
  const { state, dispatch } = useContext(AppContext)
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const unprocessed = state.annotations.filter((a) => !a.processed)

  const handleCopy = async () => {
    if (unprocessed.length === 0) return
    const md = buildExportMarkdown(state.annotations)
    await navigator.clipboard.writeText(md)

    const ids = unprocessed.map((a) => a.id)
    dispatch({ type: 'MARK_PROCESSED', ids })

    // Persist each newly-processed annotation
    for (const ann of unprocessed) {
      await saveAnnotation({ ...ann, processed: true })
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 2000)
      return
    }
    setConfirmClear(false)
    for (const ann of state.annotations) {
      await deleteAnnotation(ann.id)
    }
    dispatch({ type: 'SET_ANNOTATIONS', annotations: [] })
    dispatch({ type: 'SET_ACTIVE', id: null })
  }

  const toggleVision = () => {
    dispatch({ type: 'SET_VISION_MODE', enabled: !state.visionMode })
  }

  return (
    <div class="va-control-panel">
      {VIEWPORT_PRESETS.map((p) => (
        <button
          key={p.label}
          class={`va-viewport-preset ${state.viewport.width === p.width ? 'va-viewport-preset--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_VIEWPORT', width: p.width })}
        >
          {p.label}
        </button>
      ))}
      <label class={`va-toggle ${state.visionMode ? 'va-toggle--active' : ''}`} onClick={toggleVision}>
        <span class="va-toggle-box">{state.visionMode ? '\u25A0' : ''}</span>
        VISION
      </label>
      <button
        class="va-btn va-btn--primary"
        onClick={handleCopy}
        disabled={unprocessed.length === 0}
      >
        {copied ? 'COPIED!' : `COPY (${unprocessed.length})`}
      </button>
      <button
        class="va-btn va-btn--danger"
        onClick={handleClearAll}
        disabled={state.annotations.length === 0}
      >
        {confirmClear ? 'SURE?' : 'CLEAR ALL'}
      </button>
    </div>
  )
}
