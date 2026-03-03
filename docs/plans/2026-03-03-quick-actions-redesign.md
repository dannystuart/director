# Quick Actions Redesign

> Problem: Quick action buttons (COLOR, SPACING, etc.) are vague single-word labels with no indication of direction. "Spacing" could mean too much, too little, or wrong. The AI gets an ambiguous intent and has to guess.

---

## Changes Summary

1. **Remove `REFERENCE` and `COMMENT` buttons** — reference is replaced by a dedicated image upload; comment box is already visible
2. **Add directional sub-options** to remaining buttons via inline pill row
3. **Add "Match design" sub-option** to each category with contextual image upload prompt
4. **Reorder annotation card** — comment first, then image, then quick actions
5. **Add always-visible image upload button** — one place for reference images, always obvious

---

## New Button Set

4 buttons (down from 6): `COLOR` `SPACING` `FONT` `ALIGN`

### Sub-options per button

| Button | Sub-options |
|---|---|
| `COLOR` | Too dark · Too light · Wrong color · Match design |
| `SPACING` | Too much · Too little · Match design |
| `FONT` | Too small · Too large · Wrong weight · Wrong family · Match design |
| `ALIGN` | Move left · Move right · Center it · Match design |

---

## Sub-menu Interaction

- Tapping a quick action button expands a row of pill-shaped sub-options directly below the button row
- Only one category expanded at a time — tapping a different category swaps the pills
- Tapping a pill selects it (highlighted state)
- Tapping the parent button again collapses and deselects the category
- Multiple categories can be selected — previously selected categories show their parent button highlighted with the chosen sub-option as a small label
- "Match design" is always the last pill in each row for consistency

---

## "Match design" Behaviour

- Records a specific intent: e.g. "Color doesn't match the design — adjust to match"
- Does NOT force an image upload — the AI may have design context via MCP, tokens, or comments
- The image upload area is already visible on the card if the user wants to attach a reference
- No session-level reference image concept — keep it simple

---

## Annotation Card Layout (new order)

```
┌─────────────────────────────────────┐
│ #1 — h1.page-title              [×] │  ← Header
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Describe what should change...  │ │  ← Comment box (primary input)
│ └─────────────────────────────────┘ │
│                                     │
│ 📎 Add image                        │  ← Icon + text button, natural width
│                                     │  ← Shows thumbnail + remove btn when uploaded
│ ── Quick actions ──────────────     │  ← Subheader
│                                     │
│ [COLOR] [SPACING] [FONT] [ALIGN]   │  ← Quick action buttons
│                                     │
│ (Too much) (Too little) (Match ...)│  ← Sub-option pills (when expanded)
│                                     │
│ Priority: ○ High  ● Medium  ○ Low  │  ← Priority selector
├─────────────────────────────────────┤
│ [DELETE]          [CANCEL]  [SAVE]  │  ← Actions
└─────────────────────────────────────┘
```

---

## Data Model Changes

Current:
```json
{
  "quickAction": "spacing",
  "quickActionIntent": "User flagged incorrect spacing"
}
```

New:
```json
{
  "quickActions": [
    {
      "category": "spacing",
      "detail": "too-much",
      "intent": "User flagged excessive spacing"
    },
    {
      "category": "color",
      "detail": "match-design",
      "intent": "Color doesn't match the design — adjust to match"
    }
  ]
}
```

Multiple quick actions supported (array, not single value).

---

## Export Output Changes

Before:
```
**Intent:** User flagged incorrect spacing
```

After:
```
**Intent:** User flagged excessive spacing
```

Or with match design + reference image:
```
**Intent:** Color doesn't match the design — adjust to match
**Reference image:** .ui-annotations/reference_001.png
```

---

## Intent Strings

| Category | Detail | Intent |
|---|---|---|
| color | too-dark | User flagged color is too dark |
| color | too-light | User flagged color is too light |
| color | wrong-color | User flagged wrong color |
| color | match-design | Color doesn't match the design — adjust to match |
| spacing | too-much | User flagged excessive spacing |
| spacing | too-little | User flagged insufficient spacing |
| spacing | match-design | Spacing doesn't match the design — adjust to match |
| font | too-small | User flagged font is too small |
| font | too-large | User flagged font is too large |
| font | wrong-weight | User flagged incorrect font weight |
| font | wrong-family | User flagged incorrect font family |
| font | match-design | Typography doesn't match the design — adjust to match |
| align | move-left | User flagged element should move left |
| align | move-right | User flagged element should move right |
| align | center-it | User flagged element should be centered |
| align | match-design | Alignment doesn't match the design — adjust to match |

---

## Files to Modify

- `src/shared/types.ts` — update `QuickAction` type, add `QuickActionDetail` type, update annotation interface
- `src/client/components/AnnotationCard.tsx` — reorder layout, remove REFERENCE/COMMENT buttons, add sub-option pills, add image upload button
- `src/client/components/AnnotationCard.css` — styles for pills, sub-menu animation, image upload button
- `src/client/utils/export.ts` — update export format to use new intent strings
- `src/shared/types.ts` — update annotation schema for `quickActions` array

---

## Out of Scope

- Session-level reference images
- Design token awareness (V2 feature)
- Auto-detecting design context from MCP
- Styles diff panel changes (stays as-is, collapsed by default)
