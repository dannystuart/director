# Interactive Features — Design

> Brainstormed 2026-03-03. Builds on the interactive features spec (`docs/INTERACTIVE_FEATURES_SPEC.md`) with scoping decisions, UX refinements, and implementation details.

## Features In Scope

| # | Feature | Complexity | Depends On |
|---|---------|-----------|------------|
| 1 | DOM State Manager | Low | — |
| 2 | Live Text Editing | Low | DOM State Manager |
| 3 | Color Picker (tokens + page colors) | Low–Medium | DOM State Manager |
| 4 | Element Insertion (Level 1) | Medium | — |
| 5 | Responsive Viewport | Medium | — |
| 6 | Style Sliders | Medium | DOM State Manager |

## Features Cut

| Feature | Reason |
|---------|--------|
| Drag to Reorder | "Move X above Y" in a comment is clear enough for an AI. Low frequency use case. |
| Spacing Drag Handles | Sliders give 80% of the value. Spec itself says build sliders first. |
| Responsive Viewport (CSS transform option) | iframe approach is more accurate for media queries. |
| Element Insertion Level 2 | Full insertion-point UX is high complexity. Level 1 captures the same intent. |
| Freeform color wheel | Nudge users toward existing tokens. Manual hex input is the escape hatch. |

---

## 1. DOM State Manager

Shared abstraction for snapshot → preview → revert/commit lifecycle. Required by features that live-preview changes in the DOM.

### Interface

```typescript
type ChangeType = 'css' | 'text' | 'reorder' | 'dom'

interface DOMChange {
  type: ChangeType
  css?: Record<string, string>       // property → value
  text?: string                       // new textContent
  reorder?: { newIndex: number }      // future
  dom?: { html: string }              // future
}

interface StateSnapshot {
  element: HTMLElement
  inlineStyles: string               // element.style.cssText
  textContent: string
  innerHTML: string
  siblingIndex: number
  parentSelector: string
}

interface DOMStateManager {
  snapshot(element: HTMLElement): StateSnapshot
  preview(element: HTMLElement, change: DOMChange): void
  revert(element: HTMLElement): void
  commit(element: HTMLElement): { before: StateSnapshot, after: DOMChange }
  revertAll(): void
  hasPreview(element: HTMLElement): boolean
}
```

### Implementation

- Single class with `Map<HTMLElement, StateSnapshot>` tracking active previews.
- `preview()` auto-snapshots if not already tracked.
- `revert()` restores `style.cssText` and `textContent` from the snapshot.
- `commit()` returns the diff and clears the snapshot.
- `revertAll()` called when leaving annotation mode.
- Future types (`reorder`, `dom`) defined in the interface but throw "not implemented" until built.
- Location: `src/client/utils/domState.ts` (pure utility, no Preact dependency).
- Hook wrapper: `src/client/hooks/useDOMState.ts`.
- ~80 lines.

---

## 2. Live Text Editing

Click an element → `EDIT TEXT` quick action → element becomes editable → type new text → annotation captures before/after diff.

### Activation

- `EDIT TEXT` button only appears if element has text content.
- Clicking it calls `domState.snapshot(element)`, sets `element.contentEditable = "plaintext-only"`.
- Element gets a green dashed border to indicate edit mode.
- Element is focused, text selected.

### Nested Elements Rule

- Leaf text node (no child elements): use inline `contentEditable`.
- Element with children: use a floating `<textarea>` overlay positioned on top of the element. Avoids destroying nested HTML structure.

### Save / Cancel

- Save: capture `element.textContent`, call `domState.commit()`, store diff on annotation.
- Cancel: call `domState.revert()`, remove `contentEditable`.

### Annotation Data

```typescript
textChange?: {
  original: string
  updated: string
}
```

### Export

```markdown
**Change type:** Text update
**Original text:** "Dashboard Overview"
**New text:** "My Dashboard"
```

~120 lines.

---

## 3. Design-System-Aware Color Picker

Click element → `COLOR` quick action → sub-options for quick flagging (existing behavior) plus `[Pick color...]` to open the color picker in a side panel.

### Color Extraction (cached per session)

Runs once when annotation mode activates.

**Layer 1 — CSS custom properties:** Scan accessible stylesheets for `--*` properties that resolve to colors. Display with variable name.

**Layer 2 — Used colors on page:** Sample first 200 elements, collect `color`, `backgroundColor`, `borderColor`. Deduplicate, sort by frequency.

No freeform color wheel. Manual hex text input as fallback.

### Which Property

Default logic:
- Element has visible background (not transparent) → default to `backgroundColor`
- Otherwise → default to `color`
- User toggles between `color`, `backgroundColor`, `borderColor` via tabs.

### Side Panel UI

```
┌──────────────────────┐
│ COLOR                │
│                      │
│ DESIGN TOKENS        │
│ --primary   ■ #2563eb│
│ --accent    ■ #f59e0b│
│ --neutral   ■ #6b7280│
│                      │
│ PAGE COLORS          │
│ ■ ■ ■ ■ ■ ■ ■ ■    │
│                      │
│ [____#______]        │
│                      │
│ Applying to:         │
│ [color] [bg] [border]│
│                      │
│ [APPLY]              │
└──────────────────────┘
```

Every swatch click calls `domState.preview()` for instant visual feedback.

### Annotation Data

```typescript
colorChange?: {
  property: string            // 'color' | 'backgroundColor' | 'borderColor'
  from: string                // resolved rgb value
  to: string                  // hex or rgb
  tokenName: string | null    // '--color-primary' if from tokens
}
```

### Export

```markdown
- background-color: rgb(0, 0, 0) → var(--color-primary) (#2563eb)
```

Token name is the key value-add — AI writes `var(--color-primary)` in code.

~200 lines.

---

## 4. Element Insertion (Level 1)

Click existing element → `INSERT` quick action → `[Before] [After] [Inside]` → element type menu in side panel → save.

No live DOM preview. Captures intent and position only.

### Side Panel UI

```
┌──────────────────────┐
│ INSERT AFTER ‹h1›    │
│                      │
│ [Aa] Heading         │
│ [¶]  Paragraph       │
│ [□]  Button          │
│ [—]  Divider         │
│ [▣]  Container       │
│ [?]  Custom          │
│                      │
│ Text: [____________] │
│ Notes: [___________] │
│                      │
│ [APPLY]              │
└──────────────────────┘
```

"Custom" opens a free-text field to describe what the user wants.

Reference image from the annotation card still applies.

### Annotation Data

```typescript
insertion?: {
  position: 'before' | 'after' | 'inside'
  elementType: 'heading' | 'paragraph' | 'button'
    | 'divider' | 'container' | 'custom'
  textContent: string
  description: string
}
```

### Export

```markdown
**Change type:** Insert new element
**Position:** After `main > .hero > h1`
**Element to insert:** Button
**Text content:** "Get Started Free"
```

~100 lines.

---

## 5. Responsive Viewport

Viewport switcher in control panel. Clicking a preset opens the page in a constrained iframe. Every annotation gets `viewportWidth` stamped automatically.

### Control Panel

```
[375] [768] [1024] [Full]  VISION  COPY(3)  CLEAR ALL
```

Active preset gets green highlight. `Full` returns to normal mode.

### iframe Behavior

1. User clicks a preset (e.g. `375`).
2. Full-screen overlay with centered iframe, width constrained to preset value.
3. `iframe.src` = current page URL (same dev server).
4. Annotator UI (floating icon, control panel, pins, cards) stays in the parent frame.
5. `ElementSelector` attaches listeners to `iframe.contentDocument`.
6. Screenshots use html2canvas on the iframe body.

### Cross-Frame Annotation

- `ElementSelector` needs to know which document to attach listeners to (parent or iframe).
- `generateSelector()` and `captureComputedStyles()` work unchanged — they take an element.
- `PinMarker` positioning offsets for the iframe's position in the parent.
- `useScreenshot` targets `iframe.contentDocument.body` when in viewport mode.

### Per-Annotation Viewport Stamping

Every annotation gets `viewportWidth` automatically:
- Normal mode: `window.innerWidth`
- iframe mode: the preset value (375, 768, etc.)
- User manually resizes browser: still captured via `window.innerWidth`

```typescript
viewportWidth?: number
```

### Export

When `viewportWidth < 1024`:

```markdown
**Viewport:** 375px (Mobile)
```

### Teardown

Clicking `Full` or deactivating annotator removes iframe and overlay. `domState.revertAll()` called since previewed changes were in the iframe's DOM.

~250 lines.

---

## 6. Style Sliders

Sliders live in the side panel, opened via "Adjust..." from FONT or SPACING quick actions. Each numeric CSS property gets a slider + text input.

### Slider Component

```typescript
interface StyleSliderProps {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}
```

Renders as: `font-size  16px [====●=========]`

Interactions:
- Drag handle for continuous adjustment.
- Click track to jump.
- Click value text to switch to text input for precise entry.
- Arrow keys: up/down by step, shift+up/down by 10x step.

### Properties Per Panel

**FONT Adjust:**

| Property | Range | Step | Unit |
|---|---|---|---|
| fontSize | 0–120 | 1 | px |
| fontWeight | 100–900 | 100 | (none) |
| lineHeight | 0–4 | 0.1 | (none) |
| letterSpacing | -5–20 | 0.5 | px |
| fontFamily | — | — | text input only |

**SPACING Adjust:**

| Property | Range | Step | Unit |
|---|---|---|---|
| padding (each side) | 0–200 | 1 | px |
| margin (each side) | -100–200 | 1 | px |
| gap | 0–100 | 1 | px |

### Live Preview

Every `onChange` calls `domState.preview(element, { type: 'css', css: { [property]: value + unit } })`.

### No Data Model Change

Sliders produce `targetStyles` entries identical to text input. Pure UX improvement.

~150 lines.

---

## UX: Annotation Card Redesign

### Quick Actions as Mode Selectors

Quick actions keep their current quick-flag behavior (tap COLOR → "too dark" → done). Each also gets an "Adjust..." or "Pick..." drill-down that opens a side panel.

```
┌──────────────────────────────┐
│ #3 h1.hero-title          ✕  │  ← header (always)
├──────────────────────────────┤
│ [describe what should change]│  ← comment (always)
├──────────────────────────────┤
│ COLOR  FONT  SPACING  ALIGN  │  ← quick actions (always)
│        [Too small]           │  ← sub-options (existing)
│        [Too large]           │
│        [Wrong weight]        │
│        [Adjust...]───────────┼──► opens side panel
├──────────────────────────────┤
│ EDIT TEXT   INSERT            │  ← new quick actions
├──────────────────────────────┤
│ Priority: [H] [M] [L]       │  ← priority (always)
├──────────────────────────────┤
│ [DELETE]    [CANCEL] [SAVE]  │  ← actions (always)
└──────────────────────────────┘
```

### Side Panel

Opens next to the annotation card. Contains the tool-specific UI (color picker, sliders, insertion menu). Positioned using the same card-positioning logic, one step further from the element.

Closes on: clicking away, clicking APPLY, or selecting a different quick action.

### Container / Child Selection

No special handling. The tool always shows the selected element's own computed styles. If you select a container, you see the container's styles. If you want to change a child's font, click the child. The user learns the mental model naturally.

---

## Updated Annotation Type

All new fields are optional for backwards compatibility. No `type` discriminator — export logic checks which fields are present. An annotation can have multiple change types (e.g. color change + text change on the same element).

```typescript
interface Annotation {
  // Existing fields (unchanged)
  id: string
  number: number
  timestamp: string
  priority: Priority
  element: ElementData
  computedStyles: ComputedStyles
  targetStyles: Partial<ComputedStyles>
  comment: string
  quickActions: QuickActionEntry[]
  screenshot: string | null
  referenceImage: string | null
  processed?: boolean

  // New fields
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
    position: 'before' | 'after' | 'inside'
    elementType: 'heading' | 'paragraph' | 'button'
      | 'divider' | 'container' | 'custom'
    textContent: string
    description: string
  }
}
```

## Export Updates

`buildExportMarkdown()` checks each optional field and appends relevant sections:

**Standard annotation with new fields:**
```markdown
## Annotation 3 (HIGH) — h1.hero-title

**Viewport:** 375px (Mobile)
**Element:** `h1`
**Selector:** `main > .hero > h1`

**Text change:** "Dashboard Overview" → "My Dashboard"
**Style changes:**
- font-size: 48px → 36px
- color: rgb(0,0,0) → var(--color-primary) (#2563eb)

**Intent:** User flagged font is too large
**Comment:** "Needs to be smaller on mobile and use brand color"

**Screenshot:** .ui-annotations/screenshot_003.png
```

**Insertion annotation:**
```markdown
## Annotation 5 (HIGH) — Insert Element

**Position:** After `main > .hero > h1`
**Insert:** Button — "Get Started Free"
**Notes:** "Primary CTA, match existing button styles"
**Reference image:** .ui-annotations/reference_005.png
```

Existing annotations without new fields export exactly as today. No migration needed.
