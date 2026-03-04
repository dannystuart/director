# Viewport Pin Scoping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scope pin visibility to the active viewport so only relevant pins show, and enrich exports with viewport context and conflict awareness.

**Architecture:** Filter pins in `App.tsx` before rendering — show a pin if its `viewportWidth` is `null` (Full mode) or matches `state.viewport.width`. Store `viewportWidth: null` for Full mode annotations instead of falling back to `window.innerWidth`. Add viewport tags to pin tooltips and conflict notes to the export.

**Tech Stack:** Preact, TypeScript strict, vitest (jsdom env for client tests)

---

### Task 1: Update Annotation type to allow null viewportWidth

**Files:**
- Modify: `src/shared/types.ts:99`

**Step 1: Change the type**

In `src/shared/types.ts`, line 99, change:

```ts
viewportWidth?: number
```

to:

```ts
viewportWidth?: number | null
```

This allows `null` to mean "Full mode" while `undefined` means "not set" (backwards compat with old annotations).

**Step 2: Build to verify no type errors**

Run: `pnpm build`
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: allow null viewportWidth for full-mode annotations"
```

---

### Task 2: Store null viewportWidth for Full mode annotations

**Files:**
- Modify: `src/client/components/ElementSelector.tsx:50,142`

**Step 1: Write the failing test**

Create `src/client/components/__tests__/ElementSelector.viewportWidth.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

describe('ElementSelector viewportWidth logic', () => {
  it('should produce null for Full mode (width=null)', () => {
    // The logic under test: viewportWidth assignment
    // Full mode: state.viewport.width is null -> store null
    const stateViewportWidth: number | null = null
    const viewportWidth = stateViewportWidth ?? null
    expect(viewportWidth).toBe(null)
  })

  it('should produce preset width for viewport mode', () => {
    const stateViewportWidth: number | null = 375
    const viewportWidth = stateViewportWidth ?? null
    expect(viewportWidth).toBe(375)
  })
})
```

**Step 2: Run test to verify it passes (this is a unit test for the logic pattern)**

Run: `pnpm test -- src/client/components/__tests__/ElementSelector.viewportWidth.test.ts`
Expected: PASS — these tests validate the logic we'll apply.

**Step 3: Fix bridge mode viewportWidth (line 50)**

In `src/client/components/ElementSelector.tsx`, line 50, change:

```ts
viewportWidth: data.viewportWidth ?? state.viewport.width ?? window.innerWidth,
```

to:

```ts
viewportWidth: state.viewport.width ?? null,
```

When in Full mode (`state.viewport.width` is `null`), this stores `null`. When in viewport mode, it stores the preset width. The bridge's `data.viewportWidth` is no longer needed — the parent knows the mode.

**Step 4: Fix direct mode viewportWidth (line 142)**

In `src/client/components/ElementSelector.tsx`, line 142, change:

```ts
viewportWidth: state.viewport.width ?? window.innerWidth,
```

to:

```ts
viewportWidth: state.viewport.width ?? null,
```

**Step 5: Build to verify no type errors**

Run: `pnpm build`
Expected: Clean build.

**Step 6: Commit**

```bash
git add src/client/components/ElementSelector.tsx src/client/components/__tests__/ElementSelector.viewportWidth.test.ts
git commit -m "feat: store null viewportWidth for full-mode annotations"
```

---

### Task 3: Filter pins by viewport in App.tsx

**Files:**
- Modify: `src/client/App.tsx:29-35`

**Step 1: Write the failing test**

Create `src/client/__tests__/pinFiltering.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { Annotation } from '../../shared/types'

/**
 * Pin visibility filter logic (extracted for testability):
 * Show pin if viewportWidth is null (Full mode) OR matches current viewport.
 * If current viewport is null (Full mode), show all pins.
 */
function filterVisibleAnnotations(
  annotations: Annotation[],
  currentViewportWidth: number | null
): Annotation[] {
  if (currentViewportWidth === null) return annotations
  return annotations.filter(
    (ann) => ann.viewportWidth == null || ann.viewportWidth === currentViewportWidth
  )
}

const makeAnnotation = (overrides: Partial<Annotation> = {}): Annotation => ({
  id: 'ann_1',
  number: 1,
  timestamp: '2026-01-01T00:00:00Z',
  priority: 'high',
  element: {
    selector: 'main > h1',
    xpath: '/html/body/main/h1',
    tag: 'h1',
    textContent: 'Welcome',
    boundingBox: { x: 0, y: 0, width: 200, height: 40 },
  },
  computedStyles: {},
  targetStyles: {},
  comment: '',
  quickActions: [],
  screenshot: null,
  referenceImage: null,
  ...overrides,
})

describe('filterVisibleAnnotations', () => {
  it('shows all pins when current viewport is null (Full mode)', () => {
    const annotations = [
      makeAnnotation({ id: 'a', viewportWidth: null }),
      makeAnnotation({ id: 'b', viewportWidth: 375 }),
      makeAnnotation({ id: 'c', viewportWidth: 1024 }),
    ]
    const result = filterVisibleAnnotations(annotations, null)
    expect(result).toHaveLength(3)
  })

  it('shows Full mode pins on any viewport', () => {
    const annotations = [
      makeAnnotation({ id: 'a', viewportWidth: null }),
      makeAnnotation({ id: 'b', viewportWidth: 375 }),
    ]
    const result = filterVisibleAnnotations(annotations, 375)
    expect(result).toHaveLength(2)
  })

  it('hides pins from a different viewport', () => {
    const annotations = [
      makeAnnotation({ id: 'a', viewportWidth: 375 }),
      makeAnnotation({ id: 'b', viewportWidth: 768 }),
    ]
    const result = filterVisibleAnnotations(annotations, 375)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('shows pins with undefined viewportWidth (legacy compat)', () => {
    const annotations = [
      makeAnnotation({ id: 'a' }), // viewportWidth is undefined
    ]
    const result = filterVisibleAnnotations(annotations, 375)
    expect(result).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/client/__tests__/pinFiltering.test.ts`
Expected: PASS (the function is defined inline in the test — we're TDD'ing the logic before wiring it up).

**Step 3: Extract filter helper and apply in App.tsx**

Create `src/client/utils/pinFiltering.ts`:

```ts
import type { Annotation } from '../../shared/types'

/**
 * Filter annotations visible at the current viewport.
 * - Full mode (currentViewportWidth === null): show all pins
 * - Viewport mode: show Full mode pins (null) + matching viewport pins
 * - Legacy pins (viewportWidth === undefined): always visible
 */
export function filterVisibleAnnotations(
  annotations: Annotation[],
  currentViewportWidth: number | null
): Annotation[] {
  if (currentViewportWidth === null) return annotations
  return annotations.filter(
    (ann) => ann.viewportWidth == null || ann.viewportWidth === currentViewportWidth
  )
}
```

**Step 4: Update the test to import from the module**

Update `src/client/__tests__/pinFiltering.test.ts` — replace the inline function with:

```ts
import { filterVisibleAnnotations } from '../utils/pinFiltering'
```

Remove the inline `filterVisibleAnnotations` function definition.

**Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/client/__tests__/pinFiltering.test.ts`
Expected: All 4 tests PASS.

**Step 6: Wire up filtering in App.tsx**

In `src/client/App.tsx`, add import at the top:

```ts
import { filterVisibleAnnotations } from './utils/pinFiltering'
```

Replace lines 29-35:

```tsx
{state.mode !== 'inactive' &&
  state.annotations.map((ann) => {
    const siblingIndex = state.annotations
      .filter((a) => a.element.selector === ann.element.selector)
      .findIndex((a) => a.id === ann.id)
    return <PinMarker key={ann.id} annotation={ann} siblingIndex={siblingIndex} />
  })}
```

with:

```tsx
{state.mode !== 'inactive' &&
  (() => {
    const visible = filterVisibleAnnotations(state.annotations, state.viewport.width)
    return visible.map((ann) => {
      const siblingIndex = visible
        .filter((a) => a.element.selector === ann.element.selector)
        .findIndex((a) => a.id === ann.id)
      return <PinMarker key={ann.id} annotation={ann} siblingIndex={siblingIndex} />
    })
  })()}
```

Note: sibling index is computed from the **filtered** set so stacking stays correct.

**Step 7: Build to verify no errors**

Run: `pnpm build`
Expected: Clean build.

**Step 8: Commit**

```bash
git add src/client/utils/pinFiltering.ts src/client/__tests__/pinFiltering.test.ts src/client/App.tsx
git commit -m "feat: filter pin visibility by active viewport"
```

---

### Task 4: Add viewport tag to pin tooltip

**Files:**
- Modify: `src/client/components/PinMarker.tsx:83-85`
- Modify: `src/client/styles.css` (after line 473)

**Step 1: Add viewport tag CSS**

In `src/client/styles.css`, after the `.va-pin:hover .va-pin-tooltip` block (line 473), add:

```css
.va-pin-viewport-tag {
  color: #00ff41;
  margin-right: 4px;
  font-weight: 600;
}
```

**Step 2: Update PinMarker tooltip JSX**

In `src/client/components/PinMarker.tsx`, replace lines 83-85:

```tsx
<span class="va-pin-tooltip">
  {annotation.comment || 'No comment'}
</span>
```

with:

```tsx
<span class="va-pin-tooltip">
  <span class="va-pin-viewport-tag">
    [{annotation.viewportWidth == null ? 'Full' : `${annotation.viewportWidth}px`}]
  </span>
  {annotation.comment || 'No comment'}
</span>
```

**Step 3: Build to verify no errors**

Run: `pnpm build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add src/client/components/PinMarker.tsx src/client/styles.css
git commit -m "feat: show viewport origin tag in pin tooltip"
```

---

### Task 5: Update export viewport labeling

**Files:**
- Modify: `src/client/utils/export.ts:33-37`
- Modify: `src/client/utils/__tests__/export.test.ts`

**Step 1: Write failing tests for updated viewport labels**

In `src/client/utils/__tests__/export.test.ts`, add these tests inside the existing `describe` block:

```ts
it('omits viewport line for full-mode (null viewportWidth)', () => {
  const md = buildExportMarkdown([makeAnnotation({ viewportWidth: null })])
  expect(md).not.toContain('**Viewport:**')
})

it('includes viewport for 1024px as Desktop', () => {
  const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 1024 })])
  expect(md).toContain('**Viewport:** 1024px (Desktop)')
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/client/utils/__tests__/export.test.ts`
Expected: The 1024px test fails (current code skips viewport for >= 1024). The null test should pass already.

**Step 3: Update viewport label logic**

In `src/client/utils/export.ts`, replace lines 33-37:

```ts
// Viewport (only for non-desktop)
if (ann.viewportWidth && ann.viewportWidth < 1024) {
  const label = ann.viewportWidth <= 480 ? 'Mobile' : 'Tablet'
  lines.push(`**Viewport:** ${ann.viewportWidth}px (${label})`)
}
```

with:

```ts
// Viewport — omit for Full mode (null/undefined), include for all presets
if (ann.viewportWidth != null) {
  const label = ann.viewportWidth <= 480 ? 'Mobile' : ann.viewportWidth <= 768 ? 'Tablet' : 'Desktop'
  lines.push(`**Viewport:** ${ann.viewportWidth}px (${label})`)
}
```

**Step 4: Update the existing "omits viewport for desktop >= 1024" test**

The test at line 68-71 expects desktop widths to be omitted. This is now wrong — 1024 should show `(Desktop)`. Change:

```ts
it('omits viewport for desktop widths >= 1024', () => {
  const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 1440 })])
  expect(md).not.toContain('**Viewport:**')
})
```

to:

```ts
it('includes viewport for desktop widths >= 1024', () => {
  const md = buildExportMarkdown([makeAnnotation({ viewportWidth: 1440 })])
  expect(md).toContain('**Viewport:** 1440px (Desktop)')
})
```

**Step 5: Run tests to verify all pass**

Run: `pnpm test -- src/client/utils/__tests__/export.test.ts`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/client/utils/export.ts src/client/utils/__tests__/export.test.ts
git commit -m "feat: include viewport label for all preset widths in export"
```

---

### Task 6: Add conflict awareness notes to export

**Files:**
- Modify: `src/client/utils/export.ts:33-37` (after viewport line)
- Modify: `src/client/utils/__tests__/export.test.ts`

**Step 1: Write failing tests for conflict notes**

In `src/client/utils/__tests__/export.test.ts`, add:

```ts
it('adds conflict note when viewport pin targets same element as full-mode pin', () => {
  const annotations = [
    makeAnnotation({ id: 'a', number: 1, viewportWidth: null, element: { selector: 'nav.sidebar', xpath: '/html/body/nav', tag: 'nav', textContent: '', boundingBox: { x: 0, y: 0, width: 200, height: 40 } }, comment: 'Add more padding' }),
    makeAnnotation({ id: 'b', number: 2, viewportWidth: 375, element: { selector: 'nav.sidebar', xpath: '/html/body/nav', tag: 'nav', textContent: '', boundingBox: { x: 0, y: 0, width: 200, height: 40 } }, comment: 'Collapse to hamburger' }),
  ]
  const md = buildExportMarkdown(annotations)
  expect(md).toContain('**Note:** See also annotation #1 (general) for this element')
})

it('no conflict note when viewport pin has no matching full-mode pin', () => {
  const annotations = [
    makeAnnotation({ id: 'a', number: 1, viewportWidth: 375, comment: 'Mobile fix' }),
    makeAnnotation({ id: 'b', number: 2, viewportWidth: 768, element: { selector: 'div.other', xpath: '/html/body/div', tag: 'div', textContent: '', boundingBox: { x: 0, y: 0, width: 200, height: 40 } }, comment: 'Tablet fix' }),
  ]
  const md = buildExportMarkdown(annotations)
  expect(md).not.toContain('**Note:**')
})

it('no conflict note on full-mode pins themselves', () => {
  const annotations = [
    makeAnnotation({ id: 'a', number: 1, viewportWidth: null, comment: 'General fix' }),
    makeAnnotation({ id: 'b', number: 2, viewportWidth: 375, element: { selector: 'nav.sidebar', xpath: '/html/body/nav', tag: 'nav', textContent: '', boundingBox: { x: 0, y: 0, width: 200, height: 40 } }, comment: 'Mobile fix' }),
  ]
  const md = buildExportMarkdown(annotations)
  // The full-mode pin (#1) should NOT get a "See also" note pointing to itself or to viewport pins
  const lines = md.split('\n')
  const ann1Section = md.slice(md.indexOf('Annotation 1'), md.indexOf('Annotation 2'))
  expect(ann1Section).not.toContain('**Note:**')
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/client/utils/__tests__/export.test.ts`
Expected: The conflict note tests fail — no `**Note:**` is output.

**Step 3: Implement conflict awareness**

In `src/client/utils/export.ts`, after the viewport line (the `if (ann.viewportWidth != null)` block), add:

```ts
// Conflict awareness: link viewport pins to full-mode pins on same element
if (ann.viewportWidth != null) {
  const fullModePins = sorted.filter(
    (other) => other.id !== ann.id && other.viewportWidth == null && other.element.selector === ann.element.selector
  )
  for (const fp of fullModePins) {
    lines.push(`**Note:** See also annotation #${fp.number} (general) for this element`)
  }
}
```

**Step 4: Run tests to verify all pass**

Run: `pnpm test -- src/client/utils/__tests__/export.test.ts`
Expected: All tests PASS.

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (existing + new).

**Step 6: Commit**

```bash
git add src/client/utils/export.ts src/client/utils/__tests__/export.test.ts
git commit -m "feat: add conflict awareness notes linking viewport and full-mode pins"
```

---

### Task 7: Final build + full test run

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

**Step 2: Build**

Run: `pnpm build`
Expected: Clean build, no errors.

**Step 3: Manual smoke test (optional)**

Run: `cd demo && pnpm dev`

Verify:
1. Open the app at localhost:5173
2. Activate annotator, switch to 375px viewport
3. Create an annotation — confirm pin appears
4. Switch to 768px viewport — confirm the 375px pin is hidden, Full pins still show
5. Switch to Full — confirm all pins show
6. Hover a pin — confirm tooltip shows `[375px]` or `[Full]` tag
7. Copy annotations — confirm viewport labels and conflict notes in output

**Step 4: Commit any remaining changes and verify clean state**

```bash
git status
# Should be clean — all changes committed in prior tasks
```
