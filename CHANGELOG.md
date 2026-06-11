# Changelog

All notable changes to this project will be documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.6] — 2026-06-12

### Added

- `Canvas2DRenderer` ships behind the same `Renderer` interface as `WebGL2Renderer`. Opt in with `rendererKind: 'canvas2d'`. Useful for environments without WebGL2 or for workloads whose labels are CJK-heavy (see Known limitations).
- `FlowChartOptions.groupDoubleClickCollapses?: boolean` — explicit opt-in for double-click → collapse on group nodes. **Default is false** so a single accidental double-click can never hide an entire subtree. Set to `true` to restore the previous behavior. Explicit collapse via `toggleCollapse(id)` / `collapseNode(id)` / `expandNode(id)` is always available regardless of the option.
- `FlowChart.dissolveGroup(groupId)` — new public API that removes the group container node itself and detaches every child, so children survive as top-level nodes and edges between them are preserved. Edges connected directly to the group are removed with the group (same as `removeNode`). No-op when `groupId` is not a `type: 'group'` node. Single undo entry. Pairs with the existing `ungroupNodes(childIds)` which only detaches children and leaves the group container intact — use `ungroupNodes` to pull selected children out of a group that should stay, and `dissolveGroup` when the group itself should disappear.
- `services/safe-css.ts` — single source of truth for the CSS-attribute allow-list (`safeColor` / `safeNumber` / `safeDashArray` / `safeFontFamily`). `svg-export.ts` and `label-edit.ts` now share these validators instead of carrying duplicate copies; hardening the allow-list now propagates everywhere.
- `packages/core/PERFORMANCE.md` documents SPEC verification (1K @ 120 fps, 5K @ 113.6 fps, 10K @ 114.1 fps under SwiftShader) and the 8 optimizations behind those numbers.
- 3 new axe-core tests covering Korean `ariaLabel`, `aria-keyshortcuts` token grammar (WAI-ARIA 1.2 named-key list), and the sr-only positioning of the `aria-live` region.
- 4 new visual-regression tests pinning that node labels render centered horizontally inside their atlas entry (3 in `productization.test.ts` covering `textAlign='center'`, single-line draw x past `PADDING`, multi-line lines share x; 1 in `edge-cases.test.ts` pinning `groupDoubleClickCollapses` default storage).

### Changed

- `FlowChart.canvasDblClick` now suppresses the inline label editor for nodes whose visual is rendered via `htmlContent` — editing `label` on such a node had no visible effect because `HtmlOverlay` owns the pixels. The `nodeDoubleClick` event still fires so consumer apps can route those nodes to their own editor.
- Node labels in the WebGL2 renderer now anchor at the horizontal center of their atlas entry's text block. Previously, `text-atlas.ts` left the per-entry `OffscreenCanvas` at the spec default `textAlign='start'`, so glyphs sat at the left edge and labels — especially CJK / Hangul, and any string whose conservative-estimated width exceeded the measured width — rendered visibly left-shifted inside their node quad. The fix is two lines: `textAlign='center'` plus `centerX = PADDING + blockW / 2`.
- Group nodes no longer collapse on double-click by default. Previously, double-clicking a `type: 'group'` node called `toggleCollapse` unconditionally, which hid the entire subtree on one click and was easy to trigger by accident. The new default emits `nodeDoubleClick` and routes to the label editor (the same path as any other node); set `groupDoubleClickCollapses: true` to restore the prior behavior. Programmatic `toggleCollapse(id)` is unchanged.

### Security

- All 4 packages enable `publishConfig.provenance: true`. Consumers can verify the tarball with `npm audit signatures @flowgl/<pkg>`.
- New `scripts/generate-sbom.mjs` emits deterministic CycloneDX 1.5 SBOMs for all 4 packages; each tarball ships `sbom.json` for downstream supply-chain auditing.

### Documentation

- Root README adds a 60-second tour code example and new badges for coverage, provenance, SBOM, and CJK status.
- `PRODUCT.md` adds a "Core Value Tenets" section formalizing the seven non-negotiable properties of the project (GPU-first rendering, zero deps, framework-agnostic core, renderer-backend interchangeability, visual feature parity across backends, performance tier, accessibility). `AGENTS.md` adds the per-tenet pre-merge guardrails and a "Tenet-Violation Escalation Protocol" so any future change that would break a tenet halts at planning time. `SPEC_CHECKLIST.md` adds a "Tenet Regression Gates" section as the binary pass/fail at Definition-of-Done time. These three documents are intentionally redundant: a tenet without a guardrail is a wish; a guardrail without a regression check is a slogan.

### Known limitations

- WebGL2 atlas drops glyph pixels for CJK / Hangul / Japanese / mixed strings inside the chart's render frame (every isolated reproduction renders 261 nonzero pixels; live in-frame produces 113). Workaround: opt the affected chart into Canvas2D with `rendererKind: 'canvas2d'`. The atlas-level root cause is under investigation as a separate workstream targeted for 0.4.0 (see "Roadmap" below); resolving it will not change the default renderer.
- `Canvas2DRenderer` does not yet render the WebGL-only HandleProgram (connect-drag circles), reroute handles, or endpoint circles. These are tracked under T5 (Visual Feature Parity Across Backends) in `PRODUCT.md`. Canvas2D will remain opt-in until parity is closed.

### Roadmap (informational — no code in 0.2.6)

- **0.4.0 — WebGL2 atlas CJK fix.** Root-cause the in-frame glyph-pixel drop and remove the Known-limitation above. Investigation plan in `TASK.md`. Target keeps the default renderer at WebGL2 (T1) and adds no new dependencies (T2).

## [0.2.5] — 2026-06-11

### Added

- GitHub Actions `ci.yml` runs `pnpm typecheck && test && build` on every push and PR to `master` (badge wired into the root README).
- GitHub Actions `release.yml` (manual `workflow_dispatch`) publishes selected packages with `npm publish --provenance` so consumers can verify the tarball came from this exact commit. Requires the `NPM_TOKEN` secret on the repo.
- Root README badges: per-package npm versions (core / react / vue / svelte), npm monthly downloads, CI status.
- core README — Accessibility section now includes a WCAG 2.2 AA audit table (criterion × library guarantee × caller responsibility) plus an `@axe-core/playwright` snippet so consumers can automate the check.

## [0.2.4] — 2026-06-11

### Changed

- `FlowChart` shrunk from 1946 → 1769 LOC by extracting three more services:
  - `services/graph-analysis.ts` — `getIncomers`, `getOutgoers`, `getConnectedNodes`, `hasCycle`, `findPaths` are now pure functions that take a `Graph` argument. `FlowChart`'s methods delegate.
  - `services/alignment.ts` — `alignNodes(graph, nodes, axis)` and `distributeNodes(graph, nodes, axis)` extracted.
  - `services/layout-animator.ts` — `LayoutAnimator` class owns the smoothstep RAF loop. `FlowChart.animateLayout(...)` delegates and `dispose()` cancels via `layoutAnimator.dispose()`.

No public API changes — methods on `FlowChart` keep the same signatures.

## [0.2.3] — 2026-06-11

### Security

- `importJSON({ ..., mode: 'merge' })` now runs the same schema validator as `fromJSON` (it previously trusted the input). `{ skipValidation: true }` opts out.
- `validateChartJson` now rejects `htmlContent` containing `<script>` tags, `javascript:` URLs, or `on*=` inline event handlers. Combined with the `sanitizeHtml` hook, untrusted JSON cannot smuggle XSS through the HTML overlay without an explicit `skipValidation: true` opt-in.

### Tests

- 4 new tests: htmlContent `<script>` rejected, inline event handler rejected, `javascript:` URL rejected, importJSON merge validation.

## [0.2.2] — 2026-06-11

### Security

- **`fromJSON(data)` now runs schema validation before mutating state.** Invalid input throws `TypeError` with a specific reason — non-string `id`, non-finite `x`/`y`, non-positive `width`/`height`, over-length `label` (10k) / `htmlContent` (100k) / `tooltip` (1k), `__proto__` / `constructor` / `prototype` keys. Unknown fields are silently dropped. Pass `{ skipValidation: true }` to opt out when loading data you produced yourself with `toJSON()`.

### Changed

- SVG export moved from `FlowChart.exportSVG` into a new `services/svg-export.ts` (`exportGraphAsSvg(graph, padding)`). `flowchart.ts` shrunk by ~110 LOC; the safe-color / safe-number / safe-dash-array validators now live with the function they protect.

### Tests

- 6 new tests for `fromJSON` schema validation (missing id, non-finite x, `__proto__` pollution, oversized htmlContent, valid payload, skipValidation flag).

## [0.2.1] — 2026-06-11

### Added

- Canvas now exposes `aria-roledescription="Flowchart editor"` and `aria-keyshortcuts` listing every supported shortcut so AT users discover them without reading docs.
- README — 6 new sections: Recipes (external state sync, auto-layout + animate, conditional connection guard, JSON persistence, context menu extension), Accessibility (ARIA contract + WCAG guidance), Security (`sanitizeHtml` recipe + threat model), Migration 0.1.x → 0.2.0.

### Tests

- 3 new ARIA tests in `productization.test.ts` (canvas role / label / shortcuts, custom ariaLabel, aria-describedby content).

## [0.2.0] — 2026-06-11

### Breaking

- **`Renderer.render(graph, viewport, frame)` signature changed.** The 10-parameter positional form (`selectedIds`, `connectState`, `selectedEdgeIds`, `bgColor`, `grid`, `rerouteState`, `endpointCircles`, `dashOffset`) is replaced by a single `RenderFrame` object. Custom renderer implementations must update their signature. The built-in `WebGL2Renderer` migration is internal; consumers who use only `new FlowChart(...)` are unaffected. `Renderer` interface also now requires `hasAnimatedEdges(): boolean`.

### Added

- `setSelection({ nodes?, edges? })` — unified selection setter. Replaces only the dimensions you pass; emits `selectionChange` exactly once.
- `RenderFrame` type exported from `@flowgl/core`.

### Deprecated (removal scheduled for 1.0)

- `setNodeBorderColor(id, color)` → use `setNodeStyle(id, { borderColor })`
- `setNodeBackgroundColor(id, color)` → use `setNodeStyle(id, { backgroundColor })`
- `setNodeShape(id, shape)` → use `setNodeStyle(id, { shape })`
- `setSelectedIds(ids)` → use `setSelection({ nodes: ids })`
- `setSelectedEdgeIds(ids)` → use `setSelection({ edges: ids })`
- `requestRender()` — internal `scheduleRender` already handles all mutations
- `chart.graph` direct access → use `getNodes()` / `getEdges()` / `addNode()` etc.
- `chart.viewport` direct access → use `getViewport()` / `panTo()` / `zoomIn()` etc.

### Changed

- React, Vue, Svelte wrappers no longer reach into `chart.graph` directly; all event handlers go through `chart.getNodes()` / `chart.getEdges()`.

## [0.1.5] — 2026-06-11

### Security

- **`NodeData.htmlContent` is now opt-in unsafe.** `HtmlOverlay` writes still go through `innerHTML`, but the new `FlowChartOptions.sanitizeHtml` hook lets callers plug in a vetted sanitizer (e.g. DOMPurify). If `htmlContent` is set without a sanitizer, a one-time console warning is emitted documenting the trust boundary.
- **`exportSVG` style fields are now whitelisted.** `backgroundColor` / `borderColor` / `textColor` / edge `color` are validated against a CSS-color regex (hex, rgb()/rgba(), hsl()/hsla(), named); invalid input falls back to the documented defaults. `borderWidth` / `borderRadius` / `fontSize` go through a finite-non-negative number guard. `dashArray` requires every entry to be a finite non-negative number — otherwise the attribute is omitted entirely.
- **`label-edit.ts` no longer concatenates user-controlled CSS.** The inline label editor's `cssText` is split into a fixed-shape base block plus per-property `setProperty` calls for `border-color`, `background`, `color`, `font-size`, `font-family`. `fontFamily` rejects `<`, `>`, `;`, `{`, `}` to block declaration breakouts.

### Changed

- `tsconfig.build.json` introduced so Rollup declaration emission excludes `src/__tests__` — published tarballs no longer ship 46 `.test.d.ts` / `.test.d.ts.map` files.
- `*.tgz` added to `.gitignore`; stale 0.1.0 tarball removed from the working tree.

## [0.1.4] — 2026-06-10

### Fixed

- WebGL `BLEND` state was not restored after `webglcontextrestored` — text labels rendered as solid dark rectangles because per-pixel alpha was written directly to the framebuffer instead of being blended. Extracted `applyGlState()` from `createWebGL2Context()` and call it from `reinitializePrograms()` so the blend equation survives a context loss/restore cycle.
- Inline label editor committed mid-IME composition — Enter pressed to confirm a Korean / Japanese / Chinese composition would fire `commit()` before the composition was finalized. Added `e.isComposing || e.keyCode === 229` guard to both node and edge label keydown handlers.
- Inline label editor bypassed the public `updateNode()` / `updateEdge()` paths and called `graph.updateNode()` directly, so the `nodeUpdate` / `edgeUpdate` events never fired for inline edits. Wrappers (React / Vue / Svelte) that rely on those events to sync controlled state did not learn about the change. Inline editors now route through the public mutation methods.

## [0.1.3] — 2026-06-10

### Added

- SDF (Signed Distance Field) text rendering for node labels — zoom-invariant sharp text at any zoom level using dead-reckoning EDT + `smoothstep(fwidth)` in GLSL fragment shader

### Changed

- `TextAtlas` PADDING 4→8 px; glyph-only entries now store distance field in alpha channel (RGB = text color), with bitmap fallback for environments lacking `getImageData`

### Fixed

- Test `NodeData` fixtures missing required `width` / `height` fields in all three wrapper test files

## [0.1.2] — 2026-06-09

### Added

- Vitest unit tests for `@flowgl/react`, `@flowgl/vue`, `@flowgl/svelte` — 9 tests each (27 total): constructor on mount, dispose on unmount, onInit callback, initial props, nodes/edges/readOnly prop sync, autoConnect behavior
- `vi.hoisted` MockChart pattern shared across all wrapper tests
- Force Layout worker integration in demo (`LayoutWorkerClient`)

### Changed

- Root `pnpm test` script runs all 4 packages; `test:wrappers` script added

## [0.1.1] — 2026-06-09

### Added

- `readOnly`, `snapGrid`, `autoFit`, `minimap` constructor options
- Events `nodeDoubleClick`, `nodeDragStart`, `edgeClick`, `edgeDoubleClick`, `edgeUpdate`, `nodeResize`, `nodeHover`, `edgeHover`
- Node mutations `deleteSelected()`, `duplicateSelected()`, `lockNode()`, `unlockNode()`, `setNodeShape()`, `setNodeStatus()`
- Edge mutations `updateEdge()`, `setEdgeStyle()`, `swapEdgeDirection()`
- Graph queries `getNode()`, `getEdge()`, `getEdgesForNode()`, `getEdgesBetween()`, `getIncomers()`, `getOutgoers()`, `getConnectedNodes()`, `hasCycle()`, `findPaths()`
- Viewport `zoomIn()`, `zoomOut()`, `zoomTo()`, `fitViewToSelection()`, `panTo()`, `getNodesBounds()`, `scrollToNode()`
- History `clearHistory()`, `batchUpdate(fn)`
- Group `collapseNode()`, `expandNode()`, `groupNodes()`, `ungroupNodes()`
- Alignment `alignNodes()`, `distributeNodes()`; Layout `circularLayout()`, `animateLayout()`
- Export `exportPNG()`, `exportSVG()`
- `NodeStyle.shape` variants (circle, diamond, hexagon); `NodeStatus` type; `NodeData` fields tooltip/locked/status/parentId/collapsed/ports/htmlContent; `EdgeData` fields animated/waypoints
- GitHub link and demo site URL in all package READMEs

### Fixed

- Group drag spurious dblclick; canvas event listener leak on dispose; GPU leak in CapProgram; undo inconsistency for setNodeStyle/setNodeSize/lockNode/collapseNode/groupNodes

### Changed

- `getEdgesForNode()`, `getIncomers()`, `getOutgoers()` use O(degree) index; test suite expanded from 127 to 832 tests

## [0.1.0] — 2026-06-03

### Added

- `@flowgl/core@0.1.0` — first public release on npm
- `@flowgl/react@0.1.0` — first public release on npm
- `@flowgl/vue@0.1.0` — first public release on npm
- `@flowgl/svelte@0.1.0` — first public release on npm
- GitHub repository `github.com/Deiamor/flowgl` made public

## [Unreleased]

### Added

- `FlowChartOptions`: `readOnly`, `snapGrid`, `autoFit`, `minimap`, `onBeforeConnect`, `onBeforeDelete`
- Events: `nodeDoubleClick`, `nodeDragStart`, `edgeClick`, `edgeDoubleClick`, `edgeUpdate`, `nodeResize`, `nodeHover`, `edgeHover`
- Node mutation: `deleteSelected()`, `duplicateSelected()`, `lockNode()`, `unlockNode()`, `setNodeShape()`, `setNodeStatus()` (error / warning / success / info / null — top-right badge)
- Edge mutation: `updateEdge()`, `setEdgeStyle()`, `swapEdgeDirection()`, `importJSON(data, mode)` (replace | merge)
- Graph query: `getNode()`, `getEdge()`, `getNodes()`, `getEdges()`, `getEdgesForNode()`, `getEdgesBetween()`, `getSelectedNodes()`, `getSelectedEdges()`, `getIncomers()`, `getOutgoers()`, `getConnectedNodes()`, `hasCycle()`, `findPaths()`
- Selection: `selectAll()`, `setSelectedEdgeIds()`, `getSelectedEdgeIds()`
- Viewport: `zoomIn()`, `zoomOut()`, `zoomTo()`, `fitViewToSelection()`, `panTo()`, `getNodesBounds()`, `scrollToNode()`
- Appearance: `setTheme('light' | 'dark')`, `setReadOnly()`, `setSnapGrid()`, `setMinimap()`, `setLabelEditable()`
- History: `clearHistory()`, `batchUpdate(fn)` (multiple mutations collapsed into a single undo entry)
- Group: `collapseNode()`, `expandNode()`, `toggleCollapse()`, `groupNodes()`, `ungroupNodes()`
- Alignment: `alignNodes(axis)`, `distributeNodes(axis)`
- Search: `searchNodes()`, `setHighlightedNodes()`, `clearHighlights()`
- Layout: `circularLayout()`, `animateLayout(targets, duration)`
- Export: `exportPNG(scale?)`, `exportSVG(padding?)`
- Runtime callbacks: `setOnBeforeDelete(fn | null)`
- `NodeData` fields: `tooltip`, `locked`, `status`, `type('group')`, `parentId`, `collapsed`, `ports`, `htmlContent`
- `EdgeData` fields: `animated`, `waypoints`
- `NodeStyle.shape`: `rectangle` | `circle` | `diamond` | `hexagon`
- `NodeStatus` type: `error` | `warning` | `success` | `info`

### Fixed

- `ungroupNodes()`: `updateNode` spread merge could not delete `parentId` — replaced with `replaceNode` pattern
- Canvas event listeners (`dblclick` / `contextmenu` / `mousedown` / `click`) leaked on `dispose()` — stored as class fields and properly removed in `dispose()`
- `ariaDesc` DOM element was not removed on `dispose()`
- GPU leak: `CapProgram.dispose()` was not implemented — added `deleteProgram` + `deleteVertexArray` + buffer disposal; called from `WebGL2Renderer.dispose()`
- Undo inconsistency: `beforeMutation()` was missing from `setNodeStyle`, `setNodeSize`, `lockNode`, `collapseNode`, `groupNodes`, `updateNode`, `updateEdge`, `setEdges`, and related public mutation APIs — added across all affected methods
- `undo()` / `redo()`: early-return on `this.failed` state prevented graph restore — removed; render path already guards against failed state

### Changed

- `getEdgesForNode()`, `getIncomers()`, `getOutgoers()`, `getConnectedNodes()`: replaced `getEdges().filter()` O(n) full scan with `Graph.getEdgesForNode()` O(degree) index lookup
- Render cache: per-frame `visNodes.filter(n => !n.htmlContent)` allocation replaced with `cachedTextNodes` field
- Render loop: per-frame `getEdges().some(e => e.animated)` replaced with `renderer.hasAnimatedEdges()` cache
- `undo()` / `redo()`: history restore now works regardless of `failed` state
- Test suite expanded from 127 to **220** tests across 11 files
