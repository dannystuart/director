# UI Annotation Tool — Project Spec

> Click elements in your browser, describe what's wrong (or show it), and export structured feedback your AI agent can act on immediately. No more back-and-forth describing visual changes in text.
>
> Works with Claude Code, Cursor, Windsurf, and any AI tool.

---

## How It Works

1. Install: `npm install -D [package-name]` → add one line to `vite.config.js`
2. A small floating icon appears in the bottom-right corner of the dev server
3. Click to enter annotation mode → click any element to annotate it
4. For each annotation: leave a comment, use quick action templates, optionally attach a reference image, optionally edit target CSS values
5. Hit "Copy" → paste structured markdown into your AI tool
6. Screenshots and reference images save to `.ui-annotations/` in the project root so AI agents can read them directly

---

## V1 Features — Detailed

### 1. Vite Plugin & Injection

The tool is distributed as an npm dev dependency with a Vite plugin. It auto-injects a small script into the page during development only. The script is dormant until activated — zero DOM changes, zero event listeners, zero performance impact when inactive.

```js
// vite.config.js
import { annotateUI } from '[package-name]'
export default { plugins: [annotateUI()] }
```

The plugin should:
- Inject the annotation script into the HTML served by Vite's dev server
- Only inject in development mode (not production builds)
- Provide configuration options (e.g. activation position, storage path)
- Be framework-agnostic — no assumptions about React, Vue, Svelte, etc.

---

### 2. Floating Activation Icon

A fixed-position icon in the bottom-right corner of the viewport. Clicking it toggles annotation mode on/off.

**Inactive state:** Small, unobtrusive icon. Should not interfere with the app being developed.

**Active state:** Icon changes appearance to indicate annotation mode is on. A settings/control panel expands from or near the icon.

**The control panel shows:**
- Screenshot toggle (on/off) — with note that vision mode uses more AI credits
- Annotation count for current session
- "Copy to Clipboard" button
- "Clear All" button
- "Close Mode" button

---

### 3. Element Selection & Highlighting

When annotation mode is active, hovering over any element shows a highlight overlay indicating it can be selected. Clicking selects it for annotation.

**Hover state:**
- Dashed border around the element (marching-ants animation)
- Element tag/class shown in a small tooltip near the cursor

**Selection behaviour:**
- Uses `document.elementFromPoint(x, y)` to identify the element under the cursor
- Generates a unique CSS selector for the element, preferring: `data-testid` → `id` → meaningful class names → structural path (nth-child)
- Also generates an XPath as fallback
- Captures `getBoundingClientRect()` for position/size
- Captures `getComputedStyle()` for current rendered styles
- The annotation tool's own elements (overlay, cards, pins, panel) must be excluded from selection

**Computed styles captured:**
`fontSize`, `fontWeight`, `fontFamily`, `color`, `backgroundColor`, `lineHeight`, `letterSpacing`, `padding`, `margin`, `borderRadius`, `border`, `width`, `height`, `display`, `flexDirection`, `alignItems`, `justifyContent`, `gap`, `opacity`, `boxShadow`, `textAlign`, `textTransform`

---

### 4. Annotation Card

When an element is selected, a card appears anchored near the element. This is the primary interaction surface for leaving feedback.

**Card contains:**

**Header area:**
- Annotation number (e.g. `#1`, `#2`)
- Element identifier (tag + primary class/id, e.g. `h1.page-title`)
- Close/cancel button

**Comment section:**
- Multi-line textarea for free-text feedback
- Placeholder: "Describe what should change..."

**Quick action buttons:**
A row of template buttons that auto-populate structured feedback. Each template captures the relevant computed styles and frames them for the AI:

| Template | Label | Behaviour |
|---|---|---|
| Wrong color | `COLOR` | Captures `color`, `backgroundColor`. Adds intent: "user flagged incorrect color" |
| Too much spacing | `SPACING` | Captures `padding`, `margin`, `gap`. Adds intent: "user flagged excessive spacing" |
| Wrong font | `FONT` | Captures `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`. Adds intent: "user flagged incorrect typography" |
| Fix alignment | `ALIGN` | Captures `display`, `flexDirection`, `alignItems`, `justifyContent`, `textAlign`. Adds intent: "user flagged alignment issue" |
| Doesn't match design | `REFERENCE` | Prompts reference image upload. Adds intent: "implement to match reference image" |
| General feedback | `COMMENT` | Free text only — no auto-captured intent |

Quick actions and free-text comments can be combined. Selecting a quick action doesn't prevent also typing a comment.

**Styles diff panel (expandable):**
- Shows a list of the element's current computed CSS properties
- Each property has an editable "target" field next to the current value
- User can type a new value (e.g. change `16px` to `24px`)
- Only edited properties are included in the export as diffs
- This section is collapsed by default — it's a power feature, not required

**Reference image upload:**
- Drop zone or file picker for attaching an image per annotation
- Accepts PNG, JPG, WebP
- Shows a thumbnail preview in the card when attached
- Saved to `.ui-annotations/` folder with the other data

**Priority selector:**
- Three levels: high, medium, low
- Default: medium
- Visual indicator on the pin marker
- Export is ordered by priority (high first)

**Card actions:**
- Save — saves annotation data, closes card, places pin on element
- Delete — removes annotation if editing an existing one
- Cancel — discards and closes card

**Card positioning:**
- Appears next to the selected element (prefer right side, fall back to left/above/below if no space)
- Should not overflow the viewport
- Should not cover the selected element

---

### 5. Pin Markers

After an annotation is saved, a numbered pin marker appears at the element's top-left corner.

**Pin behaviour:**
- Displays the annotation number
- Click pin → reopens the annotation card for editing
- Hover pin → shows tooltip with comment preview
- Pins should track their element if the layout changes (use `MutationObserver` and `ResizeObserver` to update positions)
- Pins use priority-based visual differentiation (to be styled later)

---

### 6. Screenshot Capture

When vision mode is enabled (toggle in control panel), each annotation automatically captures a cropped screenshot of the selected element using `html2canvas`.

**Capture details:**
- Crop to element bounding box plus configurable padding (default ~16px)
- Scale: 2x for retina quality
- Transparent background where possible
- Target file size: under 200KB per screenshot
- Saved as PNG to `.ui-annotations/screenshot_NNN.png`
- Filename referenced in the annotation JSON data

**Capture timing:** Immediate, at the moment the element is selected (before the annotation card opens). This ensures the screenshot shows the element without the annotation UI overlaid.

---

### 7. Data Storage

All annotation data is written to a `.ui-annotations/` folder in the project root via the Vite plugin's server middleware.

```
.ui-annotations/
├── annotations.json        ← all annotation data
├── screenshot_001.png      ← element screenshots (when vision mode is on)
├── screenshot_002.png
├── reference_001.png       ← user-uploaded reference images
└── reference_002.png
```

**annotations.json structure:**

```json
{
  "annotations": [
    {
      "id": "ann_1707217800000",
      "number": 1,
      "timestamp": "2026-02-06T10:30:00Z",
      "priority": "high",

      "element": {
        "selector": "main > .hero-section > h1",
        "xpath": "/html/body/main/section[1]/h1",
        "tag": "h1",
        "textContent": "Welcome to Dashboard",
        "boundingBox": { "x": 120, "y": 340, "width": 280, "height": 44 }
      },

      "computedStyles": {
        "fontSize": "16px",
        "fontWeight": "400",
        "color": "rgb(0, 0, 0)",
        "lineHeight": "24px",
        "padding": "12px 16px",
        "margin": "0 0 20px 0"
      },

      "targetStyles": {
        "fontSize": "24px",
        "fontWeight": "700"
      },

      "comment": "Match the Figma heading style",
      "quickAction": "font",
      "quickActionIntent": "user flagged incorrect typography",

      "screenshot": "screenshot_001.png",
      "referenceImage": "reference_001.png"
    }
  ],

  "settings": {
    "visionMode": true
  },

  "page": {
    "url": "http://localhost:3000/dashboard",
    "viewport": { "width": 1920, "height": 1080 },
    "userAgent": "Mozilla/5.0...",
    "capturedAt": "2026-02-06T10:30:00Z"
  }
}
```

---

### 8. Export to Clipboard

The primary export is a "Copy to Clipboard" button in the control panel. It generates structured markdown optimised for AI coding agents.

**Export format (with vision mode on):**

```markdown
I have 3 UI annotations to implement. Annotations are ordered by priority.

---

## Annotation 1 (HIGH) — h1.page-title

**Element:** `h1.page-title`
**Selector:** `main > .hero-section > h1`
**Current text:** "Welcome to Dashboard"

**Style changes:**
- font-size: 16px → 24px
- font-weight: 400 → 700

**Intent:** User flagged incorrect typography
**Comment:** "Match the Figma heading style"

**Screenshot:** .ui-annotations/screenshot_001.png
**Reference image:** .ui-annotations/reference_001.png

---

## Annotation 2 (MEDIUM) — div.card
...
```

**Export format (vision mode off):** Same structure but without screenshot/reference image lines.

**Export format (no style diffs):** If the user only left a comment/quick action without editing target styles, the "Style changes" section is replaced with a "Current styles" section listing the relevant computed values.

---

## Technical Foundation

### Distribution
- Vite plugin (V1), with Next.js and Webpack plugins planned for V2
- Auto-injects in dev mode only, dormant until activated
- Framework-agnostic — works with React, Vue, Svelte, Angular, vanilla JS

### Key Dependencies
- **html2canvas** — client-side element screenshot capture
- **Browser APIs** — `document.elementFromPoint()`, `getBoundingClientRect()`, `getComputedStyle()`, `MutationObserver`, `ResizeObserver`

### Architecture
The tool has two parts:
1. **Client-side script** — injected into the browser, handles all UI (overlay, cards, pins, selection, screenshots). Communicates with the server via fetch requests.
2. **Vite server middleware** — handles file I/O: writing annotations.json, saving screenshots and reference images to `.ui-annotations/`, serving saved data back to the client.

### Constraints
- Small bundle size (injected into dev environments)
- Zero performance impact when annotation mode is inactive
- All annotation UI must be visually distinct from the host app (will be styled separately)
- All annotation UI elements must be excluded from element selection
- Must work on any localhost page regardless of framework

### UI Framework & Styling
- TBD: Vanilla JS, Preact, React, or Svelte (bundle size is the deciding factor)
- TBD: Vanilla CSS with variables, CSS Modules, or minimal Tailwind
- All components should be built with clean separation so they can be re-styled independently later

---

## V2 Features (Post-Launch)

These provide context for architecture decisions — the V1 code should not block these, but doesn't need to implement them.

### MCP Server Integration
Expose annotations via Model Context Protocol so AI agents (Claude Code, Cursor) can read annotations directly without clipboard paste. The Vite plugin would run an MCP server alongside the dev server.

### Next.js & Webpack Plugins
Same annotation tool, different injection points. The core client-side code stays the same; only the plugin wrapper changes.

### Design Token Awareness
Compare element styles against the project's design token system (CSS variables, Tailwind config, or a tokens.json file). Flag when a computed value doesn't match any defined token. Suggest the nearest token value.

### Before/After Comparison Mode
After the AI implements changes, re-capture screenshots of annotated elements and show a side-by-side diff against the original screenshots. Helps verify the AI got it right.

### Annotation History & Sessions
Persist annotation sessions with timestamps. Allow reviewing past sessions and re-exporting. Track which annotations have been "resolved" (implemented by the AI).

### Responsive Viewport Annotations
Annotate at multiple breakpoints. Resize viewport, annotate the same elements, and export grouped by viewport size.

### Multi-Page Batching
Annotate across multiple pages/routes in a single session. Export includes page URL per annotation.

---

## V3 Features (Future)

### Figma Sync Plugin
Pull reference images directly from Figma frames via the Figma API. Link a Figma frame to an annotation instead of uploading a screenshot.

### Animation Pause
Pause CSS animations and transitions on the page to annotate elements in specific animation states.

### Area / Multi-Select
Draw a rectangle to select a region, or shift-click to select multiple elements for a single annotation.

### Custom Quick Action Templates
Let users define their own quick action templates with custom intents and auto-captured style properties.

### Two-Way Agent Collaboration
AI agent can push questions back through the tool — e.g. "Did you mean this element or this one?" with interactive selection.

---

## Out of Scope (No Current Plans)

- Browser extension version
- Cloud storage / sync / accounts
- Team collaboration features
- Canvas / WebGL annotation
- Shadow DOM / iframe annotation
- Non-localhost usage

---

## Open Decisions

1. **UI framework:** Vanilla JS vs Preact vs React vs Svelte (bundle size is key)
2. **Styling approach:** Vanilla CSS + variables vs CSS Modules vs minimal Tailwind
3. **Tool name**
