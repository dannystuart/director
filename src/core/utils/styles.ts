import type { ComputedStyles } from '../../shared/types'

const CAPTURED_PROPERTIES: (keyof ComputedStyles)[] = [
  'fontSize', 'fontWeight', 'fontFamily', 'color', 'backgroundColor',
  'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius',
  'border', 'width', 'height', 'display', 'flexDirection', 'alignItems',
  'justifyContent', 'gap', 'opacity', 'boxShadow', 'textAlign', 'textTransform',
]

export function captureComputedStyles(el: Element): ComputedStyles {
  const computed = getComputedStyle(el)
  const styles: ComputedStyles = {}

  for (const prop of CAPTURED_PROPERTIES) {
    const cssKey = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    const value = computed.getPropertyValue(cssKey)
    if (value) {
      styles[prop] = value
    }
  }

  return styles
}

export const QUICK_ACTION_STYLES: Record<string, (keyof ComputedStyles)[]> = {
  color: ['color', 'backgroundColor'],
  spacing: ['padding', 'margin', 'gap'],
  font: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'],
  align: ['display', 'flexDirection', 'alignItems', 'justifyContent', 'textAlign'],
}
