# Interactive Features Spec — Visual Direction Capabilities

> **Purpose:** This document specifies interactive features that extend the annotation tool from "describe what's wrong" to "show what you want." Each feature is a self-contained module. Build any combination — they are independent unless noted.
>
> **Relationship to main spec:** These features build on top of the core annotation tool (element selection, annotation cards, pins, export, Vite plugin). The main spec covers the base system. This document covers the interactive editing layer.
>
> **How to use this file:** Each feature section is flagged with a priority tag. All are optional. If building everything at once, start with the DOM State Manager (required foundation for all live-preview features), then build features in any order.

---

## Required Foundation: DOM State Manager

**Build this first if implementing ANY live-preview feature below.**

All interactive features follow the same lifecycle: capture original state → preview changes in the live DOM → save the diff or revert. The DOM State Manager is the shared abstraction that handles this.

### Interface

```typescript
interface DOMStateManager {
  // Snapshot the current state of an element before making changes
  snapshot(element: HTMLElement, properties?: string[]): StateSnapshot;

  // Apply a temporary change to the live DOM (for preview)
  preview(element: HTMLElement, changes: CSSChanges | TextChange | DOMChange): void;

  // Revert all temporary changes on an element (cancel)
  revert(element: HTMLElement): void;

  // Commit the change — returns the before/after diff for the annotation
  commit(element: HTMLElement): AnnotationDiff;

  // Revert ALL temporary changes across all elements (e.g. when closing annotation mode)
  revertAll(): void;
}

interface StateSnapshot {
  element: HTMLElement;
  computedStyles: Record<string, string>;   // captured via getComputedStyle
  textContent: string;
  innerHTML: string;
  siblingIndex: number;                     // position among siblings
  parentSelector: string;
  inlineStylesBefore: string;               // element.style.cssText before changes
}

interface CSSChanges {
  type: 'css';
  properties: Record<string, string>;       // e.g. { fontSize: '24px', padding: '16px' }
}

interface TextChange {
  type: 'text';
  newText: string;
}

interface DOMChange {
  type: 'reorder';
  newIndex: number;                         // new position among siblings
}
```

### Implementation Notes

- **Preview via inline styles:** Use `element.style[prop] = value` for CSS previews. This overrides computed styles without modifying stylesheets.
- **Revert via style removal:** On cancel, set `element.style.cssText = snapshot.inlineStylesBefore` to restore exactly what was there before (including any pre-existing inline styles).
- **Text revert:** On cancel, restore `element.textContent = snapshot.textContent`.
- **Reorder revert:** On cancel, re-insert element at its original `siblingIndex` in its parent.
- **Track all active previews:** Maintain a `Map<HTMLElement, StateSnapshot>` of all elements currently being previewed. `revertAll()` iterates this map.
- **Prevent stacking:** If a preview is already active on an element, revert it before applying a new one.

### Why This Matters

Without this, each feature independently manages DOM mutations and cleanup, leading to bugs where reverting one feature's changes breaks another's. With this, the lifecycle is centralised and every feature just calls `preview()` / `commit()` / `revert()`.

---

## Feature: Live Text Editing

**Complexity:** Low
**Value:** High
**Dependencies:** DOM State Manager
**Quick action label:** `EDIT TEXT`

### What It Does

Click any text element → it becomes editable inline → type new text → the annotation captures original and updated text as a clean diff.

### Implementation

**Activation:** Add an `EDIT TEXT` quick action button to the annotation card. When clicked:

1. Call `stateManager.snapshot(element)` to capture current text
2. Set `element.contentEditable = "plaintext-only"`
3. Focus the element and select all text
4. Add a visible border/highlight to indicate edit mode
5. Listen for `blur` or a save action

**On save:**
1. Capture `element.textContent` as the new value
2. Call `stateManager.commit(element)` — returns `{ original: "...", updated: "..." }`
3. Remove `contentEditable` attribute
4. Store the text diff in the annotation data

**On cancel:**
1. Call `stateManager.revert(element)` — restores original textContent
2. Remove `contentEditable` attribute

### Edge Cases

- **Nested elements:** If the clicked element contains child elements (`<span>`, `<strong>`, etc.), set `contentEditable` on the deepest text-containing node, not the parent. Alternatively, use a floating `<textarea>` overlay positioned over the element — this avoids DOM structure issues entirely.
- **Dynamic/framework-rendered text:** Editing the DOM directly doesn't change React/Vue/Svelte state. The annotation captures *intent* ("change this text to X"), which the AI implements in source code. Add a note in the export: `Note: text was edited visually as a preview — implement this change in source code.`
- **Multi-line text:** For elements with substantial text (paragraphs), prefer a floating textarea overlay rather than inline contentEditable to avoid layout reflow during editing.
- **Empty elements:** If the element has no text content, skip text editing and suggest using the Element Insertion feature instead.

### Annotation Data

```json
{
  "type": "text-edit",
  "element": { "selector": "...", "tag": "h1" },
  "textChange": {
    "original": "Dashboard Overview",
    "updated": "My Dashboard"
  },
  "comment": "optional additional context"
}
```

### Export Format

```markdown
## Annotation 3 (MEDIUM) — h1.page-title

**Element:** `h1.page-title`
**Selector:** `main > .hero > h1`
**Change type:** Text update
**Original text:** "Dashboard Overview"
**New text:** "My Dashboard"
**Comment:** "Match the copy in the Figma file"
```

---

## Feature: Design-System-Aware Color Picker

**Complexity:** Low–Medium
**Value:** High
**Dependencies:** DOM State Manager
**Quick action label:** `COLOR` (replaces the basic "wrong color" template from the main spec)

### What It Does

Click an element → open color picker → see the project's actual design palette (auto-extracted from the page) → pick a color → see it applied live → save as annotation with token name if available.

### Why Not a Generic Color Wheel

A freeform color wheel introduces colors that may not belong in the project's design system. The correct color almost always already exists somewhere in the palette — it's just applied to the wrong element. The picker should present existing project colors first, with a freeform fallback.

### Implementation: Color Extraction

Run these extractions once when annotation mode is activated. Cache the results for the session.

**Layer 1 — CSS Custom Properties (highest confidence)**

```javascript
function extractDesignTokenColors() {
  const tokens = [];
  for (const sheet of document.styleSheets) {
    try {
      // Skip cross-origin sheets
      if (sheet.href && !sheet.href.startsWith(location.origin)) continue;
      for (const rule of sheet.cssRules) {
        if (!rule.style) continue;
        for (const prop of rule.style) {
          if (!prop.startsWith('--')) continue;
          const value = rule.style.getPropertyValue(prop).trim();
          if (isColorValue(value)) {
            tokens.push({ name: prop, value, resolved: resolveColor(value) });
          }
        }
      }
    } catch (e) {
      // CORS restriction on stylesheet — skip
    }
  }
  return deduplicateByValue(tokens);
}

function isColorValue(value) {
  // Match hex, rgb(), rgba(), hsl(), hsla(), named colors
  return /^(#|rgb|rgba|hsl|hsla)/.test(value) ||
         CSS.supports('color', value);
}

function resolveColor(value) {
  // Use a temporary element to resolve any color value to rgb()
  const el = document.createElement('div');
  el.style.color = value;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  el.remove();
  return resolved;
}
```

**Layer 2 — Used Colors on the Page (medium confidence)**

```javascript
function extractUsedColors(sampleSize = 200) {
  const colorMap = new Map(); // rgb string → { count, properties }
  const elements = document.querySelectorAll('body *');
  const sample = Array.from(elements).slice(0, sampleSize);

  for (const el of sample) {
    const style = getComputedStyle(el);
    for (const prop of ['color', 'backgroundColor', 'borderColor']) {
      const val = style[prop];
      if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
        const existing = colorMap.get(val) || { count: 0, properties: new Set() };
        existing.count++;
        existing.properties.add(prop);
        colorMap.set(val, existing);
      }
    }
  }

  return Array.from(colorMap.entries())
    .map(([color, data]) => ({ color, count: data.count, properties: [...data.properties] }))
    .sort((a, b) => b.count - a.count);
}
```

**Layer 3 — Freeform Fallback**

A native `<input type="color">` or minimal custom picker for genuinely new colors. De-emphasised in the UI — available but not the default.

### Implementation: Picker UI

```
┌─────────────────────────────────────┐
│ COLOR                         _ □ X │
├─────────────────────────────────────┤
│                                     │
│ DESIGN TOKENS                       │
│ --color-primary    ■ #2563eb        │
│ --color-secondary  ■ #9333ea        │
│ --color-accent     ■ #f59e0b        │
│ --color-neutral-50 ■ #f9fafb        │
│ --color-neutral-900■ #111827        │
│                                     │
│ USED ON PAGE                        │
│ ■ ■ ■ ■ ■ ■ ■ ■  (swatch grid)    │
│                                     │
│ [CUSTOM...]  current: ■ #000000     │
│                                     │
│ Applying to: color | backgroundColor│
│                                     │
│ [APPLY]  [CANCEL]                   │
└─────────────────────────────────────┘
```

**Behaviour:**
- Picker opens when user clicks `COLOR` quick action or clicks a color value in the styles diff panel
- Show which CSS property is being changed (color, backgroundColor, borderColor)
- Clicking any swatch immediately live-previews via `stateManager.preview(element, { type: 'css', properties: { [targetProp]: value } })`
- Design token swatches show the variable name — if selected, the export uses `var(--token-name)` not the raw hex
- "USED ON PAGE" swatches show frequency (larger = more common)

### What It Means for Design Token Awareness

This feature builds the extraction layer that the main spec lists as a V2 feature ("Design Token Awareness"). By shipping color extraction in V1, the full V2 feature (flagging mismatches across all properties, suggesting nearest tokens) becomes an extension of existing code rather than a new system.

### Annotation Data

```json
{
  "type": "color-change",
  "element": { "selector": "...", "tag": "button" },
  "colorChange": {
    "property": "backgroundColor",
    "from": "rgb(0, 0, 0)",
    "to": "#2563eb",
    "tokenName": "--color-primary"
  }
}
```

### Export Format

```markdown
## Annotation 2 (HIGH) — button.primary-cta

**Element:** `button.primary-cta`
**Selector:** `main > .hero > button.primary-cta`
**Change type:** Color
**Style changes:**
- background-color: rgb(0, 0, 0) → var(--color-primary) (#2563eb)

**Comment:** "Should use the primary brand color, not black"
```

The token name in the export is important — the AI can use `var(--color-primary)` directly in code, which is more maintainable than hard-coding `#2563eb`.

---

## Feature: Dynamic Style Adjustment (Sliders)

**Complexity:** Medium
**Value:** High
**Dependencies:** DOM State Manager
**Integrates with:** The styles diff panel in the annotation card (from the main spec)

### What It Does

Select an element → numeric CSS properties show interactive sliders alongside the text inputs → drag to adjust values visually in real-time → the annotation captures before/after diffs.

### Relationship to Main Spec

The main spec already defines a styles diff panel: an expandable section in the annotation card showing computed CSS properties with editable "target" text fields. This feature **enhances** that panel — it does not replace it. Numeric properties gain a slider alongside the text input. Non-numeric properties (fontFamily, display, textAlign, etc.) keep text-only input.

### Which Properties Get Sliders

| Property | Range | Step | Unit |
|---|---|---|---|
| fontSize | 0–120 | 1 | px |
| fontWeight | 100–900 | 100 | (unitless) |
| lineHeight | 0–4 | 0.1 | (unitless or px) |
| letterSpacing | -5–20 | 0.5 | px |
| padding (each side) | 0–200 | 1 | px |
| margin (each side) | -100–200 | 1 | px |
| gap | 0–100 | 1 | px |
| borderRadius | 0–100 | 1 | px |
| borderWidth | 0–20 | 1 | px |
| opacity | 0–1 | 0.05 | (unitless) |
| width | 0–2000 | 1 | px |
| height | 0–2000 | 1 | px |

Ranges are sensible defaults. The text input allows values outside the slider range for edge cases.

### Control UI Design

Build custom controls — do not use Leva or Tweakpane. Rationale:

- **Leva** is React-only (peer dependency). Ruled out — violates framework-agnostic constraint.
- **Tweakpane** is vanilla JS and dependency-free, but adds ~35 kB gzipped for 12+ input types we don't need. Its visual style also conflicts with the retro-terminal aesthetic.
- **Custom controls** are ~3–5 kB total, match the brand, and only include what we need.

**The slider control pattern** (inspired by Tweakpane/Leva UX):

```
  fontSize: 16px  [====●===========] 24px
                   ↑ drag handle      ↑ text input (click to type)
```

- **Track + handle:** horizontal bar, handle shows current value position
- **Click track:** clicking anywhere on the track jumps to that value
- **Drag handle:** smooth dragging updates value and live-previews
- **Text input:** clicking the numeric value switches to a text input for precise entry
- **Arrow keys:** when text input is focused, ↑/↓ increments by step, Shift+↑/↓ by 10× step
- **Live preview:** every value change calls `stateManager.preview(element, { type: 'css', properties: { [prop]: newValue } })`
- **Visual feedback:** the element updates in real-time as the slider moves

**Slider component interface:**

```typescript
interface SliderConfig {
  property: string;        // CSS property name
  currentValue: number;    // parsed from computed style
  unit: string;            // 'px', 'em', '', etc.
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;   // called on every drag/input change
}
```

### Integration with Styles Diff Panel

The main spec's styles diff panel currently looks like:

```
fontSize:   16px  → [________]
fontWeight: 400   → [________]
fontFamily: Arial → [________]
```

With sliders added, it becomes:

```
fontSize:   16px  → [====●=========] 24px
fontWeight: 400   → [==●===========] 400
opacity:    1     → [============●=] 1
fontFamily: Arial → [________]              (text-only, no slider)
display:    flex  → [________]              (text-only, no slider)
```

Only properties that have been *edited* are included in the exported annotation diff. Untouched properties are omitted from the export.

### Annotation Data

Same structure as the main spec's `targetStyles`, no change needed:

```json
{
  "computedStyles": {
    "fontSize": "16px",
    "padding": "12px 16px"
  },
  "targetStyles": {
    "fontSize": "24px",
    "padding": "24px 24px"
  }
}
```

### Export Format

Identical to the main spec's style diff export:

```markdown
**Style changes:**
- font-size: 16px → 24px
- padding: 12px 16px → 24px 24px
```

No changes to export format needed — the slider is a UI enhancement, not a data model change.

---

## Feature: Element Insertion

**Complexity:** Medium (simplified) / High (full)
**Value:** High
**Dependencies:** DOM State Manager (for preview rendering)

### What It Does

Indicate where in the page a new element should be added, what type of element, and optionally what it should contain. The AI receives exact DOM positioning.

### Two Implementation Levels

**Level 1 — Simplified (lower complexity)**

Works within the existing annotation card flow:

1. User selects an existing element (normal flow)
2. In the annotation card, an `INSERT` quick action is available
3. Clicking it shows: "Insert Before" / "Insert After" / "Insert Inside (as child)"
4. User selects element type from a menu: Heading, Paragraph, Button, Divider, Image, Container, Custom
5. If the type has text content (heading, paragraph, button), a text input appears
6. Optionally attach a reference image
7. Save creates an insertion annotation

**Level 2 — Full insertion-point UX (higher complexity)**

A separate "Insert Mode" toggle in the control panel:

1. Hovering over the page shows insertion point indicators — blue horizontal lines between sibling elements
2. Clicking a line opens the element type menu at that position
3. After selecting a type, a placeholder element is temporarily inserted into the DOM as a preview
4. The placeholder is styled distinctly (dashed border, "New [type]" label)
5. User can type content directly into the placeholder
6. Save captures the insertion point and content; revert removes the placeholder

**Insertion point detection (for Level 2):**

```javascript
function findInsertionPoints(container) {
  const points = [];
  const children = Array.from(container.children)
    .filter(el => !el.dataset.annotationTool); // exclude our own UI

  // Before first child
  if (children.length > 0) {
    points.push({
      type: 'before',
      referenceElement: children[0],
      parent: container,
      y: children[0].getBoundingClientRect().top
    });
  }

  // After each child
  children.forEach((child, i) => {
    const rect = child.getBoundingClientRect();
    points.push({
      type: 'after',
      referenceElement: child,
      parent: container,
      y: rect.bottom
    });
  });

  return points;
}
```

### Element Type Menu

```
┌────────────────────────────────┐
│ + INSERT                       │
├────────────────────────────────┤
│ [Aa] Heading     [¶] Paragraph │
│ [□]  Button      [—] Divider   │
│ [🖼] Image       [▣] Container │
│ [📝] Custom (describe it)      │
└────────────────────────────────┘
```

For "Custom," the user gets a free-text field to describe what they want. The AI receives the description plus the exact position.

### Annotation Data

```json
{
  "type": "element-insertion",
  "position": {
    "action": "after",
    "referenceSelector": "main > .hero > h1",
    "parentSelector": "main > .hero"
  },
  "insertElement": {
    "type": "button",
    "textContent": "Get Started Free",
    "description": "Primary CTA, match the filled variant of existing buttons"
  },
  "referenceImage": "reference_005.png"
}
```

### Export Format

```markdown
## Annotation 5 (HIGH) — Insert Element

**Change type:** Insert new element
**Position:** After `main > .hero > h1`, inside `main > .hero`
**Element to insert:** Button
**Text content:** "Get Started Free"
**Notes:** "Primary CTA, match the filled variant of existing buttons"
**Reference image:** .ui-annotations/reference_005.png
```

---

## Feature: Drag to Reorder

**Complexity:** Medium
**Value:** Medium
**Dependencies:** DOM State Manager

### What It Does

Drag an element to a new position among its siblings. The DOM reorders visually as a live preview. The annotation captures the move instruction.

### Implementation

**Activation:** A `REORDER` quick action or a drag handle that appears when hovering elements in annotation mode.

**Drag interaction:**

1. User initiates drag on an element (via drag handle or modifier key + drag)
2. Call `stateManager.snapshot(element)` to capture original position
3. Create a ghost/clone of the element that follows the cursor
4. As the ghost moves over siblings, show insertion indicators between them
5. On drop, call `stateManager.preview(element, { type: 'reorder', newIndex: N })` — this physically moves the element in the DOM
6. The reorder is visible but temporary until saved

**DOM reorder preview:**

```javascript
function previewReorder(element, newIndex) {
  const parent = element.parentElement;
  const siblings = Array.from(parent.children)
    .filter(el => !el.dataset.annotationTool);
  parent.removeChild(element);
  if (newIndex >= siblings.length) {
    parent.appendChild(element);
  } else {
    parent.insertBefore(element, siblings[newIndex]);
  }
}
```

**On cancel:** `stateManager.revert(element)` restores original position.

### Annotation Data

```json
{
  "type": "reorder",
  "element": {
    "selector": "main > section.testimonials",
    "tag": "section"
  },
  "reorder": {
    "parentSelector": "main",
    "fromIndex": 3,
    "toIndex": 1,
    "nowBefore": "main > section.features"
  }
}
```

### Export Format

```markdown
## Annotation 6 (MEDIUM) — section.testimonials

**Element:** `section.testimonials`
**Selector:** `main > section.testimonials`
**Change type:** Reorder
**Action:** Move from position 3 to position 1 inside `main`
**Now appears before:** `section.features`
**Comment:** "Social proof should come before the features list"
```

---

## Feature: Responsive Viewport Annotations

**Complexity:** Medium
**Value:** Medium
**Dependencies:** None beyond core annotation system

### What It Does

Switch the viewport to specific breakpoints and annotate at that size. Annotations include viewport width so the AI wraps changes in the correct media query.

### Implementation

**Viewport switcher** in the control panel toolbar:

```
[📱 375] [📱 768] [💻 1024] [🖥 1440] [↔ Custom]
```

**Two approaches for viewport simulation:**

**Option A — iframe resize:** Render the page inside an iframe that can be resized. Most accurate but requires the Vite plugin to serve the page in an iframe wrapper when annotation mode is active.

**Option B — CSS transform scaling:** Apply `transform: scale()` and `width` overrides to the document body to simulate a narrower viewport. Less accurate (media queries may not trigger) but simpler.

**Recommendation:** Option A is more reliable. The iframe approach ensures media queries fire correctly and the annotation captures a true representation of the responsive layout.

**Annotation data addition:**

All annotations made while a viewport preset is active include:

```json
{
  "viewport": {
    "width": 375,
    "label": "Mobile"
  }
}
```

### Export Format Addition

```markdown
## Annotation 7 (HIGH) — nav.sidebar

**Viewport:** 375px (Mobile)
**Element:** `nav.sidebar`
**Selector:** `body > nav.sidebar`
**Comment:** "Sidebar should collapse to a hamburger menu on mobile"
```

The AI sees the viewport context and knows to implement this inside a media query or responsive breakpoint.

---

## Feature: Spacing Drag Handles

**Complexity:** High
**Value:** High
**Dependencies:** DOM State Manager, Dynamic Style Adjustment (sliders)

### What It Does

When an element is selected, coloured overlays appear showing its padding (inner) and margin (outer). Drag the edges of these overlays to resize spacing visually, Figma auto-layout style.

### Implementation

**Visual overlays:**

```
        ┌── margin-top (orange) ──┐
        │    ┌── padding-top ──┐  │
        │    │                 │  │
  m-l   │ p-l│   [ELEMENT]    │p-r│  m-r
        │    │                 │  │
        │    └── padding-btm ──┘  │
        └── margin-bottom ────────┘
```

- Padding overlays: semi-transparent green, drawn inside the element's border box
- Margin overlays: semi-transparent orange, drawn outside the element's border box
- Each edge has an invisible drag handle (4–8px hit area)

**Drag behaviour:**
- Dragging an edge resizes that specific padding/margin direction
- Hold Shift while dragging to adjust both opposite sides symmetrically
- Value tooltip follows the cursor during drag, showing `padding-left: 16px → 24px`
- Live DOM update via `stateManager.preview()`

**Hit detection:**

```javascript
function getSpacingHandles(element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const pt = parseFloat(style.paddingTop);
  const pr = parseFloat(style.paddingRight);
  // ... etc

  return {
    paddingTop:    { x: rect.left, y: rect.top, width: rect.width, height: pt },
    paddingRight:  { x: rect.right - pr, y: rect.top, width: pr, height: rect.height },
    marginTop:     { x: rect.left, y: rect.top - parseFloat(style.marginTop), width: rect.width, height: parseFloat(style.marginTop) },
    // ... etc for all 8 edges
  };
}
```

**Interaction with sliders:** Dragging a spacing handle should also update the corresponding slider in the styles diff panel (if open), and vice versa. They're two views of the same value.

### Note

This is the most complex feature in this spec. The slider panel gives 80% of the value with 20% of the complexity. Consider building sliders first and adding drag handles as a follow-up.

---

## Data & Export Integration

### Updated annotations.json Schema

All features above use the existing `annotations.json` structure from the main spec. New annotation types extend it with a `type` field and type-specific data:

```json
{
  "annotations": [
    {
      "id": "ann_...",
      "number": 1,
      "timestamp": "...",
      "priority": "high",
      "type": "style-change",

      "element": { "selector": "...", "xpath": "...", "tag": "...", "textContent": "..." },
      "computedStyles": { },
      "targetStyles": { },
      "comment": "...",
      "quickAction": "font",
      "screenshot": "screenshot_001.png",
      "referenceImage": null
    },
    {
      "type": "text-edit",
      "textChange": { "original": "...", "updated": "..." }
    },
    {
      "type": "color-change",
      "colorChange": { "property": "backgroundColor", "from": "...", "to": "...", "tokenName": "--color-primary" }
    },
    {
      "type": "element-insertion",
      "position": { "action": "after", "referenceSelector": "...", "parentSelector": "..." },
      "insertElement": { "type": "button", "textContent": "...", "description": "..." }
    },
    {
      "type": "reorder",
      "reorder": { "parentSelector": "...", "fromIndex": 3, "toIndex": 1 }
    }
  ]
}
```

The `type` field determines how the annotation is rendered in the export. Annotations without a `type` field (or with `type: "style-change"`) use the default export format from the main spec.

### Export Ordering

The clipboard export orders annotations by:
1. Priority (high → medium → low)
2. Within same priority, by annotation number (creation order)

Each annotation's export format is determined by its `type`. The formats are defined in each feature section above. All types include the element selector, priority, and any comments — the type-specific fields vary.

---

## Quick Actions — Updated Table

This table extends the quick actions from the main spec with the new interactive features:

| Template | Label | Behaviour | Feature Required |
|---|---|---|---|
| Wrong color | `COLOR` | Opens design-system-aware color picker | Color Picker |
| Too much spacing | `SPACING` | Captures padding/margin/gap, opens slider panel | Sliders (or text-only fallback) |
| Wrong font | `FONT` | Captures font properties, opens sliders for size/weight | Sliders (or text-only fallback) |
| Fix alignment | `ALIGN` | Captures layout properties | Core spec only |
| Doesn't match design | `REFERENCE` | Prompts reference image upload | Core spec only |
| Edit text | `EDIT TEXT` | Makes element text editable inline | Live Text Editing |
| Insert element | `INSERT` | Shows insert before/after + element type picker | Element Insertion |
| Reorder | `REORDER` | Enables drag-to-reorder for the element | Drag to Reorder |
| General feedback | `COMMENT` | Free text only | Core spec only |

Quick actions that require an unbuilt feature should either be hidden or fall back gracefully (e.g. `COLOR` without the picker just captures current color values and lets the user type a target in the comment).

---

## Feature Independence Map

```
                    ┌──────────────────┐
                    │ DOM State Manager │ ← build first if doing any live preview
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐ ┌──────▼───────┐ ┌──────▼──────┐
    │ Live Text    │ │ Color Picker │ │ Style       │
    │ Editing      │ │              │ │ Sliders     │
    └──────────────┘ └──────────────┘ └──────┬──────┘
                                             │
                                      ┌──────▼──────┐
                                      │ Spacing     │ ← extends sliders
                                      │ Drag Handles│   to visual overlays
                                      └─────────────┘

    ┌──────────────┐  ┌──────────────┐
    │ Element      │  │ Drag to      │ ← each uses DOM State Manager
    │ Insertion    │  │ Reorder      │   but independent of other features
    └──────────────┘  └──────────────┘

    ┌──────────────┐
    │ Responsive   │ ← independent of all other features
    │ Viewport     │
    └──────────────┘
```

**No dependency on each other:** You can build Color Picker without Sliders, or Text Editing without Insertion, etc. The only shared dependency is the DOM State Manager for anything that live-previews.

**Graceful degradation:** If a feature isn't built, its quick action button should either be hidden or fall back to the text-only annotation flow from the main spec.
