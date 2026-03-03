import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { SidePanel } from './SidePanel'
import { StyleSlider } from './StyleSlider'
import type { DOMStateManager } from '../utils/domState'

type PanelType = 'font' | 'spacing'

interface StyleSlidersPanelProps {
  type: PanelType
  element: HTMLElement
  domState: DOMStateManager
  onApply: (changes: Record<string, string>) => void
  onClose: () => void
}

interface SliderConfig {
  property: string
  label: string
  min: number
  max: number
  step: number
  unit: string
}

const FONT_SLIDERS: SliderConfig[] = [
  { property: 'font-size', label: 'font-size', min: 0, max: 120, step: 1, unit: 'px' },
  { property: 'font-weight', label: 'font-weight', min: 100, max: 900, step: 100, unit: '' },
  { property: 'line-height', label: 'line-height', min: 0, max: 4, step: 0.1, unit: '' },
  { property: 'letter-spacing', label: 'letter-spacing', min: -5, max: 20, step: 0.5, unit: 'px' },
]

const SPACING_SLIDERS: SliderConfig[] = [
  { property: 'padding-top', label: 'padding-top', min: 0, max: 200, step: 1, unit: 'px' },
  { property: 'padding-right', label: 'padding-right', min: 0, max: 200, step: 1, unit: 'px' },
  { property: 'padding-bottom', label: 'padding-bottom', min: 0, max: 200, step: 1, unit: 'px' },
  { property: 'padding-left', label: 'padding-left', min: 0, max: 200, step: 1, unit: 'px' },
  { property: 'margin-top', label: 'margin-top', min: -100, max: 200, step: 1, unit: 'px' },
  { property: 'margin-right', label: 'margin-right', min: -100, max: 200, step: 1, unit: 'px' },
  { property: 'margin-bottom', label: 'margin-bottom', min: -100, max: 200, step: 1, unit: 'px' },
  { property: 'margin-left', label: 'margin-left', min: -100, max: 200, step: 1, unit: 'px' },
  { property: 'gap', label: 'gap', min: 0, max: 100, step: 1, unit: 'px' },
]

function parseNumericValue(cssValue: string): number {
  const parsed = parseFloat(cssValue)
  return isNaN(parsed) ? 0 : parsed
}

export function StyleSlidersPanel({ type, element, domState, onApply, onClose }: StyleSlidersPanelProps) {
  const sliders = type === 'font' ? FONT_SLIDERS : SPACING_SLIDERS
  const [values, setValues] = useState<Record<string, number>>({})
  const [fontFamily, setFontFamily] = useState('')
  const initialValues = useRef<Record<string, number>>({})

  useEffect(() => {
    const computed = getComputedStyle(element)
    const initial: Record<string, number> = {}
    for (const s of sliders) {
      initial[s.property] = parseNumericValue(computed.getPropertyValue(s.property))
    }
    initialValues.current = initial
    setValues(initial)
    if (type === 'font') {
      setFontFamily(computed.fontFamily)
    }
  }, [element])

  const handleChange = (property: string, value: number, unit: string) => {
    setValues((prev) => ({ ...prev, [property]: value }))
    domState.preview(element, {
      type: 'css',
      css: { [property]: `${value}${unit}` },
    })
  }

  const handleApply = () => {
    const changes: Record<string, string> = {}
    for (const s of sliders) {
      if (values[s.property] !== initialValues.current[s.property]) {
        changes[s.property] = `${values[s.property]}${s.unit}`
      }
    }
    if (type === 'font' && fontFamily !== getComputedStyle(element).fontFamily) {
      changes['font-family'] = fontFamily
    }
    onApply(changes)
  }

  return (
    <SidePanel
      title={type === 'font' ? 'FONT ADJUST' : 'SPACING ADJUST'}
      onClose={onClose}
    >
      {sliders.map((s) => (
        <StyleSlider
          key={s.property}
          label={s.label}
          value={values[s.property] ?? 0}
          unit={s.unit}
          min={s.min}
          max={s.max}
          step={s.step}
          onChange={(v) => handleChange(s.property, v, s.unit)}
        />
      ))}

      {type === 'font' && (
        <div class="va-slider-font-family">
          <label class="va-insert-label">font-family</label>
          <input
            class="va-insert-input"
            type="text"
            value={fontFamily}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value
              setFontFamily(val)
              domState.preview(element, {
                type: 'css',
                css: { 'font-family': val },
              })
            }}
          />
        </div>
      )}

      <button class="va-btn va-btn--apply" onClick={handleApply}>
        APPLY
      </button>
    </SidePanel>
  )
}
