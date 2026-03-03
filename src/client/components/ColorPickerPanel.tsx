import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { SidePanel } from './SidePanel'
import { extractPageColors } from '../utils/colorExtraction'
import type { DOMStateManager } from '../utils/domState'
import type { PageColors } from '../utils/colorExtraction'

type ColorProperty = 'color' | 'backgroundColor' | 'borderColor'

interface ColorPickerPanelProps {
  element: HTMLElement
  domState: DOMStateManager
  onApply: (change: {
    property: string
    from: string
    to: string
    tokenName: string | null
  }) => void
  onClose: () => void
}

const PROPERTY_LABELS: Record<ColorProperty, string> = {
  color: 'Text',
  backgroundColor: 'BG',
  borderColor: 'Border',
}

const CSS_PROP_MAP: Record<ColorProperty, string> = {
  color: 'color',
  backgroundColor: 'background-color',
  borderColor: 'border-color',
}

function getDefaultProperty(element: HTMLElement): ColorProperty {
  const bg = getComputedStyle(element).backgroundColor
  if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
    return 'backgroundColor'
  }
  return 'color'
}

function isValidColor(value: string): boolean {
  if (!value) return false
  const s = new Option().style
  s.color = value
  return s.color !== ''
}

export function ColorPickerPanel({ element, domState, onApply, onClose }: ColorPickerPanelProps) {
  const [property, setProperty] = useState<ColorProperty>(getDefaultProperty(element))
  const [colors, setColors] = useState<PageColors>({ tokens: [], usedColors: [] })
  const [hexInput, setHexInput] = useState('')
  const [activeTokenName, setActiveTokenName] = useState<string | null>(null)

  useEffect(() => {
    setColors(extractPageColors())
  }, [])

  const originalColor = getComputedStyle(element).getPropertyValue(CSS_PROP_MAP[property])

  const previewColor = (value: string, tokenName: string | null = null) => {
    setActiveTokenName(tokenName)
    setHexInput(value)
    domState.preview(element, {
      type: 'css',
      css: { [CSS_PROP_MAP[property]]: value },
    })
  }

  const handleApply = () => {
    onApply({
      property: CSS_PROP_MAP[property],
      from: originalColor,
      to: hexInput,
      tokenName: activeTokenName,
    })
  }

  return (
    <SidePanel title="COLOR" onClose={onClose}>
      {/* Property tabs */}
      <div class="va-color-tabs">
        {(['color', 'backgroundColor', 'borderColor'] as ColorProperty[]).map((p) => (
          <button
            key={p}
            class={`va-color-tab ${p === property ? 'va-color-tab--active' : ''}`}
            onClick={() => setProperty(p)}
          >
            {PROPERTY_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Design tokens */}
      {colors.tokens.length > 0 && (
        <div class="va-color-section">
          <div class="va-color-section-label">DESIGN TOKENS</div>
          {colors.tokens.map((token) => (
            <button
              key={token.name}
              class="va-color-token-row"
              onClick={() => previewColor(token.value, token.name)}
            >
              <span class="va-color-swatch" style={{ backgroundColor: token.value }} />
              <span class="va-color-token-name">{token.name}</span>
              <span class="va-color-token-value">{token.value}</span>
            </button>
          ))}
        </div>
      )}

      {/* Page colors */}
      <div class="va-color-section">
        <div class="va-color-section-label">PAGE COLORS</div>
        <div class="va-color-grid">
          {colors.usedColors.slice(0, 16).map((c) => (
            <button
              key={c.value}
              class="va-color-swatch va-color-swatch--btn"
              style={{ backgroundColor: c.value }}
              title={c.value}
              onClick={() => previewColor(c.value)}
            />
          ))}
        </div>
      </div>

      {/* Hex input */}
      <div class="va-color-section">
        <input
          class="va-color-hex-input"
          type="text"
          placeholder="#000000"
          value={hexInput}
          onInput={(e) => {
            const val = (e.target as HTMLInputElement).value
            setHexInput(val)
            if (isValidColor(val)) {
              setActiveTokenName(null)
              domState.preview(element, {
                type: 'css',
                css: { [CSS_PROP_MAP[property]]: val },
              })
            }
          }}
        />
      </div>

      <button class="va-btn va-btn--apply" onClick={handleApply} disabled={!hexInput}>
        APPLY
      </button>
    </SidePanel>
  )
}
