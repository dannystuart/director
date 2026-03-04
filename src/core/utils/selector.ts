/** CSS.escape with fallback for environments that lack it (e.g. jsdom) */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  // Simple fallback: escape characters that are not valid in CSS identifiers
  return value.replace(/([^\w-])/g, '\\$1')
}

const GENERIC_CLASSES = new Set([
  'active', 'disabled', 'hidden', 'visible', 'open', 'closed',
  'selected', 'focused', 'hover', 'container', 'wrapper', 'inner', 'outer',
])

export function generateSelector(el: Element): string {
  // Priority 1: data-testid
  const testId = el.getAttribute('data-testid')
  if (testId) return `[data-testid="${testId}"]`

  // Priority 2: id
  if (el.id && document.querySelectorAll(`#${cssEscape(el.id)}`).length === 1) {
    return `#${cssEscape(el.id)}`
  }

  // Priority 3: meaningful class path
  const classPath = buildClassPath(el)
  if (classPath && document.querySelectorAll(classPath).length === 1) {
    return classPath
  }

  // Priority 4: structural nth-child path
  return buildStructuralPath(el)
}

function buildClassPath(el: Element): string | null {
  const parts: string[] = []
  let current: Element | null = el

  for (let depth = 0; current && depth < 5; depth++) {
    const tag = current.tagName.toLowerCase()
    const meaningful = Array.from(current.classList).filter((c) => !GENERIC_CLASSES.has(c))

    if (meaningful.length > 0) {
      parts.unshift(`${tag}.${meaningful[0]}`)
    } else if (current.id) {
      parts.unshift(`#${cssEscape(current.id)}`)
      break
    } else {
      parts.unshift(tag)
    }

    current = current.parentElement
    if (current === document.body || current === document.documentElement) break
  }

  return parts.length > 0 ? parts.join(' > ') : null
}

function buildStructuralPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase()
    const parent = current.parentElement
    if (!parent) break

    const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName)
    if (siblings.length > 1) {
      const idx = siblings.indexOf(current) + 1
      parts.unshift(`${tag}:nth-child(${idx})`)
    } else {
      parts.unshift(tag)
    }

    current = parent
    if (current === document.body) break
  }

  return parts.join(' > ')
}

export function generateXPath(el: Element): string {
  const parts: string[] = []
  let current: Node | null = el

  while (current && current !== document) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element
      const tag = element.tagName.toLowerCase()
      const parent = element.parentNode
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === element.tagName)
        if (siblings.length > 1) {
          const idx = siblings.indexOf(element) + 1
          parts.unshift(`${tag}[${idx}]`)
        } else {
          parts.unshift(tag)
        }
      } else {
        parts.unshift(tag)
      }
    }
    current = current.parentNode
  }

  return '/' + parts.join('/')
}
