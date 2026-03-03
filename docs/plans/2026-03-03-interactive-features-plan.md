# Interactive Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 interactive features to vibe-annotator: DOM state management, live text editing, color picking, element insertion, responsive viewport, and style sliders.

**Architecture:** Features build on a shared DOM State Manager (`src/client/utils/domState.ts`) that handles snapshot/preview/revert/commit lifecycle. New quick actions and side panels extend the existing AnnotationCard. Each feature adds optional fields to the `Annotation` type and corresponding export logic. The Responsive Viewport uses an iframe overlay with cross-frame event handling. All new annotation fields are optional for backwards compatibility.

**Tech Stack:** Preact 10, TypeScript strict, vitest (jsdom for client tests), tsup dual build

**Design doc:** `docs/plans/2026-03-03-interactive-features-design.md`

---

## Dependency Graph

```
Task 1 (Types) ──► Task 2 (DOM State Manager) ──► Task 3 (Hook + Export)
                                                       │
                    ┌──────────────┬───────────────────┤
                    ▼              ▼                    ▼
              Task 5 (Text)  Task 4 (Side Panel)  Task 10 (Viewport)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Task 6 (Color    Task 8 (Element   Task 9 (Style
        Extraction)      Insertion Panel)  Sliders)
              │
              ▼
        Task 7 (Color
        Picker Panel)

                    All ──► Task 11 (Integration)
```

**Parallelizable after Task 3:** Tasks 4, 5, 10 can start simultaneously. After Task 4: Tasks 6→7, 8, 9 can run in parallel.

---

## Task 1: Update Shared Types

**Files:**
- Modify: `src/shared/types.ts`

### Step 1: Add new types and extend Annotation interface

Add these types after the existing `ComputedStyles` interface:

```typescript
// --- Interactive feature types ---

export type ChangeType = 'css' | 'text' | 'reorder' | 'dom'

export interface DOMChange {
  type: ChangeType
  css?: Record<string, string>
  text?: string
  reorder?: { newIndex: number }
  dom?: { html: string }
}

export interface StateSnapshot {
  element: HTMLElement
  inlineStyles: string
  textContent: string
  innerHTML: string
  siblingIndex: number
  parentSelector: string
}

export type InsertionElementType =
  | 'heading' | 'paragraph' | 'button'
  | 'divider' | 'container' | 'custom'

export type InsertionPosition = 'before' | 'after' | 'inside'
```

Add these optional fields to the existing `Annotation` interface (after `referenceImage`):

```typescript
  // Interactive feature fields (all optional, backwards compatible)
  viewportWidth?: number
  textChange?: {
    original: string
    updated: string
  }
  colorChange?: {
    property: string
    from: string
    to: string
    tokenName: string | null
  }
  insertion?: {
    position: InsertionPosition
    elementType: InsertionElementType
    textContent: string
    description: string
  }
```

### Step 2: Run tests to verify nothing breaks

Run: `pnpm test`
Expected: All 20 tests pass (type additions are additive, no runtime changes)

### Step 3: Commit

```bash
git add src/shared/types.ts
git commit -m "feat: add shared types for interactive features"
```

---

## Task 2: DOM State Manager

**Files:**
- Create: `src/client/utils/domState.ts`
- Create: `src/client/utils/__tests__/domState.test.ts`

### Step 1: Write the failing tests

Create `src/client/utils/__tests__/domState.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DOMStateManager } from '../domState'

describe('DOMStateManager', () => {
  let manager: DOMStateManager
  let el: HTMLElement

  beforeEach(() => {
    manager = new DOMStateManager()
    el = document.createElement('div')
    el.style.cssText = 'color: red; font-size: 16px;'
    el.textContent = 'Hello world'
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('snapshot', () => {
    it('captures inline styles and text content', () => {
      const snap = manager.snapshot(el)
      expect(snap.inlineStyles).toBe(el.style.cssText)
      expect(snap.textContent).toBe('Hello world')
      expect(snap.element).toBe(el)
    })

    it('captures innerHTML', () => {
      el.innerHTML = '<span>child</span>'
      const snap = manager.snapshot(el)
      expect(snap.innerHTML).toBe('<span>child</span>')
    })

    it('captures sibling index', () => {
      const sibling = document.createElement('span')
      document.body.appendChild(sibling)
      const snap = manager.snapshot(sibling)
      expect(snap.siblingIndex).toBe(1)
    })
  })

  describe('preview', () => {
    it('applies CSS changes to element', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      expect(el.style.color).toBe('blue')
    })

    it('applies text changes to element', () => {
      manager.preview(el, { type: 'text', text: 'New text' })
      expect(el.textContent).toBe('New text')
    })

    it('auto-snapshots on first preview', () => {
      expect(manager.hasPreview(el)).toBe(false)
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      expect(manager.hasPreview(el)).toBe(true)
    })

    it('preserves existing CSS when adding new properties', () => {
      manager.preview(el, { type: 'css', css: { 'background-color': 'green' } })
      expect(el.style.color).toBe('red')
      expect(el.style.backgroundColor).toBe('green')
    })
  })

  describe('revert', () => {
    it('restores original inline styles', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue', 'background-color': 'green' } })
      manager.revert(el)
      expect(el.style.color).toBe('red')
      expect(el.style.backgroundColor).toBe('')
    })

    it('restores original text content', () => {
      manager.preview(el, { type: 'text', text: 'Changed' })
      manager.revert(el)
      expect(el.textContent).toBe('Hello world')
    })

    it('clears tracking after revert', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      manager.revert(el)
      expect(manager.hasPreview(el)).toBe(false)
    })

    it('is a no-op for untracked elements', () => {
      manager.revert(el) // should not throw
      expect(el.style.color).toBe('red')
    })
  })

  describe('commit', () => {
    it('returns before snapshot and applied change', () => {
      const change = { type: 'css' as const, css: { color: 'blue' } }
      manager.preview(el, change)
      const result = manager.commit(el)
      expect(result.before.textContent).toBe('Hello world')
      expect(result.after).toEqual(change)
    })

    it('clears tracking after commit', () => {
      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      manager.commit(el)
      expect(manager.hasPreview(el)).toBe(false)
    })

    it('throws when no active preview', () => {
      expect(() => manager.commit(el)).toThrow('No active preview')
    })
  })

  describe('revertAll', () => {
    it('reverts all tracked elements', () => {
      const el2 = document.createElement('p')
      el2.style.cssText = 'margin: 10px;'
      el2.textContent = 'Second'
      document.body.appendChild(el2)

      manager.preview(el, { type: 'css', css: { color: 'blue' } })
      manager.preview(el2, { type: 'css', css: { margin: '20px' } })
      manager.revertAll()

      expect(el.style.color).toBe('red')
      expect(el2.style.margin).toBe('10px')
      expect(manager.hasPreview(el)).toBe(false)
      expect(manager.hasPreview(el2)).toBe(false)
    })
  })

  describe('unsupported types', () => {
    it('throws for reorder type', () => {
      expect(() => manager.preview(el, { type: 'reorder', reorder: { newIndex: 0 } }))
        .toThrow('not implemented')
    })

    it('throws for dom type', () => {
      expect(() => manager.preview(el, { type: 'dom', dom: { html: '<p>hi</p>' } }))
        .toThrow('not implemented')
    })
  })
})
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/client/utils/__tests__/domState.test.ts`
Expected: FAIL — module `../domState` not found

### Step 3: Implement DOMStateManager

Create `src/client/utils/domState.ts`:

```typescript
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
```

### Step 4: Run tests to verify they pass

Run: `pnpm vitest run src/client/utils/__tests__/domState.test.ts`
Expected: All tests PASS

### Step 5: Run full test suite

Run: `pnpm test`
Expected: All tests pass (20 existing + ~13 new domState tests)

### Step 6: Commit

```bash
git add src/client/utils/domState.ts src/client/utils/__tests__/domState.test.ts
git commit -m "feat: add DOM State Manager with snapshot/preview/revert/commit lifecycle"
```

---

## Task 3: useDOMState Hook + Export Updates

**Files:**
- Create: `src/client/hooks/useDOMState.ts`
- Modify: `src/client/utils/export.ts`
- Modify: `src/client/utils/__tests__/export.test.ts`

### Step 1: Create useDOMState hook

Create `src/client/hooks/useDOMState.ts`:

```typescript
import { useRef } from 'preact/hooks'
import { DOMStateManager } from '../utils/domState'

export function useDOMState() {
  const ref = useRef<DOMStateManager | null>(null)
  if (!ref.current) {
    ref.current = new DOMStateManager()
  }
  return ref.current
}
```

### Step 2: Write failing export tests

Add to the existing `describe` block in `src/client/utils/__tests__/export.test.ts`:

```typescript
  it('includes viewport width for mobile', () => {
    const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 375 })])
    expect(md).toContain('**Viewport:** 375px (Mobile)')
  })

  it('labels viewport as Tablet for 768px', () => {
    const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 768 })])
    expect(md).toContain('**Viewport:** 768px (Tablet)')
  })

  it('omits viewport for desktop widths >= 1024', () => {
    const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 1440 })])
    expect(md).not.toContain('**Viewport:**')
  })

  it('includes text change when present', () => {
    const ann = makeAnnotation({
      textChange: { original: 'Dashboard Overview', updated: 'My Dashboard' },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('**Text change:** "Dashboard Overview" \u2192 "My Dashboard"')
  })

  it('includes color change with token name', () => {
    const ann = makeAnnotation({
      colorChange: {
        property: 'backgroundColor',
        from: 'rgb(0, 0, 0)',
        to: '#2563eb',
        tokenName: '--color-primary',
      },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('background-color: rgb(0, 0, 0) \u2192 var(--color-primary) (#2563eb)')
  })

  it('includes color change without token name', () => {
    const ann = makeAnnotation({
      colorChange: {
        property: 'color',
        from: 'rgb(0, 0, 0)',
        to: '#ff0000',
        tokenName: null,
      },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('color: rgb(0, 0, 0) \u2192 #ff0000')
  })

  it('formats insertion annotation', () => {
    const ann = makeAnnotation({
      insertion: {
        position: 'after',
        elementType: 'button',
        textContent: 'Get Started Free',
        description: 'Primary CTA, match existing button styles',
      },
    })
    const md = buildExportMarkdown([ann])
    expect(md).toContain('**Change type:** Insert new element')
    expect(md).toContain('**Position:** After')
    expect(md).toContain('**Insert:** Button \u2014 "Get Started Free"')
    expect(md).toContain('**Notes:** "Primary CTA, match existing button styles"')
  })
```

Note: The `makeAnnotation` helper already exists at line 5 and accepts `Partial<Annotation>` overrides. The new optional fields will just pass through. Make sure the `Annotation` import includes the new fields from Task 1.

### Step 3: Run tests to verify they fail

Run: `pnpm vitest run src/client/utils/__tests__/export.test.ts`
Expected: FAIL — new sections not yet generated in export output

### Step 4: Update buildExportMarkdown

In `src/client/utils/export.ts`, add new sections inside the `for (const ann of sorted)` loop. Insert after the `**Selector:**` line (after line 28) and before the style changes section (line 34):

```typescript
    // Viewport (only show for non-desktop)
    if (ann.viewportWidth && ann.viewportWidth < 1024) {
      const label = ann.viewportWidth <= 480 ? 'Mobile' : 'Tablet'
      lines.push(`**Viewport:** ${ann.viewportWidth}px (${label})`)
    }

    // Text change
    if (ann.textChange) {
      lines.push(`**Text change:** "${ann.textChange.original}" \u2192 "${ann.textChange.updated}"`)
    }
```

After the existing style changes section (after line 51), before the quickActionIntents section:

```typescript
    // Color change (as a style change line)
    if (ann.colorChange) {
      const prop = camelToKebab(ann.colorChange.property)
      const to = ann.colorChange.tokenName
        ? `var(${ann.colorChange.tokenName}) (${ann.colorChange.to})`
        : ann.colorChange.to
      // If no style changes section was printed, add header
      if (changes.length === 0 && !ann.colorChange) {
        // Already handled above
      }
      lines.push(`- ${prop}: ${ann.colorChange.from} \u2192 ${to}`)
    }

    // Insertion
    if (ann.insertion) {
      const posLabel = ann.insertion.position.charAt(0).toUpperCase() + ann.insertion.position.slice(1)
      const typeLabel = ann.insertion.elementType.charAt(0).toUpperCase() + ann.insertion.elementType.slice(1)
      lines.push(`**Change type:** Insert new element`)
      lines.push(`**Position:** ${posLabel} \`${ann.element.selector}\``)
      lines.push(`**Insert:** ${typeLabel} \u2014 "${ann.insertion.textContent}"`)
      if (ann.insertion.description) {
        lines.push(`**Notes:** "${ann.insertion.description}"`)
      }
    }
```

### Step 5: Run tests to verify they pass

Run: `pnpm vitest run src/client/utils/__tests__/export.test.ts`
Expected: All tests PASS (existing 5 + new 7)

### Step 6: Run full test suite

Run: `pnpm test`
Expected: All tests pass

### Step 7: Commit

```bash
git add src/client/hooks/useDOMState.ts src/client/utils/export.ts src/client/utils/__tests__/export.test.ts
git commit -m "feat: add useDOMState hook and export support for new interactive fields"
```

---

## Task 4: Side Panel Component + Context Updates

**Files:**
- Create: `src/client/components/SidePanel.tsx`
- Modify: `src/client/context.ts`
- Modify: `src/client/styles.css`

### Step 1: Add side panel state to context

In `src/client/context.ts`:

Add to `AppState` (after `hoveredElement`):

```typescript
  sidePanel: {
    type: 'color' | 'font' | 'spacing' | 'insertion'
    element: HTMLElement | null
  } | null
```

Add to `AppAction` union:

```typescript
  | { type: 'OPEN_SIDE_PANEL'; panel: 'color' | 'font' | 'spacing' | 'insertion'; element: HTMLElement }
  | { type: 'CLOSE_SIDE_PANEL' }
```

Add reducer cases in `appReducer`:

```typescript
    case 'OPEN_SIDE_PANEL':
      return { ...state, sidePanel: { type: action.panel, element: action.element } }
    case 'CLOSE_SIDE_PANEL':
      return { ...state, sidePanel: null }
```

In `initialState`, add: `sidePanel: null`

Also ensure `SET_MODE` clears the side panel: add `sidePanel: null` to the `SET_MODE` return.

### Step 2: Create SidePanel component

Create `src/client/components/SidePanel.tsx`:

```typescript
import { h, ComponentChildren } from 'preact'

interface SidePanelProps {
  title: string
  children: ComponentChildren
  onClose: () => void
}

export function SidePanel({ title, children, onClose }: SidePanelProps) {
  return (
    <div class="va-side-panel">
      <div class="va-side-panel-header">
        <span class="va-side-panel-title">{title}</span>
        <button class="va-side-panel-close" onClick={onClose}>{'\u2715'}</button>
      </div>
      <div class="va-side-panel-body">
        {children}
      </div>
    </div>
  )
}
```

### Step 3: Add side panel styles

Add to `src/client/styles.css`:

```css
/* --- Side Panel --- */

.va-side-panel {
  position: fixed;
  z-index: 2147483645;
  width: 280px;
  max-height: 500px;
  background: #0a0a0a;
  border: 1px solid #00ff41;
  border-radius: 4px;
  font-family: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  color: #e0e0e0;
  overflow-y: auto;
}

.va-side-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
}

.va-side-panel-title {
  color: #00ff41;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.va-side-panel-close {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
}

.va-side-panel-close:hover {
  color: #ff4444;
}

.va-side-panel-body {
  padding: 12px;
}
```

### Step 4: Build and verify

Run: `pnpm build`
Expected: Clean build, no TypeScript errors

### Step 5: Commit

```bash
git add src/client/components/SidePanel.tsx src/client/context.ts src/client/styles.css
git commit -m "feat: add SidePanel component and side panel state management"
```

---

## Task 5: Live Text Editing

**Files:**
- Create: `src/client/components/TextEditor.tsx`
- Modify: `src/client/components/AnnotationCard.tsx`
- Modify: `src/client/styles.css`

Depends on: Task 2 (DOMStateManager), Task 3 (useDOMState hook)

### Step 1: Create TextEditor component

Create `src/client/components/TextEditor.tsx`:

```typescript
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

  // Leaf node: inline editing via contentEditable, just show action buttons
  return (
    <div class="va-text-editor-actions va-text-editor-inline-actions" onKeyDown={handleKeyDown}>
      <button class="va-btn" onClick={handleCancel}>CANCEL</button>
      <button class="va-btn va-btn--primary" onClick={handleSave}>SAVE TEXT</button>
    </div>
  )
}
```

### Step 2: Add text editor styles

Add to `src/client/styles.css`:

```css
/* --- Text Editor --- */

.va-text-editor-overlay {
  background: rgba(0, 0, 0, 0.85);
  border: 2px dashed #00ff41;
  padding: 4px;
  box-sizing: border-box;
}

.va-text-editor-textarea {
  background: #111;
  color: #e0e0e0;
  border: 1px solid #333;
  font-family: inherit;
  font-size: 14px;
  padding: 8px;
  resize: vertical;
  box-sizing: border-box;
}

.va-text-editor-textarea:focus {
  border-color: #00ff41;
  outline: none;
}

.va-text-editor-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.va-text-editor-inline-actions {
  position: fixed;
  z-index: 2147483646;
  background: #0a0a0a;
  border: 1px solid #333;
  padding: 6px;
  border-radius: 4px;
}
```

### Step 3: Wire EDIT TEXT into AnnotationCard

Modify `src/client/components/AnnotationCard.tsx`:

1. Import `TextEditor` and `useDOMState`:
   ```typescript
   import { TextEditor } from './TextEditor'
   import { useDOMState } from '../hooks/useDOMState'
   ```

2. Add state for text editing mode:
   ```typescript
   const [editingText, setEditingText] = useState(false)
   const domState = useDOMState()
   ```

3. Add EDIT TEXT button after the quick actions div (before the comment area). Only show if element has text content:
   ```typescript
   {annotation.element.textContent && (
     <div class="va-interactive-actions">
       <button
         class={`va-quick-action ${editingText ? 'va-quick-action--active' : ''}`}
         onClick={() => setEditingText(true)}
       >
         EDIT TEXT
       </button>
     </div>
   )}
   ```

4. When `editingText` is true, resolve the DOM element and render `<TextEditor>`. The element can be found via `document.querySelector(annotation.element.selector)`:
   ```typescript
   {editingText && (() => {
     const el = document.querySelector(annotation.element.selector) as HTMLElement
     if (!el) return null
     return (
       <TextEditor
         element={el}
         domState={domState}
         onSave={(original, updated) => {
           setEditingText(false)
           // Store textChange — will be saved when user clicks SAVE
           setTextChange({ original, updated })
         }}
         onCancel={() => setEditingText(false)}
       />
     )
   })()}
   ```

5. Add `textChange` local state and include it in `handleSave`:
   ```typescript
   const [textChange, setTextChange] = useState<{ original: string; updated: string } | null>(null)
   ```
   In `handleSave`, spread `textChange` onto the updated annotation:
   ```typescript
   const updated: Annotation = {
     ...annotation,
     comment,
     priority,
     quickActions,
     quickActionIntents: intents,
     targetStyles,
     referenceImage,
     ...(textChange && { textChange }),
   }
   ```

### Step 4: Add interactive actions styles

Add to `src/client/styles.css`:

```css
.va-interactive-actions {
  display: flex;
  gap: 6px;
  padding: 6px 12px;
  border-top: 1px solid #1a1a1a;
}
```

### Step 5: Build and manually test

Run: `pnpm build`
Expected: Build succeeds

Test: `cd demo && pnpm dev` — click element with text, click EDIT TEXT, type new text, save. Verify annotation captures textChange.

### Step 6: Commit

```bash
git add src/client/components/TextEditor.tsx src/client/components/AnnotationCard.tsx src/client/styles.css
git commit -m "feat: add live text editing with contentEditable and textarea overlay"
```

---

## Task 6: Color Extraction Utility

**Files:**
- Create: `src/client/utils/colorExtraction.ts`
- Create: `src/client/utils/__tests__/colorExtraction.test.ts`

Depends on: Task 1 (types only, no runtime dependency)

### Step 1: Write failing tests

Create `src/client/utils/__tests__/colorExtraction.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { extractPageColors, isColorValue, clearColorCache } from '../colorExtraction'

describe('colorExtraction', () => {
  beforeEach(() => {
    clearColorCache()
    document.body.innerHTML = ''
  })

  describe('isColorValue', () => {
    it('recognizes hex colors', () => {
      expect(isColorValue('#ff0000')).toBe(true)
      expect(isColorValue('#f00')).toBe(true)
      expect(isColorValue('#ff000080')).toBe(true)
    })

    it('recognizes rgb/rgba colors', () => {
      expect(isColorValue('rgb(255, 0, 0)')).toBe(true)
      expect(isColorValue('rgba(255, 0, 0, 0.5)')).toBe(true)
    })

    it('recognizes hsl colors', () => {
      expect(isColorValue('hsl(120, 100%, 50%)')).toBe(true)
      expect(isColorValue('hsla(120, 100%, 50%, 0.5)')).toBe(true)
    })

    it('recognizes named colors', () => {
      expect(isColorValue('red')).toBe(true)
      expect(isColorValue('transparent')).toBe(true)
    })

    it('rejects non-color values', () => {
      expect(isColorValue('16px')).toBe(false)
      expect(isColorValue('bold')).toBe(false)
      expect(isColorValue('flex')).toBe(false)
      expect(isColorValue('')).toBe(false)
    })
  })

  describe('extractPageColors', () => {
    it('returns tokens and usedColors arrays', () => {
      const result = extractPageColors()
      expect(result).toHaveProperty('tokens')
      expect(result).toHaveProperty('usedColors')
      expect(Array.isArray(result.tokens)).toBe(true)
      expect(Array.isArray(result.usedColors)).toBe(true)
    })

    it('caches results on second call', () => {
      const first = extractPageColors()
      const second = extractPageColors()
      expect(first).toBe(second) // same reference = cached
    })

    it('refreshes when forceRefresh is true', () => {
      const first = extractPageColors()
      const second = extractPageColors(true)
      expect(first).not.toBe(second)
    })

    it('limits sampled elements to 200', () => {
      for (let i = 0; i < 250; i++) {
        document.body.appendChild(document.createElement('div'))
      }
      const result = extractPageColors()
      expect(result).toBeDefined() // should not crash
    })
  })
})
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/client/utils/__tests__/colorExtraction.test.ts`
Expected: FAIL — module not found

### Step 3: Implement color extraction

Create `src/client/utils/colorExtraction.ts`:

```typescript
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
```

### Step 4: Run tests to verify they pass

Run: `pnpm vitest run src/client/utils/__tests__/colorExtraction.test.ts`
Expected: All tests PASS

### Step 5: Run full test suite

Run: `pnpm test`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/client/utils/colorExtraction.ts src/client/utils/__tests__/colorExtraction.test.ts
git commit -m "feat: add color extraction utility for CSS tokens and page colors"
```

---

## Task 7: Color Picker Panel

**Files:**
- Create: `src/client/components/ColorPickerPanel.tsx`
- Modify: `src/client/components/AnnotationCard.tsx`
- Modify: `src/client/styles.css`

Depends on: Task 4 (SidePanel), Task 6 (color extraction), Task 2 (DOMStateManager)

### Step 1: Create ColorPickerPanel component

Create `src/client/components/ColorPickerPanel.tsx`:

```typescript
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
```

### Step 2: Add color picker styles

Add to `src/client/styles.css`:

```css
/* --- Color Picker --- */

.va-color-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.va-color-tab {
  flex: 1;
  padding: 4px 8px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #888;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  text-transform: uppercase;
}

.va-color-tab--active {
  border-color: #00ff41;
  color: #00ff41;
}

.va-color-section {
  margin-bottom: 12px;
}

.va-color-section-label {
  font-size: 9px;
  color: #00ff41;
  letter-spacing: 1px;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.va-color-token-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 8px;
  background: none;
  border: 1px solid transparent;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}

.va-color-token-row:hover {
  border-color: #00ff41;
  background: #111;
}

.va-color-token-name {
  flex: 1;
  color: #ccc;
}

.va-color-token-value {
  color: #888;
  font-size: 10px;
}

.va-color-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 1px solid #555;
  border-radius: 2px;
  flex-shrink: 0;
}

.va-color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.va-color-swatch--btn {
  width: 24px;
  height: 24px;
  cursor: pointer;
  padding: 0;
}

.va-color-swatch--btn:hover {
  border-color: #00ff41;
  transform: scale(1.2);
}

.va-color-hex-input {
  width: 100%;
  padding: 6px 8px;
  background: #111;
  border: 1px solid #333;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 12px;
  box-sizing: border-box;
}

.va-color-hex-input:focus {
  border-color: #00ff41;
  outline: none;
}

.va-btn--apply {
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  background: #00ff41;
  color: #0a0a0a;
  border: none;
  font-family: inherit;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.va-btn--apply:hover {
  background: #00cc33;
}

.va-btn--apply:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}
```

### Step 3: Wire color picker into AnnotationCard

In `src/client/components/AnnotationCard.tsx`:

1. Import `ColorPickerPanel`:
   ```typescript
   import { ColorPickerPanel } from './ColorPickerPanel'
   ```

2. Add state for color change:
   ```typescript
   const [colorChange, setColorChange] = useState<Annotation['colorChange'] | null>(null)
   ```

3. Add a "Pick color..." button inside the COLOR quick action area. When COLOR is active, show a drill-down:
   ```typescript
   {quickActions.includes('color') && (
     <button
       class="va-quick-action-drill"
       onClick={() => {
         const el = document.querySelector(annotation.element.selector) as HTMLElement
         if (el) dispatch({ type: 'OPEN_SIDE_PANEL', panel: 'color', element: el })
       }}
     >
       Pick color...
     </button>
   )}
   ```

4. Render `ColorPickerPanel` when side panel type is `'color'`:
   ```typescript
   {state.sidePanel?.type === 'color' && state.sidePanel.element && (
     <ColorPickerPanel
       element={state.sidePanel.element}
       domState={domState}
       onApply={(change) => {
         setColorChange(change)
         dispatch({ type: 'CLOSE_SIDE_PANEL' })
       }}
       onClose={() => {
         domState.revert(state.sidePanel!.element!)
         dispatch({ type: 'CLOSE_SIDE_PANEL' })
       }}
     />
   )}
   ```

5. Include `colorChange` in `handleSave`:
   ```typescript
   ...(colorChange && { colorChange }),
   ```

### Step 4: Add drill-down button styles

Add to `src/client/styles.css`:

```css
.va-quick-action-drill {
  display: block;
  width: 100%;
  padding: 4px 12px;
  background: none;
  border: none;
  border-top: 1px solid #1a1a1a;
  color: #00ff41;
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
  text-align: left;
}

.va-quick-action-drill:hover {
  background: #111;
}
```

### Step 5: Build and manually test

Run: `pnpm build`
Test: `cd demo && pnpm dev` — click element, click COLOR, click "Pick color...", verify panel opens, pick a color, click APPLY.

### Step 6: Commit

```bash
git add src/client/components/ColorPickerPanel.tsx src/client/components/AnnotationCard.tsx src/client/styles.css
git commit -m "feat: add color picker panel with design tokens and page colors"
```

---

## Task 8: Element Insertion Panel

**Files:**
- Create: `src/client/components/InsertionPanel.tsx`
- Modify: `src/client/components/AnnotationCard.tsx`
- Modify: `src/client/styles.css`

Depends on: Task 4 (SidePanel)

### Step 1: Create InsertionPanel component

Create `src/client/components/InsertionPanel.tsx`:

```typescript
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
```

### Step 2: Add insertion panel styles

Add to `src/client/styles.css`:

```css
/* --- Insertion Panel --- */

.va-insert-target {
  font-size: 11px;
  color: #888;
  margin-bottom: 12px;
}

.va-insert-target code {
  color: #00ff41;
}

.va-insert-types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-bottom: 12px;
}

.va-insert-type-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.va-insert-type-btn:hover {
  border-color: #555;
}

.va-insert-type-btn--active {
  border-color: #00ff41;
  color: #00ff41;
}

.va-insert-type-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.va-insert-field {
  margin-bottom: 8px;
}

.va-insert-label {
  display: block;
  font-size: 10px;
  color: #888;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.va-insert-input {
  width: 100%;
  padding: 6px 8px;
  background: #111;
  border: 1px solid #333;
  color: #e0e0e0;
  font-family: inherit;
  font-size: 12px;
  box-sizing: border-box;
}

.va-insert-input:focus {
  border-color: #00ff41;
  outline: none;
}
```

### Step 3: Wire insertion into AnnotationCard

In `src/client/components/AnnotationCard.tsx`:

1. Import `InsertionPanel`:
   ```typescript
   import { InsertionPanel } from './InsertionPanel'
   ```

2. Add state:
   ```typescript
   const [insertionPosition, setInsertionPosition] = useState<InsertionPosition | null>(null)
   const [insertion, setInsertion] = useState<Annotation['insertion'] | null>(null)
   ```

3. Add INSERT button in the interactive actions row (alongside EDIT TEXT):
   ```typescript
   <button
     class="va-quick-action"
     onClick={() => setInsertionPosition('after')}
   >
     INSERT
   </button>
   ```

4. When `insertionPosition` is set but panel isn't open yet, show position sub-options:
   ```typescript
   {insertionPosition !== null && !state.sidePanel && (
     <div class="va-insert-position-options">
       {(['before', 'after', 'inside'] as InsertionPosition[]).map((pos) => (
         <button
           key={pos}
           class={`va-quick-action ${insertionPosition === pos ? 'va-quick-action--active' : ''}`}
           onClick={() => {
             setInsertionPosition(pos)
             const el = document.querySelector(annotation.element.selector) as HTMLElement
             if (el) dispatch({ type: 'OPEN_SIDE_PANEL', panel: 'insertion', element: el })
           }}
         >
           {pos.toUpperCase()}
         </button>
       ))}
     </div>
   )}
   ```

5. Render `InsertionPanel` when side panel type is `'insertion'`:
   ```typescript
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
   ```

6. Include `insertion` in `handleSave`:
   ```typescript
   ...(insertion && { insertion }),
   ```

### Step 4: Build and manually test

Run: `pnpm build`
Test: `cd demo && pnpm dev` — click element, click INSERT, pick position, pick element type, type text, APPLY.

### Step 5: Commit

```bash
git add src/client/components/InsertionPanel.tsx src/client/components/AnnotationCard.tsx src/client/styles.css
git commit -m "feat: add element insertion panel with position and type selection"
```

---

## Task 9: Style Slider Panels

**Files:**
- Create: `src/client/components/StyleSlider.tsx`
- Create: `src/client/components/StyleSlidersPanel.tsx`
- Modify: `src/client/components/AnnotationCard.tsx`
- Modify: `src/client/styles.css`

Depends on: Task 4 (SidePanel), Task 2 (DOMStateManager)

### Step 1: Create StyleSlider component

Create `src/client/components/StyleSlider.tsx`:

```typescript
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
```

### Step 2: Create StyleSlidersPanel component

Create `src/client/components/StyleSlidersPanel.tsx`:

```typescript
import { h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
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
```

Note: `useRef` import needed — add to the import from `preact/hooks` if not already present.

### Step 3: Add slider styles

Add to `src/client/styles.css`:

```css
/* --- Style Sliders --- */

.va-slider-row {
  display: grid;
  grid-template-columns: 90px 50px 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.va-slider-label {
  font-size: 10px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.va-slider-value {
  font-size: 11px;
  color: #00ff41;
  cursor: pointer;
  text-align: right;
}

.va-slider-value:hover {
  text-decoration: underline;
}

.va-slider-value-input {
  width: 50px;
  padding: 2px 4px;
  background: #111;
  border: 1px solid #00ff41;
  color: #00ff41;
  font-family: inherit;
  font-size: 11px;
  text-align: right;
}

.va-slider-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: #333;
  border-radius: 2px;
  outline: none;
}

.va-slider-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #00ff41;
  cursor: pointer;
}

.va-slider-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #00ff41;
  cursor: pointer;
  border: none;
}

.va-slider-font-family {
  margin-top: 8px;
  margin-bottom: 12px;
}
```

### Step 4: Wire slider panels into AnnotationCard

In `src/client/components/AnnotationCard.tsx`:

1. Import `StyleSlidersPanel`:
   ```typescript
   import { StyleSlidersPanel } from './StyleSlidersPanel'
   ```

2. Add "Adjust..." drill-down buttons for FONT and SPACING quick actions (same pattern as COLOR "Pick color..."):
   ```typescript
   {quickActions.includes('font') && (
     <button
       class="va-quick-action-drill"
       onClick={() => {
         const el = document.querySelector(annotation.element.selector) as HTMLElement
         if (el) dispatch({ type: 'OPEN_SIDE_PANEL', panel: 'font', element: el })
       }}
     >
       Adjust...
     </button>
   )}
   ```
   Same for `spacing`.

3. Render `StyleSlidersPanel` when side panel type is `'font'` or `'spacing'`:
   ```typescript
   {(state.sidePanel?.type === 'font' || state.sidePanel?.type === 'spacing') && state.sidePanel.element && (
     <StyleSlidersPanel
       type={state.sidePanel.type}
       element={state.sidePanel.element}
       domState={domState}
       onApply={(changes) => {
         // Merge slider changes into targetStyles
         // Convert kebab-case keys to camelCase for ComputedStyles
         const camelChanges: Record<string, string> = {}
         for (const [key, val] of Object.entries(changes)) {
           const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
           camelChanges[camel] = val
         }
         setTargetStyles((prev) => ({ ...prev, ...camelChanges }))
         dispatch({ type: 'CLOSE_SIDE_PANEL' })
       }}
       onClose={() => {
         domState.revert(state.sidePanel!.element!)
         dispatch({ type: 'CLOSE_SIDE_PANEL' })
       }}
     />
   )}
   ```

### Step 5: Build and manually test

Run: `pnpm build`
Test: `cd demo && pnpm dev` — click element, click FONT, click "Adjust...", drag sliders, click APPLY.

### Step 6: Commit

```bash
git add src/client/components/StyleSlider.tsx src/client/components/StyleSlidersPanel.tsx src/client/components/AnnotationCard.tsx src/client/styles.css
git commit -m "feat: add style slider panels for font and spacing adjustment"
```

---

## Task 10: Responsive Viewport

**Files:**
- Create: `src/client/components/ViewportOverlay.tsx`
- Modify: `src/client/context.ts`
- Modify: `src/client/components/ControlPanel.tsx`
- Modify: `src/client/components/ElementSelector.tsx`
- Modify: `src/client/hooks/useScreenshot.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`

Depends on: Task 1 (types — `viewportWidth` field)

### Step 1: Add viewport state to context

In `src/client/context.ts`:

Add to `AppState`:

```typescript
  viewport: {
    width: number | null  // null = full/normal mode
    iframe: HTMLIFrameElement | null
  }
```

Add to `AppAction`:

```typescript
  | { type: 'SET_VIEWPORT'; width: number | null }
  | { type: 'SET_VIEWPORT_IFRAME'; iframe: HTMLIFrameElement | null }
```

Add reducer cases:

```typescript
    case 'SET_VIEWPORT':
      return { ...state, viewport: { ...state.viewport, width: action.width } }
    case 'SET_VIEWPORT_IFRAME':
      return { ...state, viewport: { ...state.viewport, iframe: action.iframe } }
```

In `initialState`: `viewport: { width: null, iframe: null }`

In `SET_MODE` when setting to `'inactive'`, also clear viewport:
```typescript
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        hoveredElement: null,
        sidePanel: null,
        ...(action.mode === 'inactive' && { viewport: { width: null, iframe: null } }),
      }
```

### Step 2: Create ViewportOverlay component

Create `src/client/components/ViewportOverlay.tsx`:

```typescript
import { h } from 'preact'
import { useEffect, useRef, useContext } from 'preact/hooks'
import { AppContext } from '../context'

interface ViewportOverlayProps {
  width: number
}

export function ViewportOverlay({ width }: ViewportOverlayProps) {
  const { dispatch } = useContext(AppContext)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe })
    }

    iframe.addEventListener('load', handleLoad)
    return () => {
      iframe.removeEventListener('load', handleLoad)
      dispatch({ type: 'SET_VIEWPORT_IFRAME', iframe: null })
    }
  }, [width])

  return (
    <div class="va-viewport-overlay">
      <div class="va-viewport-frame" style={{ width: `${width}px` }}>
        <div class="va-viewport-label">{width}px</div>
        <iframe
          ref={iframeRef}
          class="va-viewport-iframe"
          src={window.location.href}
          style={{ width: `${width}px` }}
        />
      </div>
    </div>
  )
}
```

### Step 3: Add viewport presets to ControlPanel

In `src/client/components/ControlPanel.tsx`:

Add preset buttons before the existing VISION toggle:

```typescript
const VIEWPORT_PRESETS = [
  { label: '375', width: 375 },
  { label: '768', width: 768 },
  { label: '1024', width: 1024 },
  { label: 'Full', width: null as number | null },
]

// In the JSX, before the VISION label:
{VIEWPORT_PRESETS.map((p) => (
  <button
    key={p.label}
    class={`va-viewport-preset ${state.viewport.width === p.width ? 'va-viewport-preset--active' : ''}`}
    onClick={() => dispatch({ type: 'SET_VIEWPORT', width: p.width })}
  >
    {p.label}
  </button>
))}
```

### Step 4: Update ElementSelector for cross-frame events

In `src/client/components/ElementSelector.tsx`:

The key change is to attach listeners to `iframe.contentDocument` when in viewport mode:

```typescript
// Inside the useEffect:
const targetDoc = state.viewport.iframe?.contentDocument ?? document

// Replace:
//   document.addEventListener('mousemove', onMouseMove, { capture: true })
//   document.addEventListener('click', onClick, { capture: true })
// With:
targetDoc.addEventListener('mousemove', onMouseMove, { capture: true })
targetDoc.addEventListener('click', onClick, { capture: true })

// In cleanup:
return () => {
  targetDoc.removeEventListener('mousemove', onMouseMove, { capture: true })
  targetDoc.removeEventListener('click', onClick, { capture: true })
}
```

Also update `isAnnotatorElement` to work across frames — elements in the iframe won't have `[data-vibe-annotator]` ancestor, so it always returns false (correct behavior for iframe content).

Add `state.viewport.iframe` to the useEffect dependency array.

### Step 5: Add viewport stamping to annotation creation

In `ElementSelector.tsx`, in the `onClick` handler where the annotation object is created (around line 68), add:

```typescript
viewportWidth: state.viewport.width ?? window.innerWidth,
```

### Step 6: Update useScreenshot for iframe

In `src/client/hooks/useScreenshot.ts`:

When viewport iframe is active, target the iframe's document body:

```typescript
const capture = useCallback(async (element: Element): Promise<string | null> => {
  if (!state.visionMode) return null

  const { default: html2canvas } = await import('html2canvas')

  const rect = element.getBoundingClientRect()
  const padding = 200

  // Determine target window/document
  const isIframe = state.viewport.iframe?.contentDocument?.contains(element)
  const targetBody = isIframe
    ? state.viewport.iframe!.contentDocument!.body
    : document.body

  // Hide annotator UI during capture
  const container = document.querySelector('[data-vibe-annotator]') as HTMLElement | null
  if (container) container.style.display = 'none'

  try {
    const canvas = await html2canvas(targetBody, {
      x: 0,
      y: Math.max(0, rect.top + (isIframe ? 0 : window.scrollY) - padding),
      width: isIframe ? state.viewport.width ?? window.innerWidth : window.innerWidth,
      height: rect.height + padding * 2,
      scale: 2,
      useCORS: true,
      logging: false,
    })

    // ... rest of highlight drawing is unchanged ...
```

Add `state.viewport` to the useCallback dependency array.

### Step 7: Render ViewportOverlay in App

In `src/client/App.tsx`, add before the closing `</AppContext.Provider>`:

```typescript
import { ViewportOverlay } from './components/ViewportOverlay'

// In JSX:
{state.viewport.width && state.mode !== 'inactive' && (
  <ViewportOverlay width={state.viewport.width} />
)}
```

### Step 8: Add viewport styles

Add to `src/client/styles.css`:

```css
/* --- Responsive Viewport --- */

.va-viewport-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483640;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 40px;
  overflow-y: auto;
}

.va-viewport-frame {
  position: relative;
  background: #fff;
  box-shadow: 0 0 30px rgba(0, 255, 65, 0.2);
  border: 1px solid #333;
}

.va-viewport-label {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  color: #00ff41;
  font-size: 11px;
  font-family: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
}

.va-viewport-iframe {
  display: block;
  height: 100vh;
  border: none;
}

.va-viewport-preset {
  padding: 4px 8px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #888;
  font-family: inherit;
  font-size: 10px;
  cursor: pointer;
}

.va-viewport-preset:hover {
  border-color: #555;
}

.va-viewport-preset--active {
  border-color: #00ff41;
  color: #00ff41;
}
```

### Step 9: Build and manually test

Run: `pnpm build`
Test: `cd demo && pnpm dev` — click floating icon to activate, click "375" preset, verify iframe appears at 375px width, select element in iframe, create annotation, verify viewportWidth in export.

### Step 10: Commit

```bash
git add src/client/components/ViewportOverlay.tsx src/client/components/ControlPanel.tsx src/client/context.ts src/client/components/ElementSelector.tsx src/client/hooks/useScreenshot.ts src/client/App.tsx src/client/styles.css
git commit -m "feat: add responsive viewport with iframe overlay and cross-frame annotation"
```

---

## Task 11: Integration Testing + Polish

**Files:**
- All files from previous tasks
- Full test suite

Depends on: All previous tasks

### Step 1: Run full test suite

Run: `pnpm test`
Expected: All tests pass (20 original + ~13 domState + ~7 export + ~7 colorExtraction)

### Step 2: Build and verify

Run: `pnpm build`
Expected: Clean build, no TypeScript errors, no warnings

### Step 3: Manual integration test in demo

Run: `cd demo && pnpm dev`

Test each feature end-to-end:

1. **DOM State Manager**: Verify preview/revert lifecycle works across features. Select element, open slider, adjust, close without applying — element should revert to original.

2. **Live Text Editing**: Click element with text → EDIT TEXT → type new text → SAVE TEXT. Click SAVE on card. Export and verify `**Text change:**` appears.

3. **Color Picker**: Click element → COLOR toggle → "Pick color..." → pick a swatch → APPLY. Save annotation. Export and verify color change line appears.

4. **Element Insertion**: Click element → INSERT → AFTER → Button → type "Click me" → add notes → APPLY. Save. Export and verify `**Change type:** Insert new element` appears.

5. **Style Sliders**: Click element → FONT toggle → "Adjust..." → drag font-size slider → APPLY. Verify `targetStyles` includes the new value. Export and verify style change line.

6. **Responsive Viewport**: Click 375 preset → iframe appears at 375px → select element inside iframe → save annotation. Export and verify `**Viewport:** 375px (Mobile)`. Click "Full" → iframe disappears.

### Step 4: Verify export with multiple features on one annotation

Create an annotation that uses text editing + color change + style sliders on the same element. Export and verify all sections appear correctly.

### Step 5: Fix any issues found during testing

Address TypeScript errors, styling issues, event handling bugs, etc.

### Step 6: Final commit

```bash
git add -A
git commit -m "feat: integration testing and polish for interactive features"
```

---

## Summary

| Task | Feature | New Tests | New Files | Modified Files |
|------|---------|-----------|-----------|----------------|
| 1 | Shared Types | 0 | 0 | `types.ts` |
| 2 | DOM State Manager | ~13 | 2 | 0 |
| 3 | useDOMState + Export | ~7 | 1 | `export.ts`, `export.test.ts` |
| 4 | Side Panel + Context | 0 | 1 | `context.ts`, `styles.css` |
| 5 | Live Text Editing | 0 | 1 | `AnnotationCard.tsx`, `styles.css` |
| 6 | Color Extraction | ~7 | 2 | 0 |
| 7 | Color Picker Panel | 0 | 1 | `AnnotationCard.tsx`, `styles.css` |
| 8 | Element Insertion | 0 | 1 | `AnnotationCard.tsx`, `styles.css` |
| 9 | Style Sliders | 0 | 2 | `AnnotationCard.tsx`, `styles.css` |
| 10 | Responsive Viewport | 0 | 1 | `ControlPanel.tsx`, `ElementSelector.tsx`, `useScreenshot.ts`, `App.tsx`, `context.ts`, `styles.css` |
| 11 | Integration | 0 | 0 | Various |

**Total: ~27 new tests, 12 new files, extensive modifications to AnnotationCard.tsx and styles.css**
