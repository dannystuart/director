import { h } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import type { DOMStateManager } from '../utils/domState'

interface TextEditorProps {
  element: HTMLElement
  domState: DOMStateManager
  onSave: (original: string, updated: string) => void
  onCancel: () => void
}

function isLeafTextNode(el: HTMLElement): boolean {
  return el.children.length === 0
}

export function TextEditor({ element, domState, onSave, onCancel }: TextEditorProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isLeaf = isLeafTextNode(element)
  const originalText = useRef('')

  useEffect(() => {
    const snap = domState.snapshot(element)
    originalText.current = snap.textContent

    if (isLeaf) {
      element.contentEditable = 'plaintext-only'
      element.style.outline = '2px dashed #00ff41'
      element.style.outlineOffset = '2px'
      element.focus()
      const range = document.createRange()
      range.selectNodeContents(element)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    } else {
      setText(snap.textContent)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }

    return () => {
      if (isLeaf) {
        element.contentEditable = 'false'
        element.style.outline = ''
        element.style.outlineOffset = ''
      }
    }
  }, [element])

  const handleSave = () => {
    const newText = isLeaf ? (element.textContent ?? '') : text
    if (!isLeaf) {
      domState.preview(element, { type: 'text', text: newText })
    }
    domState.commit(element)
    onSave(originalText.current, newText)
  }

  const handleCancel = () => {
    domState.revert(element)
    onCancel()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  if (!isLeaf) {
    const rect = element.getBoundingClientRect()
    return (
      <div
        class="va-text-editor-overlay"
        style={{
          position: 'fixed',
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          minHeight: `${rect.height}px`,
          zIndex: 2147483646,
        }}
      >
        <textarea
          ref={textareaRef}
          class="va-text-editor-textarea"
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          style={{ width: '100%', minHeight: `${rect.height}px` }}
        />
        <div class="va-text-editor-actions">
          <button class="va-btn" onClick={handleCancel}>CANCEL</button>
          <button class="va-btn va-btn--primary" onClick={handleSave}>SAVE TEXT</button>
        </div>
      </div>
    )
  }

  return (
    <div class="va-text-editor-actions va-text-editor-inline-actions" onKeyDown={handleKeyDown}>
      <button class="va-btn" onClick={handleCancel}>CANCEL</button>
      <button class="va-btn va-btn--primary" onClick={handleSave}>SAVE TEXT</button>
    </div>
  )
}
