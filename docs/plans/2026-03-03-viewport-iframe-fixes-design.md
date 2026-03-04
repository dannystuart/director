# Fix: Viewport Iframe — Pins, Element Resolution, Interactive Features

## Status
Design complete. Ready for implementation.

## Problem

When the responsive viewport creates an iframe (`ViewportOverlay`), three things break:

1. **Pins invisible**: `PinMarker` does `document.querySelector(selector)` on the parent document. The actual element is inside the iframe. Pins render at parent-page coordinates, hidden behind the opaque viewport overlay (z-index 2147483640).

2. **Interactive features target wrong element**: `AnnotationCard` does `document.querySelector(selector)` in ~6 places for TextEditor, ColorPicker, StyleSliders, InsertionPanel. All find the parent-page element (behind overlay) instead of the iframe element.

3. **TextEditor positioned behind overlay**: TextEditor creates an editable overlay on the parent-page element, which is invisible to the user.

**Root cause**: Every `document.querySelector()` call resolves against the parent document when the element actually lives in `iframe.contentDocument`.

## Prior Work (Already Implemented)

The postMessage bridge (`src/client/bridge.ts`) and iframe guard (`src/client/index.tsx`) are already done. Element selection inside the iframe works — clicking an element posts `va:element-selected` to the parent, which creates the annotation. The issue is everything that happens *after* the annotation is created.

## Solution: Element Resolution Helper + Coordinate Mapping

### New File: `src/client/utils/resolveElement.ts`

Two helper functions:

```typescript
/**
 * Query an element from the correct document.
 * When a viewport iframe is active, queries iframe.contentDocument.
 * Otherwise queries the parent document.
 */
export function resolveElement(
  selector: string,
  viewport: { iframe: HTMLIFrameElement | null }
): HTMLElement | null {
  const doc = viewport.iframe?.contentDocument ?? document
  return doc.querySelector(selector) as HTMLElement | null
}

/**
 * Get an element's bounding rect mapped to parent-page coordinates.
 * When viewport iframe is active, offsets by the iframe's position.
 * Accounts for viewport overlay scroll.
 */
export function resolveRect(
  el: HTMLElement,
  viewport: { iframe: HTMLIFrameElement | null }
): DOMRect {
  const rect = el.getBoundingClientRect()
  if (!viewport.iframe) return rect

  const iframeRect = viewport.iframe.getBoundingClientRect()
  return new DOMRect(
    iframeRect.left + rect.left,
    iframeRect.top + rect.top,
    rect.width,
    rect.height
  )
}
```

### Changes by File

All files are in `.worktrees/interactive-features/src/client/`.

#### 1. `components/PinMarker.tsx`

Two `document.querySelector()` calls (lines 22 and 33) need updating.

- Import `resolveElement` and `resolveRect`
- Access `state.viewport` from context (add `useContext(AppContext)` — already has it via `dispatch`)
- Replace `document.querySelector(annotation.element.selector)` with `resolveElement(annotation.element.selector, state.viewport)`
- Replace `rect.left + window.scrollX` / `rect.top + window.scrollY` position calculation with `resolveRect(el, state.viewport)` when viewport iframe is active
- When viewport iframe is active, use `position: fixed` instead of `position: absolute` (since the pin is positioned relative to the viewport, not the document). Alternatively, keep absolute but offset by iframe position on page.

**Coordinate math for viewport mode:**
```
pinX = iframeRect.left + elementRect.left - 11 + siblingOffset
pinY = iframeRect.top + elementRect.top - 11
```

Note: The viewport overlay has `overflow-y: auto` and `padding-top: 40px`. If the overlay scrolls, pins in `position: fixed` on the parent stay correct since `iframeRect` already reflects scroll state. But if pins use `position: absolute` with `scrollY`, we need the overlay's scrollTop instead of `window.scrollY`.

**Recommendation**: Switch PinMarker to `position: fixed` in viewport mode (no scroll offset needed since `getBoundingClientRect` returns viewport-relative coords).

#### 2. `components/AnnotationCard.tsx`

Six `document.querySelector()` calls:

| Line | Context | Fix |
|------|---------|-----|
| 228 | "Edit Text" button — check if element is leaf node | `resolveElement(selector, state.viewport)` |
| 254 | Insertion position — open side panel | `resolveElement(selector, state.viewport)` |
| 265 | TextEditor — get element for editing | `resolveElement(selector, state.viewport)` |
| 419 | Color picker — open side panel | `resolveElement(selector, state.viewport)` |
| 431 | Font slider — open side panel | `resolveElement(selector, state.viewport)` |
| 443 | Spacing slider — open side panel | `resolveElement(selector, state.viewport)` |

All are straightforward replacements. The element returned will be from the iframe's document, so TextEditor/ColorPicker/StyleSliders will operate on the correct element.

**Card positioning**: `computeCardPosition()` uses `annotation.element.boundingBox` which was captured at annotation creation time (iframe-relative coords from the bridge). In viewport mode, these coords need iframe offset added. Either:
- Update `computeCardPosition` to accept viewport state and offset
- Or pass already-mapped coords

**Recommendation**: Add viewport-aware positioning to `computeCardPosition`:
```typescript
function computeCardPosition(
  box: BoundingBox,
  viewport: { iframe: HTMLIFrameElement | null }
) {
  let { x, y, width, height } = box
  if (viewport.iframe) {
    const ir = viewport.iframe.getBoundingClientRect()
    x += ir.left
    y += ir.top
  }
  // ... rest unchanged
}
```

#### 3. `components/TextEditor.tsx`

TextEditor receives `element` as a prop — it doesn't do its own querySelector. So the fix in AnnotationCard (passing the correct element) handles this.

**But**: TextEditor positions its overlay using `element.getBoundingClientRect()`. In viewport mode, these coords are iframe-relative. The overlay renders in the parent document, so it needs mapped coordinates.

TextEditor should accept an optional `rectOffset` or use `resolveRect`:
```typescript
// In TextEditor, when positioning the overlay:
const rect = resolveRect(element, viewport)
```

This requires passing `viewport` to TextEditor (via props or context).

#### 4. `components/ColorPickerPanel.tsx`, `StyleSlidersPanel.tsx`, `InsertionPanel.tsx`

These receive `element` as a prop from AnnotationCard. Once AnnotationCard passes the correct element (from iframe), these work correctly:
- ColorPicker reads `getComputedStyle(element)` — works cross-document
- ColorPicker writes `element.style.backgroundColor = ...` — works on iframe element
- StyleSliders read/write element styles — same
- InsertionPanel reads element position — needs `resolveRect` for positioning

**Check each panel's positioning logic**: If any panel positions itself relative to the element, it needs `resolveRect` mapping.

#### 5. `hooks/useScreenshot.ts`

Already has iframe-aware logic (lines 18-21). When `state.viewport.iframe` is active, it captures `iframe.contentDocument.body`. This should still work, but double-check the element reference:
- In viewport mode with bridge, the screenshot is captured by the bridge (inside iframe) and uploaded to the API
- After annotation creation, if useScreenshot is called again (e.g., for re-capture), it needs `resolveElement` too

**Low priority**: The bridge already handles screenshot capture on initial click. Re-capture from AnnotationCard is an edge case.

## Coordinate Mapping Summary

| Component | Needs querySelector fix | Needs coordinate mapping |
|-----------|------------------------|-------------------------|
| PinMarker | Yes (2 calls) | Yes (pin position) |
| AnnotationCard | Yes (6 calls) | Yes (card position) |
| TextEditor | No (receives element) | Yes (overlay position) |
| ColorPickerPanel | No (receives element) | Maybe (panel position) |
| StyleSlidersPanel | No (receives element) | Maybe (panel position) |
| InsertionPanel | No (receives element) | Maybe (panel position) |

## Implementation Order

1. Create `src/client/utils/resolveElement.ts` with both helpers
2. Update `PinMarker` — element resolution + coordinate mapping + position: fixed in viewport mode
3. Update `AnnotationCard` — element resolution + card positioning
4. Update `TextEditor` — overlay positioning with resolveRect
5. Audit side panels (ColorPicker, StyleSliders, Insertion) for positioning issues
6. Build + test
7. Manual verification: select viewport preset, hover/click elements, verify pins visible, annotation card positioned correctly, text editing works on iframe element

## Edge Cases

- **Element not found in iframe**: If `resolveElement` returns null (element removed from iframe DOM), gracefully degrade — hide pin, show "element not found" in card.
- **Iframe not yet loaded**: `contentDocument` may be null before iframe loads. The `SET_VIEWPORT_IFRAME` dispatch happens on iframe load event, so this should be safe.
- **Viewport overlay scroll**: If user scrolls the overlay, `getBoundingClientRect` on the iframe automatically reflects the new position. Pins using `position: fixed` stay correct.
- **Multiple annotations at different viewports**: Each annotation stores its `viewportWidth`. Pins for annotations made at a different viewport width than the current one may not align (the element might be at a different position at 375px vs 768px). This is acceptable — pins are most useful at the viewport they were created in.

## Viewport Context in Exported Markdown

Already handled. The export includes:
```
**Viewport:** 375px (Mobile)
```
for annotations with `viewportWidth < 1024`. AI agents use this to scope changes to the correct media query.

## Files to Change Summary

| File | Type | Lines changed (est.) |
|------|------|---------------------|
| `src/client/utils/resolveElement.ts` | New | ~25 |
| `src/client/components/PinMarker.tsx` | Edit | ~15 |
| `src/client/components/AnnotationCard.tsx` | Edit | ~20 |
| `src/client/components/TextEditor.tsx` | Edit | ~10 |
| Side panels (audit) | Edit | ~5-10 each |

Total: ~80-100 lines changed.
