# Vibe Annotator

## Build System

**Dual build via tsup** — produces two separate outputs from one config:
- **Plugin** (ESM + CJS): `dist/index.js`, `dist/index.cjs` — Node.js, imported in `vite.config.js`
- **Client** (IIFE): `dist/client.global.js` — browser bundle injected via `transformIndexHtml`

### Known Gotchas

**IIFE output filename**: tsup names IIFE output `client.global.js` (not `client.iife.js`) when `globalName` is set. The plugin reads this file by name at runtime — if you rename `globalName` in tsup config, update `src/plugin/index.ts:55` to match.

**CSS inlining**: tsup intercepts `.css` imports with its own pipeline, so you cannot use esbuild's `{ '.css': 'text' }` loader. Instead we use a virtual module (`virtual:inline-css`) via an esbuild plugin in `tsup.config.ts`. The type declaration is in `src/client/css.d.ts`.

**ESM/CJS dual compat**: The plugin needs to resolve its own `dist/` directory at runtime. `import.meta.url` works for ESM, `__dirname` for CJS. `src/plugin/index.ts` has a `getDistDir()` helper with try/catch fallback.

**pnpm v10+ esbuild**: `package.json` requires `pnpm.onlyBuiltDependencies: ["esbuild"]` because pnpm v10 blocks postinstall scripts by default, and esbuild needs its postinstall to install platform binaries.

**package.json exports order**: `"types"` must come before `"import"`/`"require"` in the exports map or TypeScript won't resolve types.

**jsdom for client tests**: Selector tests need DOM. Use `// @vitest-environment jsdom` pragma at top of test file. `jsdom` is a devDependency. Don't set jsdom globally — plugin tests should run in node environment.

**CSS.escape**: jsdom doesn't implement `CSS.escape`. `src/client/utils/selector.ts` has a `cssEscape()` helper with fallback.

## Event Handling

**Capture-phase listeners**: `ElementSelector` uses `{ capture: true }` on document for mousemove/click. Critical rule: **always check `isAnnotatorElement(target)` and return early BEFORE calling `stopPropagation()`**, otherwise clicks on the annotator's own UI (buttons, inputs) get swallowed. This was a real bug — the copy button didn't work until this was fixed.

**Node.js HTTP headers**: Call `res.writeHead(status, { headers })` with headers in the options object. Never call `res.setHeader()` after `res.writeHead()` — headers set after writeHead are silently ignored.

## Testing

- `pnpm test` — vitest, 20 tests across 4 files
- Plugin tests (node): `src/plugin/__tests__/storage.test.ts`, `middleware.test.ts`
- Client util tests (jsdom): `src/client/utils/__tests__/selector.test.ts`, `export.test.ts`
- UI components have no unit tests — manual testing via `demo/`

## Demo App

`cd demo && pnpm dev` — links to parent package. Must `pnpm build` in root first after any source changes.

## Commands

```
pnpm build          # Build plugin + client
pnpm test           # Run all tests
pnpm dev            # Watch mode build
cd demo && pnpm dev # Run demo app on localhost:5173
```
