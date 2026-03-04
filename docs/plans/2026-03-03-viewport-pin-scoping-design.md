# Viewport Pin Scoping Design

## Problem

Pins currently show on all viewports with no scoping. This creates noise (375px view shows 768px/1024px pins) and the exported prompt doesn't give the LLM enough context about viewport-specific vs universal fixes.

## Design

### Pin Visibility Rules

A pin shows on a viewport if:

1. **Created at the current viewport** — a 375px pin only shows at 375px
2. **Created in Full mode** — Full mode pins show on all viewports (they're the "base layer")

Full mode pins are the general annotations. Viewport-specific pins are breakpoint overrides on top.

### Tooltip Viewport Tag

Each pin's hover tooltip shows its origin viewport as a small tag before the comment:

- Full mode pin → `[Full] Too much padding here`
- 375px pin → `[375px] Collapse to hamburger menu`

This helps distinguish base-layer pins from viewport-specific ones when both appear on the same element.

### Storage

- Full mode annotations store `viewportWidth: null` (not the actual browser width)
- Viewport-specific annotations store the preset width (375, 768, 1024)
- No new fields needed — uses existing `viewportWidth` on the `Annotation` type

### Export / Clipboard Output

**Full mode annotations** — no viewport label in export. The LLM naturally applies the fix everywhere:

```markdown
## Annotation 1 (HIGH) — nav.sidebar
**Comment:** Add more padding to the nav links
```

**Viewport-specific annotations** — include viewport + breakpoint label. The LLM scopes the fix:

```markdown
## Annotation 2 (MEDIUM) — nav.sidebar
**Viewport:** 375px (Mobile)
**Comment:** Collapse sidebar to hamburger menu
```

### Conflict Awareness

When a viewport-specific annotation targets the same element as a Full mode annotation, the export adds a note linking them:

```markdown
## Annotation 2 (MEDIUM) — nav.sidebar
**Viewport:** 375px (Mobile)
**Note:** See also annotation #1 (general) for this element
**Comment:** Collapse sidebar to hamburger menu
```

No direct instruction — just makes the LLM aware so it can check for itself.

### Resize Responsiveness

PinMarker listens for:

- `window` resize events (catches iframe container moving)
- iframe `contentWindow` resize events (catches content reflow)
- MutationObserver + ResizeObserver on the element (existing)

Pins that can't find their element in the current context return `null` (don't render).

## Files to Change

- `src/client/components/PinMarker.tsx` — resize listeners (done), visibility filtering by viewport
- `src/client/components/App.tsx` — filter annotations before rendering pins
- `src/client/components/ElementSelector.tsx` — store `null` for Full mode viewportWidth
- `src/client/utils/export.ts` — conflict notes for same-element cross-viewport annotations
- `src/client/bridge.ts` — ensure viewportWidth from bridge matches preset
