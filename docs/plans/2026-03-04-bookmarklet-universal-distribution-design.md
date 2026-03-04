# Bookmarklet & Universal Distribution Design

**Date**: 2026-03-04
**Status**: Approved
**Goal**: Transform vibe-annotator from a Vite-only plugin into a universal tool accessible via bookmarklet, while keeping the architecture pluggable for future adapters (Chrome Extension, Vite plugin, etc).

## Context

The current tool is a Vite plugin — it only works during Vite dev server sessions. Target users are vibe coders, designers, and developers using AI tools. They need something that works on any website with zero setup.

**Decision**: Ship a bookmarklet first for fast user testing. Keep the plugin architecture so Vite plugin, Chrome Extension, and other adapters can be added later.

## Architecture: Client Core + Adapters

```
src/
  core/              ← Preact app, components, hooks, utils (adapter-agnostic)
  adapters/
    bookmarklet/     ← IIFE entry, MemoryStorage, clipboard export
    vite/            ← Existing plugin (ServerStorage, file-based)
    extension/       ← Future: Chrome Extension (chrome.storage)
  shared/
    types.ts         ← Existing shared types
    storage.ts       ← StorageAdapter interface
```

Each adapter provides three things:
- **Inject**: How the client gets onto the page
- **Storage**: Where annotations live during a session
- **Export**: How annotations leave the tool

The Preact client components don't change — they dispatch to the reducer. The adapter is wired in once at initialization.

## Storage Adapter Interface

```typescript
// src/shared/storage.ts

interface StorageAdapter {
  load(): Promise<Annotation[]>
  save(annotation: Annotation): Promise<void>
  remove(id: string): Promise<void>
  update(annotation: Annotation): Promise<void>
  saveImage?(id: string, blob: Blob): Promise<string>  // returns displayable URL
  getImageUrl?(id: string): string
}
```

### Adapter Implementations

**MemoryStorage** (bookmarklet):
- Annotations in a `Map<string, Annotation>`
- Images stored as blob URLs via `URL.createObjectURL()`
- Everything lost on page refresh — that's fine for the use case
- Export = structured markdown copied to clipboard

**ServerStorage** (existing Vite plugin):
- Current `api.ts` REST calls wrapped to match the interface
- Reads/writes to `.ui-annotations/` on disk via Vite dev server middleware
- No changes to plugin/middleware.ts or plugin/storage.ts

**LocalStorage** (future option):
- Persist across page refreshes
- Keyed by `window.location.origin + pathname`
- Upgrade path from MemoryStorage

## Bookmarklet Details

### The Snippet

```javascript
javascript:void((function(){
  if(window.__vibeAnnotator){window.__vibeAnnotator.toggle();return}
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/gh/OWNER/vibe-annotator@VERSION/dist/bookmarklet.global.js';
  document.body.appendChild(s);
})())
```

- Checks if already loaded (toggle on/off)
- Loads the full bundle from CDN
- Bundle self-initializes with MemoryStorage adapter

### Hosting

The built `dist/bookmarklet.global.js` is published via:
- GitHub Releases → jsdelivr CDN (free, versioned)
- Alternative: Cloudflare Pages for a custom domain later

### CSP Considerations

Some sites (GitHub, banking sites, etc.) block inline scripts and external script loading via Content-Security-Policy headers. The bookmarklet will not work on those sites. This is a known limitation — the Chrome Extension adapter (Phase 2) solves it.

## Build Changes

Update `tsup.config.ts` to add a third output:

| Output | Format | Entry | Purpose |
|--------|--------|-------|---------|
| `dist/index.js` + `dist/index.cjs` | ESM + CJS | `src/adapters/vite/index.ts` | Vite plugin (existing) |
| `dist/client.global.js` | IIFE | `src/core/index.ts` | Client injected by Vite plugin |
| `dist/bookmarklet.global.js` | IIFE | `src/adapters/bookmarklet/index.ts` | Standalone bookmarklet bundle |

The bookmarklet entry bundles the core Preact app + MemoryStorage + self-mount logic.

## Refactoring Steps

### 1. Create StorageAdapter interface
- Add `src/shared/storage.ts` with the interface above
- Export from shared types

### 2. Create MemoryStorage adapter
- `src/adapters/bookmarklet/MemoryStorage.ts`
- In-memory Map for annotations, blob URLs for images

### 3. Refactor client to accept adapter via config
- Current `src/client/utils/api.ts` has hardcoded fetch calls to `/__annotations/api/`
- Replace with adapter passed through Preact context
- Components call `adapter.save()` etc. instead of importing api.ts directly

### 4. Wrap existing api.ts as ServerStorage
- `src/adapters/vite/ServerStorage.ts` — same fetch calls, implements StorageAdapter
- Vite plugin passes this adapter when it injects the client

### 5. Create bookmarklet entry point
- `src/adapters/bookmarklet/index.ts` — creates container, mounts Preact app with MemoryStorage
- Registers `window.__vibeAnnotator` for toggle support
- Shadow DOM container to avoid style conflicts (already done in current client)

### 6. Update tsup config
- Add bookmarklet build target
- Keep existing plugin + client targets unchanged

### 7. Keep Vite plugin working
- `src/adapters/vite/index.ts` — existing plugin, reads `client.global.js`, injects into HTML
- No behavioral changes, just imports from new paths

## User Flow

1. User drags bookmarklet to their bookmarks bar (from a landing page)
2. User navigates to any website
3. User clicks the bookmarklet — annotator overlay appears
4. User clicks elements, describes issues, picks quick actions
5. User clicks "Export" — structured markdown copied to clipboard
6. User pastes into Claude, Cursor, ChatGPT, or any AI tool

## Future Phases

**Phase 2 — Chrome Extension**:
- `src/adapters/extension/` with manifest.json, content script, chrome.storage adapter
- Publish to Chrome Web Store
- Solves CSP limitation of bookmarklet

**Phase 3 — Direct AI Integration**:
- Export adapter that sends annotations to Claude API, OpenAI API, etc.
- Could be built into any adapter (extension popup with "Send to Claude" button)

**Phase 4 — Landing Page**:
- Static site (GitHub Pages or similar)
- Big draggable bookmarklet button
- 3-step visual instructions
- Demo video

## What Does NOT Change

- All Preact components (`src/client/components/`)
- All client hooks (`src/client/hooks/`)
- All client utils except api.ts (`selector.ts`, `styles.ts`, `export.ts`)
- Shared types (`src/shared/types.ts`)
- Plugin middleware and storage (`src/plugin/middleware.ts`, `src/plugin/storage.ts`)
- Tests (existing tests remain valid, add new tests for MemoryStorage)
