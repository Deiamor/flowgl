# FlowChart API reference

This page lists the public surface of `@flowgl/core`. The same surface is
exposed through the framework wrappers — methods become wrapper-component
ref handles, events become callback props (React) / emits (Vue) /
`on:` directives (Svelte).

Wrapper-specific shapes:

- [`@flowgl/react`](https://www.npmjs.com/package/@flowgl/react)
- [`@flowgl/vue`](https://www.npmjs.com/package/@flowgl/vue)
- [`@flowgl/svelte`](https://www.npmjs.com/package/@flowgl/svelte)

## Constructor

```ts
new FlowChart(options: FlowChartOptions)
```

### `FlowChartOptions`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `container` | `HTMLElement` | — | **Required.** The chart canvas + overlays mount inside this element. |
| `nodes` | `NodeData[]` | `[]` | Initial nodes. |
| `edges` | `EdgeData[]` | `[]` | Initial edges. |
| `rendererKind` | `'webgl2' \| 'canvas2d' \| Renderer` | `'webgl2'` | Which renderer to use. See [Renderers](/guide/renderers). |
| `labelEditable` | `boolean` | `true` | Allow double-click to open the inline label editor. |
| `groupDoubleClickCollapses` | `boolean` | `false` | Opt-in: double-clicking a `type: 'group'` node toggles collapse. |
| `readOnly` | `boolean` | `false` | Disable every editing interaction. |
| `background` | `string` | `'#f7f7f7'` | Canvas background color. |
| `grid` | `Partial<GridConfig>` | dots, 20px | Grid overlay config. |
| `minimap` | `Partial<MinimapConfig>` | — | Minimap overlay config. Omit to disable. |
| `ariaLabel` | `string` | `'Flowchart'` | Screen-reader label for the canvas. |
| `historyLimit` | `number` | `100` | Max undo history entries. |
| `snapGrid` | `number` | `0` | Snap node drag to a grid of this size (world units). 0 disables. |
| `autoFit` | `boolean` | `false` | Fit view to initial nodes after construct. |
| `onError` | `(err: Error) => void` | — | Called when the renderer cannot initialize. |
| `onContextLost` | `() => void` | — | WebGL context lost (GPU reset, mobile tab backgrounded). |
| `onContextRestored` | `() => void` | — | WebGL context restored after a loss event. |
| `onBeforeConnect` | `(params) => boolean` | — | Return `false` to reject a connection before it is created. |
| `onBeforeDelete` | `(nodeIds, edgeIds) => boolean` | — | Return `false` to cancel deletion. |
| `sanitizeHtml` | `(html: string) => string` | — | Sanitize `NodeData.htmlContent` before `innerHTML`. Required for untrusted input. |

## Node & edge mutation

| Method | Description |
| --- | --- |
| `addNode(node)` / `removeNode(id)` / `updateNode(id, updates)` | Single-node operations. Each is one history entry. |
| `addEdge(edge)` / `removeEdge(id)` / `updateEdge(id, updates)` | Single-edge operations. |
| `setNodes(nodes)` / `setEdges(edges)` | Batch replace. One history entry. |
| `getNode(id)` / `getEdge(id)` | Lookup by id. |
| `getNodes()` / `getEdges()` | Returns a snapshot array (not live). |
| `batchUpdate(fn)` | Run `fn` with batching: one history entry, one render flush at the end. Use for layout, import, bulk edits. |

## Selection

| Method | Description |
| --- | --- |
| `getSelectedIds()` / `getSelectedEdgeIds()` | Currently selected ids. |
| `setSelectedIds(ids)` | Replace selection. |
| `clearSelection()` | Self-explanatory. |

## Viewport

| Method | Description |
| --- | --- |
| `fitView(opts?)` | Frame all nodes with padding. |
| `fitViewToSelection(opts?)` | Frame the current selection. |
| `panTo(worldX, worldY)` | Move the canvas center to a world coordinate. |
| `zoomIn()` / `zoomOut()` / `zoomTo(level)` | Discrete zoom (steps: 0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4). |
| `scrollToNode(id, padding?)` | Pan so the node is visible. |
| `getNodesBounds(ids?)` | AABB of given nodes (or all nodes). |

## History (undo / redo)

| Method | Description |
| --- | --- |
| `undo()` / `redo()` | Self-explanatory. Emit `historyChange`. |
| `canUndo()` / `canRedo()` | Booleans. |
| `clearHistory()` | Wipe the undo stack. Emits `historyChange`. |

## Groups & layout

| Method | Description |
| --- | --- |
| `groupNodes(parentId, childIds)` | Assign `parentId` to each child. |
| `ungroupNodes(childIds)` | Strip `parentId` from each child. Group container survives. |
| `dissolveGroup(groupId)` | Remove the group container + detach all its children. Single undo entry. Use this when the group node itself should disappear. |
| `collapseNode(id)` / `expandNode(id)` / `toggleCollapse(id)` | Group-only. No-op on non-group nodes. |
| `alignNodes(axis)` / `distributeNodes(axis)` | Selection-based alignment. |
| `animateLayout(targets, duration)` | Smoothstep RAF interpolation to a target layout. |

## Styling

| Method | Description |
| --- | --- |
| `setNodeShape(id, shape)` | `'rectangle' \| 'circle' \| 'diamond' \| 'hexagon'`. |
| `setEdgeStyle(id, style)` | Merge a partial style onto an edge. |
| `setNodeStatus(id, status \| null)` | `'error' \| 'warning' \| 'success' \| 'info' \| null`. |
| `setTheme('light' \| 'dark')` | Preset background + grid color. |
| `setBackground(color)` | Override background color. |

## Search & highlight

| Method | Description |
| --- | --- |
| `searchNodes(query)` | Case-insensitive label search. Updates `highlightedNodeIds`. |
| `setHighlightedNodes(ids)` / `clearHighlights()` | Direct control. |

## Graph analysis

| Method | Description |
| --- | --- |
| `getIncomers(id)` / `getOutgoers(id)` / `getConnectedNodes(id)` | Adjacency via O(degree) `nodeEdgeIndex`. |
| `getEdgesForNode(id)` | O(1) lookup. |
| `getEdgesBetween(sourceId, targetId)` | Both directions. |
| `hasCycle()` | DFS 3-color. |
| `findPaths(sourceId, targetId)` | DFS. Capped at 100 paths. |

## Import / export

| Method | Description |
| --- | --- |
| `toJSON()` / `fromJSON(data)` | Serialization roundtrip. `fromJSON` validates the schema. |
| `importJSON(data, mode='replace' \| 'merge')` | Schema-validated import. Use `mode: 'merge'` to add to the existing graph. |
| `exportPNG(scale?)` | Returns a data URL. |
| `exportSVG(padding?)` | Returns an SVG string. |

## Lifecycle

| Method | Description |
| --- | --- |
| `dispose()` | Tear down the WebGL context, remove overlays, detach every event listener. **Always call this when the container is removed.** |

## Events

```ts
chart.on(eventName, handler)
chart.off(eventName, handler)
```

| Event | Payload |
| --- | --- |
| `nodeClick` | `{ node: NodeData }` |
| `nodeDoubleClick` | `{ node: NodeData }` |
| `nodeDragStart` | `{ id: string }` |
| `nodeDragEnd` | `{ id, x, y }` |
| `nodeHover` | `{ node: NodeData \| null }` |
| `nodeAdd` / `nodeRemove` / `nodeUpdate` | mutation events |
| `nodeResize` | `{ id, x, y, width, height }` |
| `edgeClick` / `edgeDoubleClick` / `edgeHover` | edge events |
| `edgeAdd` / `edgeRemove` / `edgeUpdate` | mutation events |
| `connect` | `{ sourceId, targetId, sourceHandle, targetHandle }` |
| `paneClick` | `{ x, y }` |
| `selectionChange` | `{ selectedIds, edgeIds }` |
| `viewportChange` | viewport state |
| `historyChange` | `{ canUndo, canRedo }` |

## Types

```ts
interface NodeData {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  type?: 'group'
  parentId?: string
  collapsed?: boolean
  locked?: boolean
  tooltip?: string
  ariaLabel?: string
  htmlContent?: string
  ports?: Port[]
  style?: NodeStyle
  status?: NodeStatus
}

interface EdgeData {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  animated?: boolean
  waypoints?: Array<{ x: number, y: number }>
  style?: EdgeStyle
}
```

Full type signatures are emitted to `dist/index.d.ts` — your editor will
autocomplete the rest. If you find a public method without an entry on
this page, please open an issue or a PR.

---

## 0.5.0 → 0.9.1 surface

Every API added between 0.5.0 and 0.9.1 — the cycles that closed the
React-Flow-parity track, opened the reactive-data layer, hardened
production, and shipped the first plugin contract.

### Overlays (0.5.0 + 0.6.0 + 0.7.0)

DOM overlays mount inside the chart container. Each layer is
constant pixel size under zoom **except `ViewportPortal`**, which
scales with the viewport.

```ts
// Panel — 9-position floating widget
chart.addPanel({ position: 'top-right', content: '<button>…</button>' }): string
chart.updatePanel(id, partial): boolean
chart.removePanel(id): boolean
chart.listPanels(): string[]

// Controls — zoom/fit/lock built-ins + custom buttons
chart.showControls({ position: 'bottom-left', showFitView: true }): void
chart.hideControls(): void
chart.hasControls(): boolean

// NodeToolbar — anchored to a node, visible iff selection matches
chart.addNodeToolbar({ nodeId: 'a', content: '🗑', position: 'top', align: 'center' }): string
chart.updateNodeToolbar(id, partial): boolean
chart.removeNodeToolbar(id): boolean
chart.listNodeToolbars(): string[]

// EdgeToolbar — edge-anchored variant of NodeToolbar
chart.addEdgeToolbar({ edgeId: 'e1', content: '🗑', align: 'above' }): string
chart.updateEdgeToolbar(id, partial): boolean
chart.removeEdgeToolbar(id): boolean
chart.listEdgeToolbars(): string[]

// ViewportPortal — world-coord DOM, scales with zoom
chart.addViewportPortal({ x: 80, y: 380, width: 200, height: 60, content: '<div>…</div>' }): string
chart.updateViewportPortal(id, partial): boolean
chart.removeViewportPortal(id): boolean
chart.listViewportPortals(): string[]

// EdgeLabel — HTML edge label at the rendered-path midpoint
chart.addEdgeLabel({ edgeId: 'e1', content: '<span>↗ flow</span>' }): string
chart.updateEdgeLabel(id, partial): boolean
chart.removeEdgeLabel(id): boolean
chart.listEdgeLabels(): string[]

// PerfOverlay — FPS / frame time / draw call / atlas miss stats (differentiator)
chart.showPerfOverlay({ position: 'top-right' }): void
chart.hidePerfOverlay(): void
```

### Edge variants (0.7.0)

`'smoothstep'` joins `'bezier'` / `'straight'` / `'step'`. Same sampled
polyline on Canvas2D + WebGL2 (T5 parity).

```ts
chart.addEdge({
  id: 'e1', source: 'a', target: 'b',
  type: 'smoothstep',
  pathOptions: { borderRadius: 16, arcSegments: 10 },
})
```

### Node-level affordances (0.6.0 + 0.8.0)

```ts
// extent — clamp child to its parent's bbox (or an explicit rect) on drag-end
chart.addNode({ id: 'c', parentId: 'g', extent: 'parent', /* … */ })
chart.addNode({ id: 'c', extent: { minX: 0, minY: 0, maxX: 800, maxY: 600 } })

// expandParent — drag the child out, parent grows to contain it
chart.addNode({ id: 'c', parentId: 'g', expandParent: true })

// easyConnect — inflated handle hit radius, connect from anywhere near the edge
chart.addNode({ id: 'a', easyConnect: true })

// NodeResize options — min/max bounds, aspect ratio, predicate, callbacks
chart.setNodeResizeOptions({
  minWidth: 50, minHeight: 40,
  maxWidth: 800, maxHeight: 600,
  keepAspectRatio: false,
  shouldResize: (node, next) => true,
  onResizeStart: (id) => {},
  onResize: (id, x, y, w, h) => {},
  onResizeEnd: (id, x, y, w, h) => {},
})
chart.getNodeResizeOptions(): NodeResizeOptions
```

### Drag UX layers (0.8.0)

```ts
// Helper Lines — Figma-style alignment guides + snap during drag
chart.setHelperLinesOptions({ enabled: true, snap: 5, show: 10 })
chart.getHelperLinesOptions(): HelperLinesOptions

// Proximity Connect — drag near another node → ghost line → drop creates edge
chart.setProximityConnectOptions({ enabled: true, threshold: 80 })
chart.getProximityConnectOptions(): ProximityConnectOptions
```

### Computing Flows — reactive per-node data (0.8.0)

`updateNodeData` merges into `node.data` and fans out to subscribers.
Explicit cycle detection — when a subscriber writes back to a node
already on the active update stack, propagation stops and a
`nodeDataCycle` event fires. **Differentiator vs React Flow's
equivalent, which stack-overflows on cycles.**

```ts
chart.updateNodeData(id: string, partial: Record<string, unknown>): boolean
chart.subscribeNodeData(id, (data, partial) => { /* … */ }): () => void
chart.getNodeDataSubscriberCount(id: string): number

// Events
chart.on('nodeDataChange', ({ id, data, partial }) => {})
chart.on('nodeDataCycle',  ({ id, chain }) => {})
```

### Custom node-type registry (0.9.0) — plugin contract

Built-in shapes (`rectangle`, `circle`, `diamond`, `hexagon`) keep the
WebGL2 SDF fast path. Plugins ship `category: 'html'` types that mount
DOM overlays scaled with the viewport.

```ts
chart.registerNodeType('uml-class', {
  category: 'html',
  defaultSize: { width: 200, height: 120 },
  render: (container, node, ctx) => {
    container.innerHTML = `<div class="uml-card">${node.label}</div>`
  },
  destroy: (container, node) => { /* optional teardown */ },
})

chart.addNode({ id: 'order', type: 'uml-class', label: 'Order', x: 0, y: 0, width: 200, height: 120 })

chart.unregisterNodeType(name: string): boolean
chart.getRegisteredNodeTypes(): string[]
chart.getCustomNodeTypes(): string[]
```

External plugins publish as `@my-org/flowgl-node-*`. See the
[Custom node-type plugins cookbook recipe](/cookbook/custom-node-type)
for a complete walkthrough.

### Theme (0.5.0)

```ts
chart.setTheme('light' | 'dark' | 'system'): void   // 'system' tracks prefers-color-scheme live
```

### React hooks (0.6.0) — `@flowgl/react`

```tsx
import { FlowchartProvider, useFlowChart, useNodes, useEdges, useViewport, useSelection } from '@flowgl/react'

<FlowchartProvider value={chartRef.current}>
  <NodeList />     {/* useNodes() inside */}
</FlowchartProvider>
```

Subscribed to chart events via plain `useState` + `useEffect` — no new
runtime dependency (Tenet T2 preserved).

### Edge geometry helper (0.8.1) — also exported for plugin authors

```ts
import { edgePathPoints, edgeMidpoint, edgeBoundingBox, edgePathFingerprint } from '@flowgl/core'
```

### Layout helpers (0.9.1)

```ts
import {
  hierarchicalLayout, forceLayout, gridLayout, circularLayout,
  addChildTranslations,
} from '@flowgl/core'
```

Every layout calls `addChildTranslations` before returning, so a layout
that moves a group also relocates its descendants by the same delta.
External layout plugins should do the same.

---

## Type reference

Every public type exported from `@flowgl/core`. Importable directly:

```ts
import type {
  // Core data
  NodeData, NodeStyle, NodeShape, NodeStatus, PortDef,
  EdgeData, EdgeStyle, EdgeType, EdgePathOptions,
  ViewportState, GridConfig, MinimapConfig, HandleSide,

  // Chart events
  FlowChartEvents,

  // NodeResize tuning
  NodeResizeOptions, NodeResizeRect,

  // Renderer plumbing — implement these to swap the renderer
  RendererOptions, RenderFrame,

  // Context menu API
  MenuItem, MenuEntry, MenuSeparator,

  // 0.5.0 — overlay options
  PanelPosition, PanelOptions,
  ControlsOptions, ControlButtonOptions,
  NodeToolbarSpec, NodeToolbarPosition, NodeToolbarAlign,
  PerfOverlayOptions,

  // 0.6.0
  ViewportPortalSpec,
  EdgeLabelSpec,

  // 0.7.0
  EdgeToolbarSpec, EdgeToolbarAlign,

  // 0.8.0
  HelperLinesOptions,
  ProximityConnectOptions,

  // 0.9.0 — node-type registry
  NodeTypeDefinition, NodeTypeCategory,
  HtmlNodeRenderFn, NodeHitTestFn,

  // Layouts
  LayoutResult, LayoutAlgorithm,
} from '@flowgl/core'
```

Defaults exposed as constants:

```ts
import {
  DEFAULT_NODE_STYLE, DEFAULT_EDGE_STYLE,
  DEFAULT_GRID_CONFIG, DEFAULT_MINIMAP_CONFIG,
  MIN_ZOOM, MAX_ZOOM,
} from '@flowgl/core'
```

## Stability tiers

Every symbol on this page is **stable** unless the docstring or
[`SEMVER.md`](https://github.com/Deiamor/flowgl/blob/master/SEMVER.md)
calls it out as `@provisional`. Stable APIs go through a deprecation
cycle of at least two minor releases before removal.
