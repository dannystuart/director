import { useContext, useState, useEffect, useRef } from 'preact/hooks'
import { AppContext } from '../context'
import { StylesDiff } from './StylesDiff'
import { saveAnnotation, deleteAnnotation, saveReferenceImage, imageUrl } from '../utils/api'
import type { Annotation, Priority, QuickAction, ComputedStyles } from '../../shared/types'

const QUICK_ACTIONS: { key: QuickAction; label: string; intent: string }[] = [
  { key: 'color', label: 'COLOR', intent: 'User flagged incorrect color' },
  { key: 'spacing', label: 'SPACING', intent: 'User flagged incorrect spacing' },
  { key: 'font', label: 'FONT', intent: 'User flagged incorrect typography' },
  { key: 'align', label: 'ALIGN', intent: 'User flagged alignment issue' },
  { key: 'reference', label: 'REFERENCE', intent: 'Does not match design reference' },
  { key: 'comment', label: 'COMMENT', intent: '' },
]

export function AnnotationCard() {
  const { state, dispatch } = useContext(AppContext)
  const annotation = state.annotations.find((a) => a.id === state.activeAnnotation)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isExisting = useRef(false)

  const [comment, setComment] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [quickActions, setQuickActions] = useState<QuickAction[]>([])
  const [targetStyles, setTargetStyles] = useState<Partial<ComputedStyles>>({})
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)

  useEffect(() => {
    if (!annotation) return
    setComment(annotation.comment)
    setPriority(annotation.priority)
    setQuickActions([...annotation.quickActions])
    setTargetStyles({ ...annotation.targetStyles })
    setReferenceImage(annotation.referenceImage)
    setReferencePreview(annotation.referenceImage ? imageUrl(annotation.referenceImage) : null)
    isExisting.current = !!annotation.comment
  }, [annotation?.id])

  const toggleQuickAction = (key: QuickAction) => {
    setQuickActions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleTargetStyleChange = (key: keyof ComputedStyles, value: string) => {
    setTargetStyles((prev) => ({ ...prev, [key]: value || undefined }))
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const base64 = await fileToBase64(file)
        const filename = await saveReferenceImage(base64)
        setReferenceImage(filename)
        setReferencePreview(imageUrl(filename))
        if (!quickActions.includes('reference')) {
          setQuickActions((prev) => [...prev, 'reference'])
        }
        break
      }
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const base64 = await fileToBase64(file)
    const filename = await saveReferenceImage(base64)
    setReferenceImage(filename)
    setReferencePreview(imageUrl(filename))
    if (!quickActions.includes('reference')) {
      setQuickActions((prev) => [...prev, 'reference'])
    }
  }

  const handleSave = async () => {
    if (!annotation) return

    const intents = quickActions
      .map((k) => QUICK_ACTIONS.find((q) => q.key === k)?.intent)
      .filter(Boolean) as string[]

    const updated: Annotation = {
      ...annotation,
      comment,
      priority,
      quickActions,
      quickActionIntents: intents,
      targetStyles,
      referenceImage,
    }

    await saveAnnotation(updated)
    dispatch({ type: 'UPDATE_ANNOTATION', annotation: updated })
    dispatch({ type: 'SET_ACTIVE', id: null })
    dispatch({ type: 'SET_MODE', mode: 'selecting' })
  }

  const handleCancel = () => {
    if (annotation && !isExisting.current) {
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

  const cardStyle = computeCardPosition(annotation.element.boundingBox)

  return (
    <div class="va-card" style={cardStyle}>
      <div class="va-card-header">
        <span>#{annotation.number} {annotation.element.tag}.{annotation.element.selector.split('.').pop() ?? ''}</span>
        <button class="va-card-close" onClick={handleCancel}>{'\u2715'}</button>
      </div>

      <div class="va-quick-actions">
        {QUICK_ACTIONS.map(({ key, label }) => (
          <button
            key={key}
            class={`va-quick-action ${quickActions.includes(key) ? 'va-quick-action--active' : ''}`}
            onClick={() => toggleQuickAction(key)}
          >
            {label}
          </button>
        ))}
      </div>

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
        {referencePreview && (
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
          {isExisting.current && (
            <button class="va-btn va-btn--danger" onClick={handleDelete}>DELETE</button>
          )}
        </div>
        <div class="va-card-actions-right">
          <button class="va-btn" onClick={handleCancel}>CANCEL</button>
          <button class="va-btn va-btn--primary" onClick={handleSave}>SAVE</button>
        </div>
      </div>
    </div>
  )
}

function computeCardPosition(box: { x: number; y: number; width: number; height: number }) {
  const cardWidth = 360
  const gap = 12
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Try right
  if (box.x + box.width + gap + cardWidth < vw) {
    return { left: `${box.x + box.width + gap}px`, top: `${Math.max(8, box.y)}px` }
  }
  // Try left
  if (box.x - gap - cardWidth > 0) {
    return { left: `${box.x - gap - cardWidth}px`, top: `${Math.max(8, box.y)}px` }
  }
  // Below
  if (box.y + box.height + gap + 200 < vh) {
    return { left: `${Math.max(8, box.x)}px`, top: `${box.y + box.height + gap}px` }
  }
  // Above
  return { left: `${Math.max(8, box.x)}px`, bottom: `${vh - box.y + gap}px` }
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
