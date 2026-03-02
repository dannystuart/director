import { useContext, useEffect, useState, useRef } from 'preact/hooks'
import { AppContext } from '../context'
import type { Annotation } from '../../shared/types'

interface PinMarkerProps {
  annotation: Annotation
}

export function PinMarker({ annotation }: PinMarkerProps) {
  const { dispatch } = useContext(AppContext)
  const [pos, setPos] = useState({ x: annotation.element.boundingBox.x, y: annotation.element.boundingBox.y })
  const observerRef = useRef<MutationObserver | null>(null)
  const resizeRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const updatePos = () => {
      const el = document.querySelector(annotation.element.selector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY })
      }
    }

    updatePos()

    observerRef.current = new MutationObserver(updatePos)
    observerRef.current.observe(document.body, { childList: true, subtree: true, attributes: true })

    const el = document.querySelector(annotation.element.selector)
    if (el) {
      resizeRef.current = new ResizeObserver(updatePos)
      resizeRef.current.observe(el)
    }

    return () => {
      observerRef.current?.disconnect()
      resizeRef.current?.disconnect()
    }
  }, [annotation.element.selector])

  const handleClick = () => {
    dispatch({ type: 'SET_ACTIVE', id: annotation.id })
    dispatch({ type: 'SET_MODE', mode: 'annotating' })
  }

  const priorityClass = `va-pin--${annotation.priority}`

  return (
    <div
      class={`va-pin ${priorityClass}`}
      style={{ left: `${pos.x - 11}px`, top: `${pos.y - 11}px` }}
      onClick={handleClick}
    >
      {annotation.number}
      <span class="va-pin-tooltip">
        {annotation.comment || 'No comment'}
      </span>
    </div>
  )
}
