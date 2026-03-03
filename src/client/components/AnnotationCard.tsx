import { useContext, useState, useEffect, useRef } from 'preact/hooks'
import { AppContext } from '../context'
import { StylesDiff } from './StylesDiff'
import { TextEditor } from './TextEditor'
import { ColorPickerPanel } from './ColorPickerPanel'
import { InsertionPanel } from './InsertionPanel'
import { StyleSlidersPanel } from './StyleSlidersPanel'
import { useDOMState } from '../hooks/useDOMState'
import { resolveElement, resolveRect } from '../utils/resolveElement'
import { saveAnnotation, deleteAnnotation, saveReferenceImage, imageUrl } from '../utils/api'
import type { Annotation, Priority, QuickAction, QuickActionDetail, QuickActionEntry, ComputedStyles, InsertionPosition } from '../../shared/types'

const INTENT_STRINGS: Record<string, string> = {
  'color:too-dark': 'User flagged color is too dark',
  'color:too-light': 'User flagged color is too light',
  'color:wrong-color': 'User flagged wrong color',
  'color:match-design': "Color doesn't match the design — adjust to match",
  'spacing:too-much': 'User flagged excessive spacing',
  'spacing:too-little': 'User flagged insufficient spacing',
  'spacing:match-design': "Spacing doesn't match the design — adjust to match",
  'font:too-small': 'User flagged font is too small',
  'font:too-large': 'User flagged font is too large',
  'font:wrong-weight': 'User flagged incorrect font weight',
  'font:wrong-family': 'User flagged incorrect font family',
  'font:match-design': "Typography doesn't match the design — adjust to match",
  'align:move-left': 'User flagged element should move left',
  'align:move-right': 'User flagged element should move right',
  'align:center-it': 'User flagged element should be centered',
  'align:match-design': "Alignment doesn't match the design — adjust to match",
}

interface SubOption {
  detail: QuickActionDetail
  label: string
}

const SUB_OPTIONS: Record<QuickAction, SubOption[]> = {
  color: [
    { detail: 'too-dark', label: 'Too dark' },
    { detail: 'too-light', label: 'Too light' },
    { detail: 'wrong-color', label: 'Wrong color' },
    { detail: 'match-design', label: 'Match design' },
  ],
  spacing: [
    { detail: 'too-much', label: 'Too much' },
    { detail: 'too-little', label: 'Too little' },
    { detail: 'match-design', label: 'Match design' },
  ],
  font: [
    { detail: 'too-small', label: 'Too small' },
    { detail: 'too-large', label: 'Too large' },
    { detail: 'wrong-weight', label: 'Wrong weight' },
    { detail: 'wrong-family', label: 'Wrong family' },
    { detail: 'match-design', label: 'Match design' },
  ],
  align: [
    { detail: 'move-left', label: 'Move left' },
    { detail: 'move-right', label: 'Move right' },
    { detail: 'center-it', label: 'Center it' },
    { detail: 'match-design', label: 'Match design' },
  ],
}

const CATEGORIES: { key: QuickAction; label: string }[] = [
  { key: 'color', label: 'COLOR' },
  { key: 'spacing', label: 'SPACING' },
  { key: 'font', label: 'FONT' },
  { key: 'align', label: 'ALIGN' },
]

export function AnnotationCard() {
  const { state, dispatch } = useContext(AppContext)
  const annotation = state.annotations.find((a) => a.id === state.activeAnnotation)
  const iframe = state.viewport.iframe
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isNew = useRef(true)

  const [comment, setComment] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [selectedActions, setSelectedActions] = useState<Map<QuickAction, QuickActionDetail>>(new Map())
  const [expandedCategory, setExpandedCategory] = useState<QuickAction | null>(null)
  const [targetStyles, setTargetStyles] = useState<Partial<ComputedStyles>>({})
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [editingText, setEditingText] = useState(false)
  const [textChange, setTextChange] = useState<{ original: string; updated: string } | null>(null)
  const [colorChange, setColorChange] = useState<Annotation['colorChange'] | null>(null)
  const [insertionPosition, setInsertionPosition] = useState<InsertionPosition | null>(null)
  const [insertion, setInsertion] = useState<Annotation['insertion'] | null>(null)
  const [styleChanges, setStyleChanges] = useState<Record<string, string>>({})
  const domState = useDOMState()

  useEffect(() => {
    if (!annotation) return
    setComment(annotation.comment)
    setPriority(annotation.priority)
    setTargetStyles({ ...annotation.targetStyles })
    setReferenceImage(annotation.referenceImage)
    setReferencePreview(annotation.referenceImage ? imageUrl(annotation.referenceImage) : null)
    setExpandedCategory(null)

    // Restore selected actions from saved quickActions entries
    const map = new Map<QuickAction, QuickActionDetail>()
    for (const entry of annotation.quickActions) {
      map.set(entry.category, entry.detail)
    }
    setSelectedActions(map)

    isNew.current = !annotation.comment && annotation.quickActions.length === 0
      && Object.keys(annotation.targetStyles).length === 0 && !annotation.referenceImage
  }, [annotation?.id])

  const toggleCategory = (key: QuickAction) => {
    if (expandedCategory === key) {
      setExpandedCategory(null)
    } else {
      setExpandedCategory(key)
    }
  }

  const selectSubOption = (category: QuickAction, detail: QuickActionDetail) => {
    setSelectedActions((prev) => {
      const next = new Map(prev)
      if (next.get(category) === detail) {
        next.delete(category)
      } else {
        next.set(category, detail)
      }
      return next
    })
  }

  const handleTargetStyleChange = (key: keyof ComputedStyles, value: string) => {
    setTargetStyles((prev) => ({ ...prev, [key]: value || undefined }))
  }

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const base64 = await fileToBase64(file)
    const filename = await saveReferenceImage(base64)
    setReferenceImage(filename)
    setReferencePreview(imageUrl(filename))
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) await handleImageUpload(file)
        break
      }
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) await handleImageUpload(file)
  }

  const handleFileSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) await handleImageUpload(file)
    input.value = ''
  }

  const handleSave = async () => {
    if (!annotation) return

    const quickActions: QuickActionEntry[] = []
    for (const [category, detail] of selectedActions) {
      const intent = INTENT_STRINGS[`${category}:${detail}`] ?? ''
      quickActions.push({ category, detail, intent })
    }

    const updated: Annotation = {
      ...annotation,
      comment,
      priority,
      quickActions,
      targetStyles,
      referenceImage,
      ...(textChange && { textChange }),
      ...(colorChange && { colorChange }),
      ...(insertion && { insertion }),
    }

    await saveAnnotation(updated)
    dispatch({ type: 'UPDATE_ANNOTATION', annotation: updated })
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  const handleCancel = () => {
    if (annotation && isNew.current) {
      dispatch({ type: 'REMOVE_ANNOTATION', id: annotation.id })
    }
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  const handleDelete = async () => {
    if (!annotation) return
    await deleteAnnotation(annotation.id)
    dispatch({ type: 'REMOVE_ANNOTATION', id: annotation.id })
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  if (!annotation) return null

  const resolvedEl = resolveElement(annotation.element.selector, iframe)
  const liveBox = resolvedEl
    ? resolveRect(resolvedEl, iframe)
    : annotation.element.boundingBox
  const cardStyle = computeCardPosition(liveBox)

  return (
    <div class="va-card" style={cardStyle}>
      <div class="va-card-header">
        <span>#{annotation.number} {annotation.element.tag}.{annotation.element.selector.split('.').pop() ?? ''}</span>
        <button class="va-card-close" onClick={handleCancel}>{'\u2715'}</button>
      </div>

      {/* Interactive actions — edit text (leaf nodes only) + insert */}
      <div class="va-interactive-actions">
        {annotation.element.textContent && resolvedEl && resolvedEl.children.length === 0 && (
          <button
            class={`va-quick-action ${editingText ? 'va-quick-action--active' : ''}`}
            onClick={() => setEditingText(true)}
          >
            EDIT TEXT
          </button>
        )}
        <button
          class={`va-quick-action ${insertionPosition !== null ? 'va-quick-action--active' : ''}`}
          onClick={() => setInsertionPosition('after')}
        >
          INSERT
        </button>
      </div>

      {insertionPosition !== null && (
        <div class="va-insert-position-options">
          {(['before', 'after', 'inside'] as InsertionPosition[]).map((pos) => (
            <button
              key={pos}
              class={`va-quick-action ${insertionPosition === pos ? 'va-quick-action--active' : ''}`}
              onClick={() => {
                setInsertionPosition(pos)
                const el = resolveElement(annotation.element.selector, iframe) as HTMLElement
                if (el) dispatch({ type: 'OPEN_SIDE_PANEL', panel: 'insertion', element: el })
              }}
            >
              {pos.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {editingText && resolvedEl && (
        <TextEditor
          element={resolvedEl}
          domState={domState}
          onSave={(original, updated) => {
            setEditingText(false)
            setTextChange({ original, updated })
          }}
          onCancel={() => setEditingText(false)}
        />
      )}

      {state.sidePanel?.type === 'color' && state.sidePanel.element && (
        <ColorPickerPanel
          element={state.sidePanel.element}
          domState={domState}
          onApply={(change) => {
            setColorChange(change)
            dispatch({ type: 'CLOSE_SIDE_PANEL' })
          }}
          onClose={() => {
            if (state.sidePanel?.element) domState.revert(state.sidePanel.element)
            dispatch({ type: 'CLOSE_SIDE_PANEL' })
          }}
        />
      )}

      {state.sidePanel?.type === 'insertion' && insertionPosition && (
        <InsertionPanel
          position={insertionPosition}
          targetSelector={annotation.element.selector}
          onApply={(ins) => {
            setInsertion(ins)
            setInsertionPosition(null)
            dispatch({ type: 'CLOSE_SIDE_PANEL' })
          }}
          onClose={() => {
            setInsertionPosition(null)
            dispatch({ type: 'CLOSE_SIDE_PANEL' })
          }}
        />
      )}

      {(state.sidePanel?.type === 'font' || state.sidePanel?.type === 'spacing') && state.sidePanel.element && (
        <StyleSlidersPanel
          type={state.sidePanel.type}
          element={state.sidePanel.element}
          domState={domState}
          onApply={(changes) => {
            setStyleChanges((prev) => ({ ...prev, ...changes }))
            // Apply slider changes to targetStyles for export
            for (const [prop, val] of Object.entries(changes)) {
              const key = cssPropertyToStyleKey(prop)
              if (key) handleTargetStyleChange(key, val)
            }
            dispatch({ type: 'CLOSE_SIDE_PANEL' })
          }}
          onClose={() => {
            if (state.sidePanel?.element) domState.revert(state.sidePanel.element)
            dispatch({ type: 'CLOSE_SIDE_PANEL' })
          }}
        />
      )}

      {/* Comment box — primary input */}
      <div class="va-comment-area">
        <textarea
          ref={textareaRef}
          class="va-textarea"
          placeholder="Describe what should change..."
          value={comment}
          onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
          onPaste={handlePaste as any}
          onDrop={handleDrop as any}
          onDragOver={(e) => e.preventDefault()}
        />
      </div>

      {/* Image upload */}
      <div class="va-image-upload">
        {referencePreview ? (
          <div class="va-ref-thumb">
            <img src={referencePreview} alt="Reference" />
            <button
              class="va-ref-thumb-remove"
              onClick={() => {
                setReferenceImage(null)
                setReferencePreview(null)
              }}
            >
              {'\u2715'}
            </button>
          </div>
        ) : (
          <button
            class="va-image-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            {'\u{1F4CE}'} Add image
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect as any}
        />
      </div>

      {/* Quick actions */}
      <div class="va-quick-actions-section">
        <div class="va-section-label">Quick actions</div>
        <div class="va-quick-actions">
          {CATEGORIES.map(({ key, label }) => {
            const isSelected = selectedActions.has(key)
            const selectedDetail = selectedActions.get(key)
            const selectedLabel = selectedDetail
              ? SUB_OPTIONS[key].find((o) => o.detail === selectedDetail)?.label
              : null
            return (
              <button
                key={key}
                class={`va-quick-action ${isSelected ? 'va-quick-action--active' : ''}`}
                onClick={() => toggleCategory(key)}
              >
                {label}
                {isSelected && selectedLabel && (
                  <span class="va-quick-action-detail">{selectedLabel}</span>
                )}
              </button>
            )
          })}
        </div>
        {expandedCategory && (
          <div class="va-sub-options">
            {SUB_OPTIONS[expandedCategory].map(({ detail, label }) => (
              <button
                key={detail}
                class={`va-pill ${selectedActions.get(expandedCategory) === detail ? 'va-pill--active' : ''}`}
                onClick={() => selectSubOption(expandedCategory, detail)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {selectedActions.has('color') && (
          <button
            class="va-quick-action-drill"
            onClick={() => {
              const el = resolveElement(annotation.element.selector, iframe) as HTMLElement
              if (el) dispatch({ type: 'OPEN_SIDE_PANEL', panel: 'color', element: el })
            }}
          >
            Pick color...
          </button>
        )}
        {selectedActions.has('font') && (
          <button
            class="va-quick-action-drill"
            onClick={() => {
              const el = resolveElement(annotation.element.selector, iframe) as HTMLElement
              if (el) dispatch({ type: 'OPEN_SIDE_PANEL', panel: 'font', element: el })
            }}
          >
            Adjust font...
          </button>
        )}
        {selectedActions.has('spacing') && (
          <button
            class="va-quick-action-drill"
            onClick={() => {
              const el = resolveElement(annotation.element.selector, iframe) as HTMLElement
              if (el) dispatch({ type: 'OPEN_SIDE_PANEL', panel: 'spacing', element: el })
            }}
          >
            Adjust spacing...
          </button>
        )}
      </div>

      <div class="va-priority">
        <span class="va-priority-label">Priority:</span>
        {(['high', 'medium', 'low'] as Priority[]).map((p) => (
          <button
            key={p}
            class={`va-priority-btn va-priority-btn--${p} ${priority === p ? 'va-priority-btn--active' : ''}`}
            onClick={() => setPriority(p)}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      <StylesDiff
        computedStyles={annotation.computedStyles}
        targetStyles={targetStyles}
        onTargetChange={handleTargetStyleChange}
      />

      <div class="va-card-actions">
        <div>
          {!isNew.current && (
            <button class="va-btn va-btn--danger" onClick={handleDelete}>DELETE</button>
          )}
        </div>
        <div class="va-card-actions-right">
          <button class="va-btn" onClick={handleCancel}>CANCEL</button>
          <button
            class="va-btn va-btn--primary"
            disabled={selectedActions.size === 0 && !comment.trim() && !textChange && !colorChange && !insertion && Object.keys(styleChanges).length === 0}
            onClick={handleSave}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  )
}

function computeCardPosition(box: { x: number; y: number; width: number; height: number }) {
  const cardWidth = 360
  const cardMaxHeight = window.innerHeight * 0.8
  const gap = 12
  const margin = 8
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Clamp top so card doesn't overflow bottom of viewport
  const clampTop = (y: number) => Math.min(Math.max(margin, y), vh - cardMaxHeight - margin)

  // Try right
  if (box.x + box.width + gap + cardWidth < vw) {
    return { left: `${box.x + box.width + gap}px`, top: `${clampTop(box.y)}px` }
  }
  // Try left
  if (box.x - gap - cardWidth > 0) {
    return { left: `${box.x - gap - cardWidth}px`, top: `${clampTop(box.y)}px` }
  }
  // Below
  if (box.y + box.height + gap + cardMaxHeight < vh) {
    return { left: `${Math.max(margin, box.x)}px`, top: `${box.y + box.height + gap}px` }
  }
  // Above
  return { left: `${Math.max(margin, box.x)}px`, bottom: `${vh - box.y + gap}px` }
}

/** Map CSS property names (kebab-case) to ComputedStyles keys (camelCase) */
function cssPropertyToStyleKey(prop: string): keyof ComputedStyles | null {
  const map: Record<string, keyof ComputedStyles> = {
    'font-size': 'fontSize',
    'font-weight': 'fontWeight',
    'font-family': 'fontFamily',
    'line-height': 'lineHeight',
    'letter-spacing': 'letterSpacing',
    'padding': 'padding',
    'padding-top': 'padding',
    'padding-right': 'padding',
    'padding-bottom': 'padding',
    'padding-left': 'padding',
    'margin': 'margin',
    'margin-top': 'margin',
    'margin-right': 'margin',
    'margin-bottom': 'margin',
    'margin-left': 'margin',
    'gap': 'gap',
  }
  return map[prop] ?? null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
