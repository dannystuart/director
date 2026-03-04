# Viewport Iframe Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all parent-side components (PinMarker, AnnotationCard, TextEditor, side panels) correctly resolve elements and position themselves when the user's page is rendered inside the responsive viewport iframe.

**Architecture:** When the viewport overlay is active, the user's page lives inside an `<iframe>` at `state.viewport.iframe`. Parent-side components currently call `document.querySelector(selector)` on the parent document where the element doesn't exist — it's inside the iframe. We create a `resolveElement.ts` utility with three helpers (`resolveElement`, `resolveRect`, `getComputedStyleSafe`) and thread them through all affected components. Coordinate mapping translates iframe-local rects to parent viewport coordinates via the iframe's own bounding rect.

**Tech Stack:** Preact, TypeScript strict, vitest + jsdom for tests

---

### Task 1: Create `resolveElement.ts` with `resolveElement` + `resolveRect` + `getComputedStyleSafe`

**Files:**
- Create: `src/client/utils/resolveElement.ts`
- Test: `src/client/utils/__tests__/resolveElement.test.ts`

**Step 1: Write the failing tests**

Create `src/client/utils/__tests__/resolveElement.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveElement, resolveRect, getComputedStyleSafe } from '../resolveElement'

describe('resolveElement', () => {
  let el: HTMLElement

  beforeEach(() => {
    el = document.createElement('div')
    el.id = 'test-el'
    document.body.appendChild(el)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('queries parent document when no iframe', () => {
    const result = resolveElement('#test-el', null)
    expect(result).toBe(el)
  })

  it('returns null for missing selector with no iframe', () => {
    const result = resolveElement('#nonexistent', null)
    expect(result).toBeNull()
  })
})

describe('resolveRect', () => {
  it('returns element rect directly when no iframe', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const rect = resolveRect(el, null)
    expect(rect).toHaveProperty('x')
    expect(rect).toHaveProperty('y')
    expect(rect).toHaveProperty('width')
    expect(rect).toHaveProperty('height')
    document.body.innerHTML = ''
  })
})

describe('getComputedStyleSafe', () => {
  it('returns computed style for parent document element', () => {
    const el = document.createElement('div')
    el.style.color = 'red'
    document.body.appendChild(el)
    const cs = getComputedStyleSafe(el)
    expect(cs).toBeDefined()
    // jsdom computed style support is limited, just check it doesn't throw
    document.body.innerHTML = ''
  })
})
```

Note: jsdom cannot create real iframes with contentDocument, so iframe-specific paths are verified via manual testing in the demo app. The unit tests cover the non-iframe codepath (which is the fallback/default).

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/client/utils/__tests__/resolveElement.test.ts`
Expected: FAIL — module `../resolveElement` not found

**Step 3: Write the implementation**

Create `src/client/utils/resolveElement.ts`:

```typescript
/**
 * Resolve an element by CSS selector, checking inside an iframe if provided.
 * Falls back to parent document when no iframe is set.
 */
export function resolveElement(
  selector: string,
  iframe: HTMLIFrameElement | null,
): HTMLElement | null {
  if (iframe) {
    try {
      return iframe.contentDocument?.querySelector(selector) as HTMLElement | null
    } catch {
      return null // cross-origin or detached iframe
    }
  }
  return document.querySelector(selector) as HTMLElement | null
}

/**
 * Get a bounding rect for an element, mapped to parent viewport coordinates
 * when inside an iframe. Returns the element's normal rect when no iframe.
 */
export function resolveRect(
  element: HTMLElement,
  iframe: HTMLIFrameElement | null,
): DOMRect {
  const elRect = element.getBoundingClientRect()
  if (!iframe) return elRect

  const iframeRect = iframe.getBoundingClientRect()
  return new DOMRect(
    iframeRect.left + elRect.left,
    iframeRect.top + elRect.top,
    elRect.width,
    elRect.height,
  )
}

/**
 * Get computed style using the element's own window context.
 * Works correctly for elements inside iframes (same-origin).
 */
export function getComputedStyleSafe(element: HTMLElement): CSSStyleDeclaration {
  const view = element.ownerDocument.defaultView ?? window
  return view.getComputedStyle(element)
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/client/utils/__tests__/resolveElement.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/client/utils/resolveElement.ts src/client/utils/__tests__/resolveElement.test.ts
git commit -m "feat: add resolveElement helpers for iframe element resolution"
```

---

### Task 2: Update PinMarker — use iframe element + mapped coordinates

**Files:**
- Modify: `src/client/components/PinMarker.tsx`

**Context:** PinMarker has 3 spots that query/observe the parent document:
- Line 21: `document.querySelector(selector)` — element lookup for position
- Line 31: `document.body` — MutationObserver target
- Line 33: `document.querySelector(selector)` — ResizeObserver target

All need to use the iframe document when viewport is active.

**Step 1: Apply changes to PinMarker**

```typescript
// Add imports at top
import { resolveElement, resolveRect } from '../utils/resolveElement'

// Add state.viewport.iframe from context
const { state, dispatch } = useContext(AppContext)
const iframe = state.viewport.iframe
```

Replace the `useEffect` body (lines 19-43):

```typescript
useEffect(() => {
  const updatePos = () => {
    const el = resolveElement(annotation.element.selector, iframe)
    if (el) {
      const rect = resolveRect(el, iframe)
      setPos({ x: rect.left + window.scrollX, y: rect.top + window.scrollY })
    }
  }

  updatePos()

  // Observe mutations in the correct document
  const observeTarget = iframe
    ? iframe.contentDocument?.body ?? document.body
    : document.body
  observerRef.current = new MutationObserver(updatePos)
  observerRef.current.observe(observeTarget, { childList: true, subtree: true, attributes: true })

  const el = resolveElement(annotation.element.selector, iframe)
  if (el) {
    resizeRef.current = new ResizeObserver(updatePos)
    resizeRef.current.observe(el)
  }

  return () => {
    observerRef.current?.disconnect()
    resizeRef.current?.disconnect()
  }
}, [annotation.element.selector, iframe])
```

**Step 2: Verify build compiles**

Run: `pnpm build`
Expected: Clean build, no type errors

**Step 3: Commit**

```bash
git add src/client/components/PinMarker.tsx
git commit -m "feat: update PinMarker to resolve elements from iframe"
```

---

### Task 3: Update AnnotationCard — 6 querySelector calls + card positioning

**Files:**
- Modify: `src/client/components/AnnotationCard.tsx`

**Context:** AnnotationCard has 6 `document.querySelector` calls and a `computeCardPosition` that uses stored boundingBox coordinates (which are iframe-local). All need iframe awareness.

The 6 querySelector calls:
1. Line 228 — EDIT TEXT leaf-node check
2. Line 254 — INSERT position click → OPEN_SIDE_PANEL
3. Line 265 — TextEditor element prop
4. Line 419 — COLOR "Pick color..." drill
5. Line 430 — FONT "Adjust font..." drill
6. Line 441 — SPACING "Adjust spacing..." drill

**Step 1: Add imports and resolve element once**

```typescript
import { resolveElement, resolveRect } from '../utils/resolveElement'
```

Add near the top of the component function (after the annotation lookup):

```typescript
const iframe = state.viewport.iframe
```

**Step 2: Replace all 6 querySelector calls**

Replace each `document.querySelector(annotation.element.selector) as HTMLElement` with:

```typescript
resolveElement(annotation.element.selector, iframe) as HTMLElement
```

Specifically at lines:
- ~228: `const el = resolveElement(annotation.element.selector, iframe) as HTMLElement`
- ~254: `const el = resolveElement(annotation.element.selector, iframe) as HTMLElement`
- ~265: `const el = resolveElement(annotation.element.selector, iframe) as HTMLElement`
- ~419: `const el = resolveElement(annotation.element.selector, iframe) as HTMLElement`
- ~430: `const el = resolveElement(annotation.element.selector, iframe) as HTMLElement`
- ~441: `const el = resolveElement(annotation.element.selector, iframe) as HTMLElement`

**Step 3: Fix card positioning**

Update `computeCardPosition` to accept an optional iframe param and use live resolveRect instead of stored boundingBox:

Change the call site (line ~216) from:
```typescript
const cardStyle = computeCardPosition(annotation.element.boundingBox)
```
To:
```typescript
const resolvedEl = resolveElement(annotation.element.selector, iframe)
const liveBox = resolvedEl
  ? resolveRect(resolvedEl, iframe)
  : annotation.element.boundingBox
const cardStyle = computeCardPosition(liveBox)
```

No changes needed to `computeCardPosition` itself — it already takes `{ x, y, width, height }` and `DOMRect` satisfies that shape.

**Step 4: Verify build compiles**

Run: `pnpm build`
Expected: Clean build

**Step 5: Commit**

```bash
git add src/client/components/AnnotationCard.tsx
git commit -m "feat: update AnnotationCard to resolve elements from iframe"
```

---

### Task 4: Update TextEditor — cross-frame contentEditable + overlay positioning

**Files:**
- Modify: `src/client/components/TextEditor.tsx`

**Context:** TextEditor makes the target element `contentEditable`, focuses it, and creates a Selection/Range. When the element is inside an iframe, the Range and Selection APIs must use the iframe's document/window, not the parent's.

**Step 1: Fix focus/selection to use element's own document**

In the `useEffect` (lines 15-34), replace:

```typescript
element.focus()
const range = document.createRange()
range.selectNodeContents(element)
const sel = window.getSelection()
sel?.removeAllRanges()
sel?.addRange(range)
```

With:

```typescript
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
```

**Step 2: Position inline action buttons near the element**

Add `resolveRect` import and accept an `iframe` prop:

```typescript
import { resolveRect } from '../utils/resolveElement'
```

Update the interface:
```typescript
interface TextEditorProps {
  element: HTMLElement
  iframe: HTMLIFrameElement | null
  domState: DOMStateManager
  onSave: (original: string, updated: string) => void
  onCancel: () => void
}
```

Add positioning to the rendered div:
```typescript
const rect = resolveRect(element, iframe)
const actionStyle = {
  left: `${rect.left}px`,
  top: `${rect.bottom + 4}px`,
}

return (
  <div class="va-text-editor-actions va-text-editor-inline-actions" style={actionStyle} onKeyDown={handleKeyDown}>
    ...
  </div>
)
```

**Step 3: Update the call site in AnnotationCard**

In AnnotationCard where TextEditor is rendered (~line 268), add the `iframe` prop:

```typescript
<TextEditor
  element={el}
  iframe={iframe}
  domState={domState}
  onSave={...}
  onCancel={...}
/>
```

**Step 4: Verify build compiles**

Run: `pnpm build`
Expected: Clean build

**Step 5: Commit**

```bash
git add src/client/components/TextEditor.tsx src/client/components/AnnotationCard.tsx
git commit -m "feat: update TextEditor for cross-frame editing and positioning"
```

---

### Task 5: Audit side panels — getComputedStyle safety

**Files:**
- Modify: `src/client/components/ColorPickerPanel.tsx`
- Modify: `src/client/components/StyleSlidersPanel.tsx`

**Context:** Both panels receive an `element: HTMLElement` prop and call `getComputedStyle(element)`. When the element is from an iframe, `window.getComputedStyle(iframeElement)` may not return correct values — must use `element.ownerDocument.defaultView.getComputedStyle(element)` instead. The `getComputedStyleSafe` helper handles this.

**Step 1: Update ColorPickerPanel**

Add import:
```typescript
import { getComputedStyleSafe } from '../utils/resolveElement'
```

Replace 2 calls to `getComputedStyle(element)`:
- Line 35 (in `getDefaultProperty`): `getComputedStyle(element).backgroundColor` → `getComputedStyleSafe(element).backgroundColor`
- Line 59: `getComputedStyle(element).getPropertyValue(...)` → `getComputedStyleSafe(element).getPropertyValue(...)`

**Step 2: Update StyleSlidersPanel**

Add import:
```typescript
import { getComputedStyleSafe } from '../utils/resolveElement'
```

Replace 2 calls to `getComputedStyle(element)`:
- Line 57: `getComputedStyle(element)` → `getComputedStyleSafe(element)`
- Line 84: `getComputedStyle(element).fontFamily` → `getComputedStyleSafe(element).fontFamily`

**Step 3: Verify build compiles**

Run: `pnpm build`
Expected: Clean build

**Step 4: Commit**

```bash
git add src/client/components/ColorPickerPanel.tsx src/client/components/StyleSlidersPanel.tsx
git commit -m "feat: use getComputedStyleSafe in side panels for iframe compat"
```

---

### Task 6: Build + run existing tests + manual verify

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All existing tests pass (20+ tests including new resolveElement tests)

**Step 2: Run build**

Run: `pnpm build`
Expected: Clean build, both plugin (ESM+CJS) and client (IIFE) output

**Step 3: Manual verification in demo app**

Run: `cd demo && pnpm dev`

Test matrix:
1. **No viewport** (normal mode) — click elements, create annotations, verify PinMarker positions, open TextEditor, use color picker, use style sliders. Everything should work identically to before.
2. **With viewport** (select a responsive width from ControlPanel) — repeat all actions above through the iframe. Specifically verify:
   - PinMarker pins appear at correct positions overlaying the iframe
   - AnnotationCard positions next to the selected element (not at iframe-local coords)
   - EDIT TEXT makes the iframe element contentEditable and selects its text
   - Color picker reads computed styles from the iframe element
   - Style sliders read/write correct values on the iframe element
   - INSERT panel opens correctly

**Step 4: Commit any fixes from manual testing**

```bash
git add -u
git commit -m "fix: address issues found in manual viewport testing"
```

---

## Known Limitations (out of scope)

- **`extractPageColors()` in ColorPickerPanel** — scans parent document stylesheets, won't pick up iframe-specific CSS custom properties. Follow-up: pass iframe document to `extractPageColors`.
- **Screenshot capture in bridge** — already handled by the bridge's own html2canvas call. No changes needed.
- **InsertionPanel** — doesn't reference live elements (only uses `targetSelector` string and dispatches data). No changes needed.
- **SidePanel** (wrapper component) — pure layout, no element references. No changes needed.
