import { h } from 'preact'
import { useEffect, useRef, useContext } from 'preact/hooks'
import { AppContext } from '../context'

interface ViewportOverlayProps {
  width: number
}

export function ViewportOverlay({ width }: ViewportOverlayProps) {
  const { dispatch } = useContext(AppContext)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    let handled = false

    const handleLoad = () => {
      if (handled) return
      handled = true

      const iframeDoc = iframe.contentDocument

      // Bookmarklet mode sets window.__vibeAnnotator; vite plugin does not.
      // In bookmarklet mode we MUST find and re-inject the Director script
      // because the iframe loads the bare page URL with no Director code.
      const isBookmarkletMode = !!(window as { __vibeAnnotator?: unknown }).__vibeAnnotator

      // Match exact known filenames so we don't accidentally pick up
      // framework scripts (e.g. Next.js _next/.../client.js, react-dom-client).
      const directorScript = Array.from(document.querySelectorAll('script[src]'))
        .find(s => {
          const src = (s as HTMLScriptElement).src
          return src.endsWith('/bookmarklet.global.js') || src.endsWith('/client.global.js')
        }) as HTMLScriptElement | undefined

      if (isBookmarkletMode && iframeDoc && directorScript) {
        const s = iframeDoc.createElement('script')
        s.src = directorScript.src
        s.onload = () => dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
        iframeDoc.head.appendChild(s)
      } else if (isBookmarkletMode) {
        console.warn(
          '[vibe-annotator] Bookmarklet mode detected but Director script not found in parent. ' +
          'Viewport iframe selection will not work.'
        )
        dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
      } else {
        // Vite plugin case — bridge already injected by the plugin
        dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
      }
    }

    iframe.addEventListener('load', handleLoad)

    // Handle race: on fast localhost loads the iframe may already be ready
    // by the time this effect runs, so the load event fires before we attach.
    if (iframe.contentDocument?.readyState === 'complete') {
      handleLoad()
    }

    return () => {
      iframe.removeEventListener('load', handleLoad)
      dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe: null })
    }
  }, [width])

  return (
    <div class="va-viewport-overlay">
      <div class="va-viewport-frame" style={{ width: `${width}px` }}>
        <div class="va-viewport-label">{width}px</div>
        <iframe
          key={width}
          ref={iframeRef}
          class="va-viewport-iframe"
          src={window.location.href}
          style={{ width: `${width}px` }}
        />
      </div>
    </div>
  )
}
