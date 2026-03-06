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

    const handleLoad = () => {
      const iframeDoc = iframe.contentDocument

      // Find the Director script in the parent page (bookmarklet or client bundle)
      const directorScript = Array.from(document.querySelectorAll('script[src]'))
        .find(s => {
          const src = (s as HTMLScriptElement).src
          return src.includes('bookmarklet') || src.includes('client')
        }) as HTMLScriptElement | undefined

      if (iframeDoc && directorScript) {
        // Re-inject the script into the iframe so the bridge mounts
        // (mountApp detects iframe context and calls mountBridge)
        const s = iframeDoc.createElement('script')
        s.src = directorScript.src
        s.onload = () => dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
        iframeDoc.head.appendChild(s)
      } else {
        // Vite plugin case — bridge already injected by the plugin
        dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
      }
    }

    iframe.addEventListener('load', handleLoad)
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
