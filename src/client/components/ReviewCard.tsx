import { useContext, useState } from 'preact/hooks'
import { AppContext } from '../context'
import { deleteAnnotation, saveAnnotation, imageUrl } from '../utils/api'
import type { ComputedStyles } from '../../shared/types'

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function computeCardPosition(box: { x: number; y: number; width: number; height: number }) {
  const cardWidth = 360
  const cardMaxHeight = window.innerHeight * 0.8
  const gap = 12
  const margin = 8
  const vw = window.innerWidth
  const vh = window.innerHeight

  const clampTop = (y: number) => Math.min(Math.max(margin, y), vh - cardMaxHeight - margin)

  if (box.x + box.width + gap + cardWidth < vw) {
    return { left: `${box.x + box.width + gap}px`, top: `${clampTop(box.y)}px` }
  }
  if (box.x - gap - cardWidth > 0) {
    return { left: `${box.x - gap - cardWidth}px`, top: `${clampTop(box.y)}px` }
  }
  if (box.y + box.height + gap + cardMaxHeight < vh) {
    return { left: `${Math.max(margin, box.x)}px`, top: `${box.y + box.height + gap}px` }
  }
  return { left: `${Math.max(margin, box.x)}px`, bottom: `${vh - box.y + gap}px` }
}

export function ReviewCard() {
  const { state, dispatch } = useContext(AppContext)
  const annotation = state.annotations.find((a) => a.id === state.activeAnnotation)
  const [stylesExpanded, setStylesExpanded] = useState(false)

  if (!annotation) return null

  const handleClose = () => {
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  const handleResolve = async () => {
    await deleteAnnotation(annotation.id)
    dispatch({ type: 'REMOVE_ANNOTATION', id: annotation.id })
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  const handleRework = async () => {
    const updated = { ...annotation, processed: false }
    await saveAnnotation(updated)
    dispatch({ type: 'UPDATE_ANNOTATION', annotation: updated })
    dispatch({ type: 'SET_ACTIVE', id: annotation.id })
    dispatch({ type: 'SET_MODE', mode: 'annotating' })
  }

  const cardStyle = computeCardPosition(annotation.element.boundingBox)

  const styleChanges = Object.entries(annotation.targetStyles).filter(
    ([key, val]) => val && val !== annotation.computedStyles[key as keyof ComputedStyles]
  )

  return (
    <div class="va-review-card" style={cardStyle}>
      <div class="va-card-header">
        <span>#{annotation.number} {annotation.element.tag}.{annotation.element.selector.split('.').pop() ?? ''}</span>
        <button class="va-card-close" onClick={handleClose}>{'\u2715'}</button>
      </div>

      <div class="va-review-field">
        <div class="va-review-field-label">Element</div>
        <code>{annotation.element.selector}</code>
      </div>

      {annotation.quickActions.length > 0 && (
        <div class="va-review-pills">
          {annotation.quickActions.map((qa) => (
            <span key={`${qa.category}:${qa.detail}`} class="va-review-pill">
              {qa.category}: {qa.detail}
            </span>
          ))}
        </div>
      )}

      {annotation.comment && (
        <div class="va-review-field">
          <div class="va-review-field-label">Comment</div>
          {annotation.comment}
        </div>
      )}

      <div class="va-review-field">
        <div class="va-review-field-label">Priority</div>
        <span class={`va-priority-btn va-priority-btn--${annotation.priority} va-priority-btn--active`} style={{ cursor: 'default' }}>
          {annotation.priority.toUpperCase()}
        </span>
      </div>

      {styleChanges.length > 0 && (
        <div class="va-styles-diff">
          <button class="va-styles-diff-toggle" onClick={() => setStylesExpanded(!stylesExpanded)}>
            {stylesExpanded ? '\u25BC' : '\u25B6'} Target styles ({styleChanges.length})
          </button>
          {stylesExpanded && (
            <table class="va-styles-diff-table">
              <thead>
                <tr><th>Property</th><th>Current</th><th>Target</th></tr>
              </thead>
              <tbody>
                {styleChanges.map(([key, val]) => (
                  <tr key={key}>
                    <td>{camelToKebab(key)}</td>
                    <td>{annotation.computedStyles[key as keyof ComputedStyles] ?? ''}</td>
                    <td class="va-styles-diff-changed">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(annotation.screenshot || annotation.referenceImage) && (
        <div class="va-review-field">
          {annotation.screenshot && (
            <div class="va-ref-thumb">
              <img src={imageUrl(annotation.screenshot)} alt="Screenshot" />
            </div>
          )}
          {annotation.referenceImage && (
            <div class="va-ref-thumb" style={{ marginLeft: annotation.screenshot ? '8px' : '0' }}>
              <img src={imageUrl(annotation.referenceImage)} alt="Reference" />
            </div>
          )}
        </div>
      )}

      <div class="va-review-actions">
        <button class="va-btn va-btn--danger" onClick={handleResolve}>RESOLVE</button>
        <button class="va-btn va-btn--rework" onClick={handleRework}>REWORK</button>
      </div>
    </div>
  )
}
