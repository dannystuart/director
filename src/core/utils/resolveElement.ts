/**
 * Resolve an element by CSS selector, checking inside an iframe if provided.
 * Falls back to parent document when no iframe is set.
 */
export function resolveElement(
  selector: string,
  iframe: HTMLIFrameElement | null,
): HTMLElement | null {
  if (iframe) {
    try {
      return iframe.contentDocument?.querySelector(selector) as HTMLElement | null
    } catch {
      return null // cross-origin or detached iframe
    }
  }
  return document.querySelector(selector) as HTMLElement | null
}

/**
 * Get a bounding rect for an element, mapped to parent viewport coordinates
 * when inside an iframe. Returns the element's normal rect when no iframe.
 */
export function resolveRect(
  element: HTMLElement,
  iframe: HTMLIFrameElement | null,
): DOMRect {
  const elRect = element.getBoundingClientRect()
  if (!iframe) return elRect

  const iframeRect = iframe.getBoundingClientRect()
  return new DOMRect(
    iframeRect.left + elRect.left,
    iframeRect.top + elRect.top,
    elRect.width,
    elRect.height,
  )
}

/**
 * Get computed style using the element's own window context.
 * Works correctly for elements inside iframes (same-origin).
 */
export function getComputedStyleSafe(element: HTMLElement): CSSStyleDeclaration {
  const view = element.ownerDocument.defaultView ?? window
  return view.getComputedStyle(element)
}
