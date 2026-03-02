import type { Annotation, ComputedStyles } from '../../shared/types'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

export function buildExportMarkdown(annotations: Annotation[]): string {
  const sorted = [...annotations].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  )

  const count = sorted.length
  const lines: string[] = [
    `I have ${count} UI annotation${count !== 1 ? 's' : ''} to implement. Annotations are ordered by priority.`,
    '',
    'Screenshots and reference images are in .ui-annotations/',
    '',
    '---',
  ]

  for (const ann of sorted) {
    lines.push('')
    lines.push(`## Annotation ${ann.number} (${ann.priority.toUpperCase()}) \u2014 ${ann.element.tag}${ann.element.selector.includes('.') ? '.' + ann.element.selector.split('.').pop() : ''}`)
    lines.push('')
    lines.push(`**Element:** \`${ann.element.tag}\``)
    lines.push(`**Selector:** \`${ann.element.selector}\``)
    if (ann.element.textContent) {
      lines.push(`**Current text:** "${ann.element.textContent}"`)
    }
    lines.push('')

    const changes = Object.entries(ann.targetStyles).filter(
      ([key, val]) => val && val !== ann.computedStyles[key as keyof ComputedStyles]
    )
    if (changes.length > 0) {
      lines.push('**Style changes:**')
      for (const [key, val] of changes) {
        const current = ann.computedStyles[key as keyof ComputedStyles] ?? 'unset'
        lines.push(`- ${camelToKebab(key)}: ${current} \u2192 ${val}`)
      }
    } else if (ann.quickActions.length > 0) {
      const relevantStyles = Object.entries(ann.computedStyles)
      if (relevantStyles.length > 0) {
        lines.push('**Current styles:**')
        for (const [key, val] of relevantStyles) {
          lines.push(`- ${camelToKebab(key)}: ${val}`)
        }
      }
    }

    lines.push('')

    if (ann.quickActionIntents.length > 0) {
      lines.push(`**Intent:** ${ann.quickActionIntents.join(', ')}`)
    }
    if (ann.comment) {
      lines.push(`**Comment:** "${ann.comment}"`)
    }

    if (ann.screenshot) {
      lines.push('')
      lines.push(`**Screenshot:** .ui-annotations/${ann.screenshot}`)
    }
    if (ann.referenceImage) {
      lines.push(`**Reference image:** .ui-annotations/${ann.referenceImage}`)
    }

    lines.push('')
    lines.push('---')
  }

  return lines.join('\n')
}
