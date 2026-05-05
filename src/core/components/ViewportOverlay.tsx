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

    console.log('[VA] ViewportOverlay effect mounted, width=', width)

    let handled = false

    const handleLoad = () => {
      if (handled) return
      handled = true
      console.log('[VA] iframe load fired, readyState=', iframe.contentDocument?.readyState)

      const iframeDoc = iframe.contentDocument

      const isBookmarkletMode = !!(window as { __vibeAnnotator?: unknown }).__vibeAnnotator
      console.log('[VA] isBookmarkletMode=', isBookmarkletMode)

      const allScripts = Array.from(document.querySelectorAll('script[src]'))
      console.log('[VA] parent scripts:', allScripts.map(s => (s as HTMLScriptElement).src))

      const directorScript = allScripts
        .find(s => {
          const src = (s as HTMLScriptElement).src
          return src.endsWith('/bookmarklet.global.js') || src.endsWith('/client.global.js')
        }) as HTMLScriptElement | undefined

      console.log('[VA] directorScript found:', directorScript?.src ?? 'NONE')

      if (isBookmarkletMode && iframeDoc && directorScript) {
        const s = iframeDoc.createElement('script')
        s.src = directorScript.src
        s.onload = () => {
          console.log('[VA] re-injected script loaded in iframe')
          dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
        }
        s.onerror = () => console.error('[VA] re-injected script FAILED to load in iframe')
        iframeDoc.head.appendChild(s)
        console.log('[VA] re-injected script appended')
      } else if (isBookmarkletMode) {
        console.warn('[VA] bookmarklet mode but Director script NOT found in parent')
        dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
      } else {
        console.log('[VA] vite plugin path — assuming bridge already in iframe')
        dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
      }
    }

    iframe.addEventListener('load', handleLoad)

    // Handle race: iframe may already be loaded before the listener attaches
    // (fast localhost). Skip the about:blank case — newly-created iframes show
    // about:blank with readyState=complete BEFORE navigating to src; calling
    // handleLoad then would inject the bridge into about:blank, which then
    // gets destroyed on the real navigation, leaving listeners on a dead doc.
    const doc = iframe.contentDocument
    if (
      doc?.readyState === 'complete' &&
      doc.location?.href !== 'about:blank'
    ) {
      console.log('[VA] iframe already loaded, calling handleLoad immediately')
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
