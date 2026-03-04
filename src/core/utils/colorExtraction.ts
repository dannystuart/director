export interface ColorToken {
  name: string
  value: string
}

export interface UsedColor {
  value: string
  count: number
}

export interface PageColors {
  tokens: ColorToken[]
  usedColors: UsedColor[]
}

const NAMED_COLORS = new Set([
  'red', 'blue', 'green', 'black', 'white', 'gray', 'grey',
  'orange', 'yellow', 'purple', 'pink', 'transparent', 'inherit',
  'currentcolor',
])

export function isColorValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const v = value.trim().toLowerCase()
  if (v.startsWith('#')) return /^#[0-9a-f]{3,8}$/.test(v)
  if (v.startsWith('rgb')) return /^rgba?\(/.test(v)
  if (v.startsWith('hsl')) return /^hsla?\(/.test(v)
  if (NAMED_COLORS.has(v)) return true
  return false
}

function extractCSSTokens(): ColorToken[] {
  const tokens: ColorToken[] = []
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i]
              if (prop.startsWith('--')) {
                const value = rule.style.getPropertyValue(prop).trim()
                if (isColorValue(value)) {
                  tokens.push({ name: prop, value })
                }
              }
            }
          }
        }
      } catch {
        // CORS: skip cross-origin stylesheets
      }
    }
  } catch {
    // No stylesheets accessible
  }
  return tokens
}

function extractUsedColors(): UsedColor[] {
  const colorMap = new Map<string, number>()
  const elements = document.querySelectorAll('*')
  const limit = Math.min(elements.length, 200)
  const COLOR_PROPS = ['color', 'background-color', 'border-color']

  for (let i = 0; i < limit; i++) {
    const styles = getComputedStyle(elements[i])
    for (const prop of COLOR_PROPS) {
      const value = styles.getPropertyValue(prop)
      if (value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)') {
        colorMap.set(value, (colorMap.get(value) ?? 0) + 1)
      }
    }
  }

  return Array.from(colorMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
}

let cachedColors: PageColors | null = null

export function extractPageColors(forceRefresh = false): PageColors {
  if (cachedColors && !forceRefresh) return cachedColors
  cachedColors = {
    tokens: extractCSSTokens(),
    usedColors: extractUsedColors(),
  }
  return cachedColors
}

export function clearColorCache(): void {
  cachedColors = null
}
