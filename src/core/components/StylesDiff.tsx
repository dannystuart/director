import { useState } from 'preact/hooks'
import type { ComputedStyles } from '../../shared/types'

interface StylesDiffProps {
  computedStyles: ComputedStyles
  targetStyles: Partial<ComputedStyles>
  onTargetChange: (key: keyof ComputedStyles, value: string) => void
}

const STYLE_KEYS: (keyof ComputedStyles)[] = [
  'fontSize', 'fontWeight', 'fontFamily', 'color', 'backgroundColor',
  'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius',
  'border', 'width', 'height', 'display', 'flexDirection', 'alignItems',
  'justifyContent', 'gap', 'opacity', 'boxShadow', 'textAlign', 'textTransform',
]

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

export function StylesDiff({ computedStyles, targetStyles, onTargetChange }: StylesDiffProps) {
  const [expanded, setExpanded] = useState(false)

  const rows = STYLE_KEYS.filter((key) => computedStyles[key])

  return (
    <div class="va-styles-diff">
      <button class="va-styles-diff-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? '\u25BC' : '\u25B6'} Target styles
      </button>
      {expanded && (
        <table class="va-styles-diff-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Current</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => {
              const current = computedStyles[key] ?? ''
              const target = targetStyles[key] ?? ''
              const changed = target && target !== current
              return (
                <tr key={key}>
                  <td>{camelToKebab(key)}</td>
                  <td>{current}</td>
                  <td>
                    <input
                      class={`va-styles-diff-input ${changed ? 'va-styles-diff-changed' : ''}`}
                      value={target}
                      placeholder={current}
                      onInput={(e) => onTargetChange(key, (e.target as HTMLInputElement).value)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
