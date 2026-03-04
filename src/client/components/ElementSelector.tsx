import { useContext, useEffect, useRef, useCallback } from 'preact/hooks'
import { AppContext } from '../context'
import { generateSelector, generateXPath } from '../utils/selector'
import { captureComputedStyles } from '../utils/styles'
import { useScreenshot } from '../hooks/useScreenshot'

export function ElementSelector() {
  const { state, dispatch } = useContext(AppContext)
  const { capture } = useScreenshot()
  const highlightRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const isAnnotatorElement = useCallback((el: Element): boolean => {
    return !!el.closest('[data-vibe-annotator]')
  }, [])

  // Bridge mode: when viewport iframe is set, use postMessage instead of direct DOM listeners
  useEffect(() => {
    if (state.mode !== 'selecting') return
    if (!state.viewport.iframe) return

    const iframe = state.viewport.iframe

    // Tell the bridge to start selecting
    iframe.contentWindow?.postMessage(
      { type: 'va:start-selecting', visionMode: state.visionMode },
      '*'
    )

    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return
      const data = e.data
      if (!data || data.type !== 'va:element-selected') return

      const id = `ann_${Date.now()}`
      const number = state.annotations.length + 1

      const annotation = {
        id,
        number,
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        element: data.element,
        computedStyles: data.computedStyles,
        targetStyles: {},
        comment: '',
        quickActions: [],
        screenshot: data.screenshot ?? null,
        referenceImage: null,
        viewportWidth: state.viewport.width ?? null,
      }

      dispatch({ type: 'ADD_ANNOTATION', annotation })
      dispatch({ type: 'SET_ACTIVE', id })
      dispatch({ type: 'SET_MODE', mode: 'annotating' })
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
      iframe.contentWindow?.postMessage({ type: 'va:stop-selecting' }, '*')
    }
  }, [state.mode, state.annotations.length, dispatch, state.viewport.iframe, state.visionMode])

  // Direct mode: standard DOM listeners when no viewport iframe
  useEffect(() => {
    if (state.mode !== 'selecting') return
    if (state.viewport.iframe) return

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target || isAnnotatorElement(target)) {
        dispatch({ type: 'SET_HOVERED', element: null })
        if (highlightRef.current) highlightRef.current.style.display = 'none'
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        return
      }

      dispatch({ type: 'SET_HOVERED', element: target as HTMLElement })
      const rect = target.getBoundingClientRect()

      if (highlightRef.current) {
        highlightRef.current.style.display = 'block'
        highlightRef.current.style.top = `${rect.top}px`
        highlightRef.current.style.left = `${rect.left}px`
        highlightRef.current.style.width = `${rect.width}px`
        highlightRef.current.style.height = `${rect.height}px`
      }

      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'block'
        tooltipRef.current.style.top = `${rect.top - 24}px`
        tooltipRef.current.style.left = `${rect.left}px`
        const tag = target.tagName.toLowerCase()
        const cls = target.className && typeof target.className === 'string'
          ? '.' + target.className.split(' ').filter(Boolean).slice(0, 2).join('.')
          : ''
        tooltipRef.current.textContent = `${tag}${cls}`
      }
    }

    const onClick = async (e: MouseEvent) => {
      const target = e.target as Element
      if (!target || isAnnotatorElement(target)) return

      e.preventDefault()
      e.stopPropagation()

      // Capture screenshot before creating annotation
      const screenshot = await capture(target)

      const rect = target.getBoundingClientRect()
      const textContent = (target.textContent ?? '').trim().slice(0, 100)

      const id = `ann_${Date.now()}`
      const number = state.annotations.length + 1

      const annotation = {
        id,
        number,
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        element: {
          selector: generateSelector(target),
          xpath: generateXPath(target),
          tag: target.tagName.toLowerCase(),
          textContent,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        },
        computedStyles: captureComputedStyles(target),
        targetStyles: {},
        comment: '',
        quickActions: [],
        screenshot,
        referenceImage: null,
        viewportWidth: state.viewport.width ?? null,
      }

      dispatch({ type: 'ADD_ANNOTATION', annotation })
      dispatch({ type: 'SET_ACTIVE', id })
      dispatch({ type: 'SET_MODE', mode: 'annotating' })
    }

    document.addEventListener('mousemove', onMouseMove, { capture: true })
    document.addEventListener('click', onClick, { capture: true })

    return () => {
      document.removeEventListener('mousemove', onMouseMove, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
    }
  }, [state.mode, state.annotations.length, dispatch, isAnnotatorElement, capture, state.viewport.iframe, state.viewport.width])

  // Don't render highlight/tooltip when using bridge mode (iframe renders its own)
  if (state.viewport.iframe) return null

  return (
    <>
      <div ref={highlightRef} class="va-highlight" style={{ display: 'none' }} />
      <div ref={tooltipRef} class="va-highlight-tooltip" style={{ display: 'none' }} />
    </>
  )
}
