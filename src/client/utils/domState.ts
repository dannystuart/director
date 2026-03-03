import type { DOMChange, StateSnapshot } from '../../shared/types'

export class DOMStateManager {
  private snapshots = new Map<HTMLElement, StateSnapshot>()
  private changes = new Map<HTMLElement, DOMChange>()

  snapshot(element: HTMLElement): StateSnapshot {
    const parent = element.parentElement
    const siblings = parent ? Array.from(parent.children) : []
    const snap: StateSnapshot = {
      element,
      inlineStyles: element.style.cssText,
      textContent: element.textContent ?? '',
      innerHTML: element.innerHTML,
      siblingIndex: siblings.indexOf(element),
      parentSelector: parent?.tagName?.toLowerCase() ?? '',
    }
    this.snapshots.set(element, snap)
    return snap
  }

  preview(element: HTMLElement, change: DOMChange): void {
    if (change.type === 'reorder' || change.type === 'dom') {
      throw new Error(`Change type "${change.type}" not implemented`)
    }

    if (!this.snapshots.has(element)) {
      this.snapshot(element)
    }
    this.changes.set(element, change)

    if (change.type === 'css' && change.css) {
      for (const [prop, value] of Object.entries(change.css)) {
        element.style.setProperty(prop, value)
      }
    }

    if (change.type === 'text' && change.text !== undefined) {
      element.textContent = change.text
    }
  }

  revert(element: HTMLElement): void {
    const snap = this.snapshots.get(element)
    if (!snap) return

    element.style.cssText = snap.inlineStyles
    element.textContent = snap.textContent

    this.snapshots.delete(element)
    this.changes.delete(element)
  }

  commit(element: HTMLElement): { before: StateSnapshot; after: DOMChange } {
    const snap = this.snapshots.get(element)
    const change = this.changes.get(element)
    if (!snap || !change) {
      throw new Error('No active preview for element')
    }

    this.snapshots.delete(element)
    this.changes.delete(element)
    return { before: snap, after: change }
  }

  revertAll(): void {
    for (const [element, snap] of this.snapshots) {
      element.style.cssText = snap.inlineStyles
      element.textContent = snap.textContent
    }
    this.snapshots.clear()
    this.changes.clear()
  }

  hasPreview(element: HTMLElement): boolean {
    return this.snapshots.has(element)
  }
}
