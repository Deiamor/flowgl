# Changelog

All notable changes to this project will be documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
