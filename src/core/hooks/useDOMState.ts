import { useRef } from 'preact/hooks'
import { DOMStateManager } from '../utils/domState'

export function useDOMState() {
  const ref = useRef<DOMStateManager | null>(null)
  if (!ref.current) {
    ref.current = new DOMStateManager()
  }
  return ref.current
}
