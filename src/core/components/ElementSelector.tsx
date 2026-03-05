import { useContext, useEffect, useRef, useCallback, useState } from 'preact/hooks'
import { AppContext } from '../context'
import { useStorage } from '../StorageContext'
import { generateSelector, generateXPath } from '../utils/selector'
import { captureComputedStyles } from '../utils/styles'
import { useScreenshot } from '../hooks/useScreenshot'

interface AncestorEntry {
  element: Element
  label: string
}

function buildAncestorChain(el: Element, limit = 4): AncestorEntry[] {
  const chain: AncestorEntry[] = []
  let cur = el.parentElement
  while (cur && chain.length < limit) {
    const tag = cur.tagName.toLowerCase()
    if (tag === 'html' || tag === 'body') break
    // Skip annotator-internal elements
    if (cur.closest('[data-vibe-annotator]')) break
    const cls = cur.className && typeof cur.className === 'string'
      ? '.' + cur.className.split(' ').filter(Boolean)[0]
      : ''
    chain.push({ element: cur, label: `${tag}${cls}` })
    cur = cur.parentElement
  }
  // Reverse so outermost ancestor is first
  return chain.reverse()
}

function elementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.')
    : ''
  return `${tag}${cls}`
}

export function ElementSelector() {
  const { state, dispatch } = useContext(AppContext)
  const storage = useStorage()
  const { capture } = useScreenshot()
  const highlightRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const breadcrumbRef = useRef<HTMLDivElement>(null)
  const lastTargetRef = useRef<Element | null>(null)
  const breadcrumbHoveredRef = useRef<Element | null>(null)
  const ancestorsRef = useRef<AncestorEntry[]>([])
  const rebuildTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ancestors, setAncestors] = useState<AncestorEntry[]>([])
  const [currentLabel, setCurrentLabel] = useState('')

  const isAnnotatorElement = useCallback((el: Element): boolean => {
    return !!el.closest('[data-vibe-annotator]')
  }, [])

  const selectElement = useCallback(async (target: Element) => {
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
  }, [capture, state.annotations.length, state.viewport.width, dispatch])

  const positionHighlight = useCallback((el: Element) => {
    const rect = el.getBoundingClientRect()
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
      tooltipRef.current.textContent = elementLabel(el)
    }
  }, [])

  const positionBreadcrumb = useCallback((el: Element) => {
    const rect = el.getBoundingClientRect()
    if (breadcrumbRef.current) {
      breadcrumbRef.current.style.display = 'flex'
      let top = rect.bottom + 4
      // Clamp to viewport bottom
      const bcHeight = breadcrumbRef.current.offsetHeight || 24
      if (top + bcHeight > window.innerHeight) {
        top = rect.top - bcHeight - 4
      }
      // Clamp to viewport top
      if (top < 0) top = 0
      let left = rect.left
      // Clamp to viewport right
      const bcWidth = breadcrumbRef.current.offsetWidth || 200
      if (left + bcWidth > window.innerWidth) {
        left = window.innerWidth - bcWidth - 4
      }
      if (left < 0) left = 0
      breadcrumbRef.current.style.top = `${top}px`
      breadcrumbRef.current.style.left = `${left}px`
    }
  }, [])

  const hideBreadcrumb = useCallback(() => {
    if (breadcrumbRef.current) breadcrumbRef.current.style.display = 'none'
    ancestorsRef.current = []
    setAncestors([])
    setCurrentLabel('')
    lastTargetRef.current = null
    breadcrumbHoveredRef.current = null
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

    const onMessage = async (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return
      const data = e.data
      if (!data || data.type !== 'va:element-selected') return

      // Save screenshot via storage adapter if bridge captured one
      let screenshot: string | null = null
      if (data.screenshotBase64) {
        try {
          screenshot = await storage.saveImage(data.screenshotBase64)
        } catch {
          // Screenshot save failed — continue without it
        }
      }

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
        screenshot,
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

    const rebuildFor = (target: Element) => {
      lastTargetRef.current = target
      breadcrumbHoveredRef.current = null

      dispatch({ type: 'SET_HOVERED', element: target as HTMLElement })
      positionHighlight(target)

      const chain = buildAncestorChain(target)
      ancestorsRef.current = chain
      setAncestors(chain)
      setCurrentLabel(elementLabel(target))

      if (chain.length > 0) {
        positionBreadcrumb(target)
      } else {
        if (breadcrumbRef.current) breadcrumbRef.current.style.display = 'none'
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target) return

      if (isAnnotatorElement(target)) {
        // If hovering inside the breadcrumb, cancel any pending rebuild and keep current state
        if (breadcrumbRef.current?.contains(target)) {
          if (rebuildTimeoutRef.current) {
            clearTimeout(rebuildTimeoutRef.current)
            rebuildTimeoutRef.current = null
          }
          return
        }
        // Otherwise hide everything
        if (rebuildTimeoutRef.current) {
          clearTimeout(rebuildTimeoutRef.current)
          rebuildTimeoutRef.current = null
        }
        dispatch({ type: 'SET_HOVERED', element: null })
        if (highlightRef.current) highlightRef.current.style.display = 'none'
        if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        hideBreadcrumb()
        return
      }

      // Avoid rebuilding when still on same element
      if (target === lastTargetRef.current) return

      // Always debounce rebuilds to prevent rapid highlight switching
      // between nested elements — longer delay when breadcrumb is visible
      // so the user can reach it
      const breadcrumbVisible = breadcrumbRef.current?.style.display !== 'none' && ancestorsRef.current.length > 0
      const delay = breadcrumbVisible ? 150 : 60
      if (rebuildTimeoutRef.current) clearTimeout(rebuildTimeoutRef.current)
      rebuildTimeoutRef.current = setTimeout(() => {
        rebuildTimeoutRef.current = null
        rebuildFor(target)
      }, delay)
    }

    const onClick = async (e: MouseEvent) => {
      const target = e.target as Element
      if (!target) return

      // Check for breadcrumb item click before the annotator-element early return
      const bcItem = (target as HTMLElement).closest?.('[data-va-breadcrumb-idx]')
      if (bcItem) {
        e.preventDefault()
        e.stopPropagation()
        const idx = parseInt(bcItem.getAttribute('data-va-breadcrumb-idx') ?? '', 10)
        const ancestor = ancestorsRef.current[idx]
        if (ancestor) {
          hideBreadcrumb()
          await selectElement(ancestor.element)
        }
        return
      }

      if (isAnnotatorElement(target)) return

      e.preventDefault()
      e.stopPropagation()
      hideBreadcrumb()
      await selectElement(target)
    }

    // Suppress default behavior (link navigation, form submit, etc.) early
    // by intercepting mousedown/touchstart before the browser can act on them
    const suppressDefault = (e: Event) => {
      const target = e.target as Element
      if (!target || isAnnotatorElement(target)) return
      e.preventDefault()
    }

    document.addEventListener('mousemove', onMouseMove, { capture: true })
    document.addEventListener('mousedown', suppressDefault, { capture: true })
    document.addEventListener('touchstart', suppressDefault, { capture: true })
    document.addEventListener('click', onClick, { capture: true })

    return () => {
      document.removeEventListener('mousemove', onMouseMove, { capture: true })
      document.removeEventListener('mousedown', suppressDefault, { capture: true })
      document.removeEventListener('touchstart', suppressDefault, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
      if (rebuildTimeoutRef.current) {
        clearTimeout(rebuildTimeoutRef.current)
        rebuildTimeoutRef.current = null
      }
      hideBreadcrumb()
    }
  }, [state.mode, state.annotations.length, dispatch, isAnnotatorElement, capture, state.viewport.iframe, state.viewport.width, selectElement, positionHighlight, positionBreadcrumb, hideBreadcrumb])

  const onBreadcrumbItemEnter = useCallback((element: Element) => {
    breadcrumbHoveredRef.current = element
    positionHighlight(element)
  }, [positionHighlight])

  const onBreadcrumbItemLeave = useCallback(() => {
    breadcrumbHoveredRef.current = null
    if (lastTargetRef.current) {
      positionHighlight(lastTargetRef.current)
    }
  }, [positionHighlight])

  // Don't render highlight/tooltip when using bridge mode (iframe renders its own)
  if (state.viewport.iframe) return null

  return (
    <>
      <div ref={highlightRef} class="va-highlight" style={{ display: 'none' }} />
      <div ref={tooltipRef} class="va-highlight-tooltip" style={{ display: 'none' }} />
      <div ref={breadcrumbRef} class="va-breadcrumb" style={{ display: 'none' }}>
        {ancestors.map((a, i) => (
          <>
            {i > 0 && <span class="va-breadcrumb-sep">{'>'}</span>}
            <button
              class="va-breadcrumb-item"
              data-va-breadcrumb-idx={i}
              onMouseEnter={() => onBreadcrumbItemEnter(a.element)}
              onMouseLeave={onBreadcrumbItemLeave}
            >
              {a.label}
            </button>
          </>
        ))}
        {ancestors.length > 0 && <span class="va-breadcrumb-sep">{'>'}</span>}
        {currentLabel && <span class="va-breadcrumb-current">{currentLabel}</span>}
      </div>
    </>
  )
}
