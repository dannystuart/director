import { useContext, useEffect, useState, useRef } from 'preact/hooks'
import { AppContext } from '../context'
import { resolveElement, resolveRect } from '../utils/resolveElement'
import type { Annotation } from '../../shared/types'

const PIN_SIZE = 22
const PIN_GAP = 4

interface PinMarkerProps {
  annotation: Annotation
  siblingIndex: number
}

export function PinMarker({ annotation, siblingIndex }: PinMarkerProps) {
  const { state, dispatch } = useContext(AppContext)
  const iframe = state.viewport.iframe
  const [pos, setPos] = useState({ x: annotation.element.boundingBox.x, y: annotation.element.boundingBox.y })
  const observerRef = useRef<MutationObserver | null>(null)
  const resizeRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const updatePos = () => {
      const el = resolveElement(annotation.element.selector, iframe)
      if (el) {
        const rect = resolveRect(el, iframe)
        setPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY })
      }
    }

    updatePos()

    // Observe mutations in the correct document
    const observeTarget = iframe
      ? iframe.contentDocument?.body ?? document.body
      : document.body
    observerRef.current = new MutationObserver(updatePos)
    observerRef.current.observe(observeTarget, { childList: true, subtree: true, attributes: true })

    const el = resolveElement(annotation.element.selector, iframe)
    if (el) {
      resizeRef.current = new ResizeObserver(updatePos)
      resizeRef.current.observe(el)
    }

    return () => {
      observerRef.current?.disconnect()
      resizeRef.current?.disconnect()
    }
  }, [annotation.element.selector, iframe])

  const handleClick = () => {
    dispatch({ type: 'SET_ACTIVE', id: annotation.id })
    dispatch({ type: 'SET_MODE', mode: annotation.processed ? 'reviewing' : 'annotating' })
  }

  const pinClass = annotation.processed
    ? 'va-pin va-pin--processed'
    : `va-pin va-pin--${annotation.priority}`

  return (
    <div
      class={pinClass}
      style={{ left: `${pos.x - 11 + siblingIndex * (PIN_SIZE + PIN_GAP)}px`, top: `${pos.y - 11}px` }}
      onClick={handleClick}
    >
      {annotation.number}
      {annotation.processed && <span class="va-pin-check">{'\u2713'}</span>}
      <span class="va-pin-tooltip">
        {annotation.comment || 'No comment'}
      </span>
    </div>
  )
}
