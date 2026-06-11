# Changelog

All notable changes to this project will be documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
