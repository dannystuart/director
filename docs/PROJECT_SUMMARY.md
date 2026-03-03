# Vibe Annotator — Project Summary

> Vite plugin that lets users click elements in the browser, describe what's wrong, and export structured feedback as markdown for AI agents.

## Architecture

```
vibe-annotator/
├── src/
│   ├── plugin/                  ← Vite plugin (Node.js)
│   │   ├── index.ts             ← exports annotateUI(), injects client IIFE
│   │   ├── middleware.ts        ← REST API at /__annotations/api/
│   │   ├── storage.ts           ← File I/O to .ui-annotations/
│   │   └── __tests__/           ← 10 tests (storage + middleware)
│   ├── client/                  ← Browser UI (Preact IIFE)
│   │   ├── index.tsx            ← Mounts Preact app, injects CSS
│   │   ├── App.tsx              ← Root component, useReducer state
│   │   ├── context.ts           ← AppState, AppAction, AppContext
│   │   ├── styles.css           ← Terminal aesthetic, va- prefixed
│   │   ├── css.d.ts             ← Type decl for virtual:inline-css
│   │   ├── components/
│   │   │   ├── FloatingIcon.tsx  ← Toggle button (inactive/selecting)
│   │   │   ├── ElementSelector.tsx ← Hover highlight + click capture
│   │   │   ├── AnnotationCard.tsx  ← Feedback form with quick actions
│   │   │   ├── StylesDiff.tsx    ← Collapsible computed vs target styles
│   │   │   ├── PinMarker.tsx     ← Numbered pins on annotated elements
│   │   │   └── ControlPanel.tsx  ← Vision toggle + copy button
│   │   ├── hooks/
│   │   │   └── useScreenshot.ts  ← html2canvas capture (lazy-loaded)
│   │   └── utils/
│   │       ├── api.ts            ← Fetch wrapper for middleware
│   │       ├── selector.ts       ← CSS selector + XPath generation
│   │       ├── styles.ts         ← Computed style capture (22 props)
│   │       ├── export.ts         ← Markdown export builder
│   │       └── __tests__/        ← 10 tests (selector + export)
│   └── shared/
│       └── types.ts              ← Annotation, ComputedStyles, etc.
├── demo/                         ← Test app (link:.. to parent)
├── tsup.config.ts                ← Dual build: ESM/CJS plugin + IIFE client
├── package.json
└── tsconfig.json
```

## How It Works

1. Consumer adds `annotateUI()` to their `vite.config.js`
2. Plugin registers REST middleware and injects the client IIFE via `transformIndexHtml` (dev mode only)
3. Client mounts a Preact app inside `<div data-vibe-annotator>` with inlined CSS
4. State machine: `inactive → selecting → annotating → selecting → ...`
5. In selecting mode: capture-phase listeners intercept mousemove/click on host app elements
6. On click: generates CSS selector, XPath, captures 22 computed styles, optionally takes screenshot
7. Annotation card opens for the user to add comment, quick actions, priority, target styles, reference images
8. Saved annotations persist to `.ui-annotations/annotations.json` via REST middleware
9. "COPY" button exports all annotations as priority-ordered markdown to clipboard

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/__annotations/api/annotations` | Load all annotations |
| POST | `/__annotations/api/annotations` | Save/update annotation |
| DELETE | `/__annotations/api/annotations/:id` | Remove annotation |
| POST | `/__annotations/api/screenshot` | Save base64 PNG screenshot |
| POST | `/__annotations/api/reference` | Save base64 PNG reference |
| GET | `/__annotations/api/images/:filename` | Serve saved image |

## State Model

```ts
interface AppState {
  mode: 'inactive' | 'selecting' | 'annotating'
  annotations: Annotation[]
  activeAnnotation: string | null
  visionMode: boolean
  hoveredElement: HTMLElement | null
}
```

Actions: `SET_MODE`, `SET_ANNOTATIONS`, `SET_ACTIVE`, `SET_VISION_MODE`, `SET_HOVERED`, `ADD_ANNOTATION`, `UPDATE_ANNOTATION`, `REMOVE_ANNOTATION`

## Key Design Decisions

- **Preact over React** — ~3KB, full component model
- **IIFE injection** — zero config for consumer, no separate script tag needed
- **Capture-phase events** — intercepts clicks before host app, with `[data-vibe-annotator]` exclusion
- **html2canvas lazy-loaded** — ~40KB only loaded when vision mode is on
- **va- CSS prefix** — avoids conflicts with host app styles
- **Virtual CSS module** — tsup's CSS pipeline conflicts with text loader, so CSS is inlined via esbuild plugin

## Tech Stack

- Preact 10, TypeScript strict, tsup, vitest, html2canvas
- Node APIs: fs/promises, path, http (middleware)
- No runtime dependencies — everything bundled into IIFE or uses Vite's own APIs
