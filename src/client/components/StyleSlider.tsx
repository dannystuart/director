import { h } from 'preact'
import { useState, useRef } from 'preact/hooks'

interface StyleSliderProps {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export function StyleSlider({ label, value, unit, min, max, step, onChange }: StyleSliderProps) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayValue = unit ? `${Math.round(value * 10) / 10}${unit}` : `${Math.round(value * 10) / 10}`

  const handleValueClick = () => {
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  const handleInputBlur = (e: FocusEvent) => {
    setEditing(false)
    const parsed = parseFloat((e.target as HTMLInputElement).value)
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)))
    }
  }

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div class="va-slider-row">
      <span class="va-slider-label">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          class="va-slider-value-input"
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
        />
      ) : (
        <span class="va-slider-value" onClick={handleValueClick}>
          {displayValue}
        </span>
      )}
      <input
        class="va-slider-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
      />
    </div>
  )
}
