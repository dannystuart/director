import type { Annotation } from '../../shared/types'

/**
 * Filter annotations visible at the current viewport.
 * - Full mode (currentViewportWidth === null): show all pins
 * - Viewport mode: show Full mode pins (null) + matching viewport pins
 * - Legacy pins (viewportWidth === undefined): always visible
 */
export function filterVisibleAnnotations(
  annotations: Annotation[],
  currentViewportWidth: number | null
): Annotation[] {
  if (currentViewportWidth === null) return annotations
  return annotations.filter(
    (ann) => ann.viewportWidth == null || ann.viewportWidth === currentViewportWidth
  )
}
