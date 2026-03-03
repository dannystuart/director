import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { resolveRect } from '../utils/resolveElement'
import type { DOMStateManager } from '../utils/domState'

interface TextEditorProps {
  element: HTMLElement
  iframe: HTMLIFrameElement | null
  domState: DOMStateManager
  onSave: (original: string, updated: string) => void
  onCancel: () => void
}

export function TextEditor({ element, iframe, domState, onSave, onCancel }: TextEditorProps) {
  const originalText = useRef('')

  useEffect(() => {
    const snap = domState.snapshot(element)
    originalText.current = snap.textContent

    element.contentEditable = 'plaintext-only'
    element.style.outline = '2px dashed #00ff41'
    element.style.outlineOffset = '2px'
    // Focus the iframe first if element is cross-document
    const elDoc = element.ownerDocument
    const elWin = elDoc.defaultView
    if (elWin && elWin !== window) elWin.focus()
    element.focus()

    const range = elDoc.createRange()
    range.selectNodeContents(element)
    const sel = elWin?.getSelection() ?? window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    return () => {
      element.contentEditable = 'false'
      element.style.outline = ''
      element.style.outlineOffset = ''
    }
  }, [element])

  const handleSave = () => {
    const newText = element.textContent ?? ''
    domState.preview(element, { type: 'text', text: newText })
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

  const rect = resolveRect(element, iframe)
  const actionStyle = {
    left: `${rect.left}px`,
    top: `${rect.bottom + 4}px`,
  }

  return (
    <div class="va-text-editor-actions va-text-editor-inline-actions" style={actionStyle} onKeyDown={handleKeyDown}>
      <button class="va-btn" onClick={handleCancel}>CANCEL</button>
      <button class="va-btn va-btn--primary" onClick={handleSave}>SAVE TEXT</button>
    </div>
  )
}
