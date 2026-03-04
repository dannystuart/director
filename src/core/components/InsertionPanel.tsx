import { h } from 'preact'
import { useState } from 'preact/hooks'
import { SidePanel } from './SidePanel'
import type { InsertionElementType, InsertionPosition } from '../../shared/types'

interface InsertionPanelProps {
  position: InsertionPosition
  targetSelector: string
  onApply: (insertion: {
    position: InsertionPosition
    elementType: InsertionElementType
    textContent: string
    description: string
  }) => void
  onClose: () => void
}

const ELEMENT_TYPES: { type: InsertionElementType; icon: string; label: string }[] = [
  { type: 'heading', icon: 'Aa', label: 'Heading' },
  { type: 'paragraph', icon: '\u00B6', label: 'Paragraph' },
  { type: 'button', icon: '\u25A1', label: 'Button' },
  { type: 'divider', icon: '\u2014', label: 'Divider' },
  { type: 'container', icon: '\u25A3', label: 'Container' },
  { type: 'custom', icon: '?', label: 'Custom' },
]

export function InsertionPanel({ position, targetSelector, onApply, onClose }: InsertionPanelProps) {
  const [selectedType, setSelectedType] = useState<InsertionElementType | null>(null)
  const [textContent, setTextContent] = useState('')
  const [description, setDescription] = useState('')

  const posLabel = position.charAt(0).toUpperCase() + position.slice(1)

  const handleApply = () => {
    if (!selectedType) return
    onApply({ position, elementType: selectedType, textContent, description })
  }

  return (
    <SidePanel title={`INSERT ${posLabel.toUpperCase()}`} onClose={onClose}>
      <div class="va-insert-target">
        Target: <code>{targetSelector}</code>
      </div>

      <div class="va-insert-types">
        {ELEMENT_TYPES.map(({ type, icon, label }) => (
          <button
            key={type}
            class={`va-insert-type-btn ${selectedType === type ? 'va-insert-type-btn--active' : ''}`}
            onClick={() => setSelectedType(type)}
          >
            <span class="va-insert-type-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {selectedType && selectedType !== 'divider' && (
        <div class="va-insert-field">
          <label class="va-insert-label">
            {selectedType === 'custom' ? 'Describe element:' : 'Text:'}
          </label>
          <input
            class="va-insert-input"
            type="text"
            placeholder={selectedType === 'custom' ? 'e.g. "A search bar with icon"' : 'Enter text content'}
            value={textContent}
            onInput={(e) => setTextContent((e.target as HTMLInputElement).value)}
          />
        </div>
      )}

      <div class="va-insert-field">
        <label class="va-insert-label">Notes:</label>
        <input
          class="va-insert-input"
          type="text"
          placeholder="Additional context for AI"
          value={description}
          onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
        />
      </div>

      <button class="va-btn va-btn--apply" disabled={!selectedType} onClick={handleApply}>
        APPLY
      </button>
    </SidePanel>
  )
}
