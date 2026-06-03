# @flowchart/core — API Reference

Zero-dependency WebGL2 flowchart library for the browser. No React, no D3, no external packages — just a single `FlowChart` class that renders GPU-accelerated nodes and edges onto a `<canvas>` element.

---

## Table of Contents

- [Installation](#installation)
- [Browser Support](#browser-support)
- [Quick Start](#quick-start)
- [Constructor](#constructor)
- [Public Properties](#public-properties)
- [Methods](#methods)
  - [Node Manipulation](#node-manipulation)
  - [Edge Manipulation](#edge-manipulation)
  - [Selection](#selection)
  - [Viewport](#viewport)
  - [Undo / Redo](#undo--redo)
  - [Serialization](#serialization)
  - [Node Style](#node-style)
  - [Canvas Appearance](#canvas-appearance)
  - [Group](#group)
  - [Alignment](#alignment)
  - [Search / Highlight](#search--highlight)
  - [Animation](#animation)
  - [Export](#export)
  - [Graph Query](#graph-query)
  - [Runtime Callbacks](#runtime-callbacks)
  - [Events](#events)
  - [Lifecycle](#lifecycle)
- [Event Reference](#event-reference)
- [Type Reference](#type-reference)
- [Layout Utilities](#layout-utilities)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Touch Gestures](#touch-gestures)
- [Examples](#examples)

---

## Installation

```bash
npm install @flowchart/core
# or
pnpm add @flowchart/core
# or
yarn add @flowchart/core
```

---

## Browser Support

WebGL2 is required. Supported in:

| Browser | Minimum version |
|---------|----------------|
| Chrome  | 56+            |
| Firefox | 51+            |
| Safari  | 15+            |
| Edge    | 79+            |

In SSR (Node.js / Deno / Bun) environments, no canvas is created and the `onError` callback is invoked with a descriptive error. The `FlowChart` instance remains in a no-op state — every method call is safe but does nothing. This makes it straightforward to instantiate the class in universal frameworks (Next.js, Nuxt, SvelteKit) without guard code.

---

## Quick Start

```ts
import { FlowChart } from '@flowchart/core'

const chart = new FlowChart({
  container: document.getElementById('app')!,
  nodes: [
    { id: 'start', x: 100, y: 150, width: 120, height: 60, label: 'Start' },
    { id: 'end',   x: 350, y: 150, width: 120, height: 60, label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'end', label: 'next' },
  ],
})

chart.on('nodeClick', ({ node }) => console.log('clicked', node.id))

// Clean up when done
chart.dispose()
```

---

## Constructor

```ts
new FlowChart(options: FlowChartOptions): FlowChart
```

Creates a new flowchart instance. A `<canvas>` element is created and appended inside `options.container`. The canvas fills the container's dimensions via `width: 100%; height: 100%`.

### FlowChartOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `container` | `HTMLElement` | **required** | Host element. The canvas is appended as a child of this element. |
| `nodes` | `NodeData[]` | `[]` | Initial set of nodes to render. |
| `edges` | `EdgeData[]` | `[]` | Initial set of edges to render. |
| `renderer` | `RendererOptions` | `{}` | WebGL2 renderer hints. See below. |
| `labelEditable` | `boolean` | `true` | When `true`, double-clicking a node activates an inline text editor for its label. |
| `readOnly` | `boolean` | `false` | When `true`, all editing interactions are disabled: drag, connect, resize, label edit, keyboard delete, and right-click mutation menu. |
| `background` | `string` | `'#f7f7f7'` | Canvas background color. Accepts any CSS color string. |
| `grid` | `Partial<GridConfig>` | — | Grid overlay configuration. Grid is hidden by default (`visible: false`). |
| `minimap` | `Partial<MinimapConfig>` | — | Minimap overlay configuration. Omit to disable. |
| `ariaLabel` | `string` | `'Flowchart'` | Value of the `aria-label` attribute on the canvas element. |
| `historyLimit` | `number` | `100` | Maximum number of undo history snapshots to keep. Older snapshots are evicted when the limit is reached. |
| `snapGrid` | `number` | `0` | Snap node drag to a grid of this size (world units). `0` disables snapping. |
| `autoFit` | `boolean` | `false` | When `true`, automatically fits the view to the initial nodes after construction. |
| `onBeforeConnect` | `(params: { sourceId: string; targetId: string; sourceHandle: string; targetHandle: string }) => boolean` | — | Return `false` to reject a connection before it is created. Called after the user finishes a connect-drag gesture. |
| `onBeforeDelete` | `(nodeIds: string[], edgeIds: string[]) => boolean` | — | Return `false` to cancel deletion of the selected nodes/edges. Called before any nodes or edges are removed. |
| `onError` | `(err: Error) => void` | `console.error` | Called when WebGL2 is unavailable (unsupported browser) or when the environment is non-browser (SSR). |

#### RendererOptions

```ts
interface RendererOptions {
  pixelRatio?: number   // Defaults to window.devicePixelRatio. Lower values improve performance on high-DPI screens.
  antialias?: boolean   // Passed to the WebGL2 context. Default: true.
}
```

---

## Public Properties

```ts
readonly graph: Graph
```

Provides direct read access to the underlying node and edge data store. Use this to inspect the current graph state without triggering re-renders.

```ts
readonly viewport: Viewport
```

Provides read access to the current viewport state (pan position, zoom level). The state is continuously updated as the user pans or zooms.

---

## Methods

### Node Manipulation

```ts
addNode(node: NodeData): void
```

Adds a single node to the graph and records the operation in the undo history. Fires the `nodeAdd` event.

---

```ts
removeNode(id: string): void
```

Removes the node with the given `id`. Any edges connected to that node are also removed. Records the operation in undo history. Fires `nodeRemove` (and `edgeRemove` for each removed edge).

---

```ts
updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void
```

Merges `updates` into the existing node. Only the provided fields are changed; all other fields remain intact. Records in undo history. Fires `nodeUpdate`.

---

```ts
setNodes(nodes: NodeData[]): void
```

Replaces the entire node collection in one operation. **Clears undo history.** Use this for bulk initial loads or when discarding history is intentional (e.g., loading a saved document). Fires `nodeAdd` for each new node.

---

```ts
deleteSelected(): void
```

Deletes all currently selected nodes (skipping locked ones) and edges. Respects the `onBeforeDelete` callback. Records in undo history.

---

```ts
duplicateSelected(): void
```

Duplicates the currently selected nodes and any edges between them. Duplicated nodes are offset by +24 world units on both axes. Records in undo history. Fires `selectionChange` with the new ids.

---

```ts
lockNode(id: string): void
```

Marks a node as locked. Locked nodes cannot be dragged, resized, or deleted.

---

```ts
unlockNode(id: string): void
```

Removes the lock flag from a node.

---

```ts
setNodeShape(id: string, shape: NodeShape): void
```

Changes the geometric shape of a node. Shorthand for `setNodeStyle(id, { shape })`.

---

```ts
setNodeStatus(id: string, status: NodeStatus | null): void
```

Sets or clears the status badge rendered at the node's top-right corner. Pass `null` to remove the badge.

---

### Edge Manipulation

```ts
addEdge(edge: EdgeData): void
```

Adds a single edge. Records in undo history. Fires `edgeAdd`.

---

```ts
removeEdge(id: string): void
```

Removes the edge with the given `id`. Records in undo history. Fires `edgeRemove`.

---

```ts
updateEdge(id: string, updates: Partial<Omit<EdgeData, 'id'>>): void
```

Merges `updates` into the existing edge. Records in undo history. Fires `edgeUpdate`.

---

```ts
setEdgeStyle(id: string, style: Partial<EdgeStyle>): void
```

Merges `style` into the edge's current style. Records in undo history.

---

```ts
setEdges(edges: EdgeData[]): void
```

Replaces the entire edge collection. Does **not** clear undo history (unlike `setNodes`).

---

```ts
swapEdgeDirection(id: string): void
```

Exchanges the `source` and `target` of an edge. Records in undo history. Fires `edgeUpdate`.

---

```ts
importJSON(
  data: { nodes: NodeData[]; edges: EdgeData[]; viewport?: ViewportState },
  mode?: 'replace' | 'merge'
): void
```

Imports nodes and edges. `'replace'` (default) clears the chart first (same as `fromJSON`). `'merge'` adds to the existing graph without clearing.

---

### Selection

```ts
getSelectedIds(): string[]
```

Returns the ids of currently selected nodes.

---

```ts
getSelectedEdgeIds(): string[]
```

Returns the ids of currently selected edges.

---

```ts
setSelectedIds(ids: string[]): void
```

Programmatically selects nodes by id. Deselects any previously selected nodes or edges not in the list. Fires `selectionChange`.

---

```ts
setSelectedEdgeIds(ids: string[]): void
```

Programmatically selects edges by id. Fires `selectionChange`.

---

```ts
selectAll(): void
```

Selects all nodes and edges. Fires `selectionChange`.

---

```ts
clearSelection(): void
```

Deselects all nodes and edges. Fires `selectionChange` with empty arrays.

---

```ts
getSelectedNodes(): NodeData[]
```

Returns full `NodeData` objects for every currently selected node.

---

```ts
getSelectedEdges(): EdgeData[]
```

Returns full `EdgeData` objects for every currently selected edge.

---

### Viewport

```ts
getViewport(): ViewportState
```

Returns the current viewport state `{ x, y, zoom }`. `x` and `y` are world-space pan offsets. `zoom` is in the range `0.1`–`4.0`.

---

```ts
setViewport(state: ViewportState): void
```

Instantly moves the viewport to the given state. Does not animate. Fires `viewportChange`.

---

```ts
fitView(padding?: number): void
```

Adjusts pan and zoom so that all nodes are visible within the canvas, with `padding` pixels of space around the bounding box. Defaults to `40`. If there are no nodes, this is a no-op. Fires `viewportChange`.

---

```ts
fitViewToSelection(padding?: number): void
```

Fits the viewport to the bounding box of the currently selected nodes. Falls back to `fitView` when nothing is selected. Defaults to `40`.

---

```ts
zoomIn(): void
zoomOut(): void
zoomTo(factor: number): void
```

Zoom the viewport in/out by one predefined step, or jump to an exact zoom factor. Fires `viewportChange`.

---

```ts
panTo(worldX: number, worldY: number): void
```

Centers the viewport on the given world coordinates. Fires `viewportChange`.

---

```ts
getNodesBounds(ids?: string[]): AABB | null
```

Returns the axis-aligned bounding box of the given nodes, or all nodes when no ids are provided. Returns `null` when there are no nodes.

---

```ts
scrollToNode(id: string, padding?: number): void
```

Pans and zooms the viewport so the given node is centered in the canvas. Defaults to `60` padding.

---

### Undo / Redo

```ts
canUndo(): boolean
canRedo(): boolean
```

Returns whether undo / redo is currently available. Use these to drive the enabled state of UI buttons.

---

```ts
undo(): boolean
```

Reverts the last recorded operation. Returns `true` if an operation was undone, `false` if history is empty. Fires `historyChange`.

---

```ts
redo(): boolean
```

Reapplies the last undone operation. Returns `true` on success. Fires `historyChange`.

---

```ts
clearHistory(): void
```

Clears the undo/redo history stack. Fires `historyChange`.

---

```ts
batchUpdate(fn: () => void): void
```

Runs `fn` as a single atomic operation. All mutations inside `fn` are grouped into one undo entry and one render frame.

---

### Serialization

```ts
toJSON(): {
  version: number
  nodes: NodeData[]
  edges: EdgeData[]
  viewport: ViewportState
}
```

Serializes the complete chart state to a plain object that is safe to pass to `JSON.stringify`. The `version` field can be used for future schema migrations.

---

```ts
fromJSON(data: {
  version?: number
  nodes: NodeData[]
  edges: EdgeData[]
  viewport?: ViewportState
}): void
```

Restores chart state from a previously serialized object. Replaces all existing nodes and edges, and optionally restores the viewport. Clears undo history.

---

### Node Style

```ts
setNodeStyle(id: string, style: Partial<NodeStyle>): void
```

Merges `style` into the node's current style. Only the provided fields are updated.

---

```ts
setNodeBorderColor(id: string, color: string): void
```

Convenience shorthand for `setNodeStyle(id, { borderColor: color })`.

---

```ts
setNodeBackgroundColor(id: string, color: string): void
```

Convenience shorthand for `setNodeStyle(id, { backgroundColor: color })`.

---

```ts
setNodeSize(id: string, width: number, height: number): void
```

Resizes the node. Connected edges are redrawn automatically.

---

### Canvas Appearance

```ts
setBackground(color: string): void
```

Changes the canvas background color. Accepts any CSS color string (hex, `rgb()`, `hsl()`, named colors).

---

```ts
setGrid(config: Partial<GridConfig>): void
```

Updates one or more grid settings. Only the provided fields are changed.

---

```ts
setTheme(theme: 'light' | 'dark'): void
```

Applies a built-in light or dark preset (background color + grid color).

---

```ts
setReadOnly(readOnly: boolean): void
```

Enables or disables read-only mode at runtime. When `true`, all editing interactions (drag, connect, resize, label edit, keyboard delete, context menu mutations) are disabled.

---

```ts
setSnapGrid(size: number): void
```

Changes the snap-grid size at runtime. `0` disables snapping.

---

```ts
setLabelEditable(enabled: boolean): void
```

Enables or disables the double-click inline label editor at runtime.

---

```ts
setMinimap(config: Partial<MinimapConfig> | null): void
```

Enables the minimap (or reconfigures it). Pass `null` to disable and remove the minimap panel.

---

### Group

```ts
collapseNode(id: string): void
expandNode(id: string): void
toggleCollapse(id: string): void
```

Collapse or expand a group node (type must be `'group'`). When collapsed, child nodes are hidden. Double-clicking a group node also calls `toggleCollapse`.

---

```ts
groupNodes(parentId: string, childIds: string[]): void
```

Assigns `parentId` to each node in `childIds`, making them children of the given group node. Records in undo history.

---

```ts
ungroupNodes(childIds: string[]): void
```

Removes the `parentId` from each node in `childIds`, detaching them from their group. Records in undo history.

---

### Alignment

```ts
alignNodes(axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void
```

Aligns the selected nodes (minimum 2) along the given axis. Records in undo history.

---

```ts
distributeNodes(axis: 'horizontal' | 'vertical'): void
```

Distributes the selected nodes (minimum 3) evenly along the given axis. Records in undo history.

---

### Search / Highlight

```ts
searchNodes(query: string): NodeData[]
```

Case-insensitive label search. Returns matching nodes and applies a yellow dashed highlight outline to them. Passing an empty string clears highlights.

---

```ts
setHighlightedNodes(ids: string[]): void
```

Applies the highlight outline to an explicit set of node ids.

---

```ts
clearHighlights(): void
```

Removes all highlight outlines.

---

### Animation

```ts
animateLayout(
  targets: { id: string; x: number; y: number }[] | Map<string, { x: number; y: number }>,
  duration?: number
): void
```

Smoothly animates nodes from their current positions to `targets` over `duration` milliseconds (default `400`). Accepts the same shape returned by the layout utilities. Uses a smoothstep easing curve.

---

### Export

```ts
exportPNG(scale?: number): string | null
```

Returns a PNG data URL of the current canvas. `scale` controls the output pixel ratio (defaults to `devicePixelRatio`). Returns `null` if the renderer failed to initialize.

---

```ts
exportSVG(padding?: number): string
```

Returns a self-contained SVG string of the current graph. `padding` controls the whitespace around the bounding box (default `40`). Returns an empty SVG when there are no nodes.

---

### Graph Query

```ts
getNode(id: string): NodeData | undefined
getEdge(id: string): EdgeData | undefined
getNodes(): NodeData[]
getEdges(): EdgeData[]
```

Direct read access to the graph data store.

---

```ts
getEdgesForNode(nodeId: string): EdgeData[]
```

Returns all edges that connect to or from the given node.

---

```ts
getEdgesBetween(sourceId: string, targetId: string): EdgeData[]
```

Returns all edges that connect `sourceId` and `targetId` in either direction.

---

```ts
getIncomers(nodeId: string): NodeData[]
getOutgoers(nodeId: string): NodeData[]
getConnectedNodes(nodeId: string): NodeData[]
```

Graph traversal helpers. `getConnectedNodes` returns all neighbors regardless of edge direction.

---

```ts
hasCycle(): boolean
```

Returns `true` if the current graph contains a directed cycle.

---

```ts
findPaths(sourceId: string, targetId: string): string[][]
```

Returns all directed paths from `sourceId` to `targetId` as arrays of node ids. Capped at 100 paths.

---

### Runtime Callbacks

```ts
setOnBeforeDelete(fn: ((nodeIds: string[], edgeIds: string[]) => boolean) | null): void
```

Replaces the `onBeforeDelete` callback set at construction time. Pass `null` to remove it.

---

### Events

```ts
on(event: string, handler: Function): void
off(event: string, handler: Function): void
```

Registers and removes event handlers. See [Event Reference](#event-reference) for the full list of events and their payload shapes.

The same handler reference must be passed to `off` to unregister it:

```ts
const handleClick = ({ node }) => console.log(node.id)
chart.on('nodeClick', handleClick)
// later
chart.off('nodeClick', handleClick)
```

---

### Lifecycle

```ts
dispose(): void
```

Tears down the chart completely:
- Releases the WebGL2 context and frees GPU memory
- Removes the canvas element from the DOM
- Removes all internal event listeners
- Clears undo history

After `dispose()`, the instance is inert. Do not call any methods on it. Create a new `FlowChart` instance if you need to render again.

---

## Event Reference

```ts
chart.on(event, handler)
chart.off(event, handler)
```

| Event | Payload | Fired when |
|-------|---------|-----------|
| `nodeClick` | `{ node: NodeData }` | User clicks a node |
| `nodeDoubleClick` | `{ node: NodeData }` | User double-clicks a node |
| `nodeDragStart` | `{ id: string }` | User begins dragging a node |
| `nodeDragEnd` | `{ id: string; x: number; y: number }` | User finishes dragging a node; `x`/`y` are the new world coordinates |
| `nodeResize` | `{ id: string; x: number; y: number; width: number; height: number }` | User resizes a node |
| `nodeHover` | `{ node: NodeData \| null }` | Pointer enters or leaves a node; `null` when leaving |
| `edgeClick` | `{ edge: EdgeData }` | User clicks an edge |
| `edgeDoubleClick` | `{ edge: EdgeData }` | User double-clicks an edge |
| `edgeUpdate` | `{ id: string; updates: Partial<Omit<EdgeData, 'id'>> }` | An edge's data is updated |
| `edgeHover` | `{ edge: EdgeData \| null }` | Pointer enters or leaves an edge; `null` when leaving |
| `paneClick` | `{ x: number; y: number }` | User clicks the empty canvas; `x`/`y` are world coordinates |
| `viewportChange` | `{ x: number; y: number; zoom: number }` | Pan or zoom changes (by user interaction or programmatic call) |
| `connect` | `{ sourceId: string; targetId: string; sourceHandle: HandleSide; targetHandle: HandleSide }` | User drags from a handle and releases on another node's handle |
| `selectionChange` | `{ selectedIds: string[]; edgeIds: string[] }` | Selected nodes or edges change |
| `nodeAdd` | `{ node: NodeData }` | A node is added |
| `nodeRemove` | `{ id: string }` | A node is removed |
| `nodeUpdate` | `{ id: string; updates: Partial<Omit<NodeData, 'id'>> }` | A node's data is updated |
| `edgeAdd` | `{ edge: EdgeData }` | An edge is added |
| `edgeRemove` | `{ id: string }` | An edge is removed |
| `historyChange` | `{ canUndo: boolean; canRedo: boolean }` | The undo / redo availability changes |

`HandleSide` is `'top' | 'right' | 'bottom' | 'left'`. Custom port ids are also valid handle values.

---

## Type Reference

### NodeShape

```ts
type NodeShape = 'rectangle' | 'circle' | 'diamond' | 'hexagon'
```

Set via `NodeStyle.shape` or the `setNodeShape(id, shape)` helper.

### NodeStatus

```ts
type NodeStatus = 'error' | 'warning' | 'success' | 'info'
```

Rendered as a color-coded badge at the node's top-right corner. Set via `setNodeStatus(id, status)`.

### NodeData

```ts
interface NodeData {
  id: string                        // Unique identifier
  x: number                         // World X position (top-left corner of the node)
  y: number                         // World Y position (top-left corner of the node)
  width: number                     // Node width in world units
  height: number                    // Node height in world units
  label: string                     // Display text; wraps to node width; supports RTL
  type?: 'group' | string           // 'group' enables collapse/expand; any other value is a user-defined tag
  parentId?: string                 // When set, this node is a child of the given group node
  collapsed?: boolean               // When true, the group node's children are hidden
  locked?: boolean                  // When true, the node cannot be dragged, resized, or deleted
  status?: NodeStatus               // Status badge rendered at top-right corner
  tooltip?: string                  // Text shown in a floating tooltip on hover
  ports?: PortDef[]                 // Custom named connection points
  style?: Partial<NodeStyle>        // Per-node visual overrides
  htmlContent?: string              // Raw HTML rendered inside an overlay div (suppresses WebGL label)
  data?: Record<string, unknown>    // Arbitrary user data, not rendered
}
```

### NodeStyle

All fields are optional when used in `Partial<NodeStyle>`. Unspecified fields fall back to the defaults below.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backgroundColor` | `string` | `'#ffffff'` | Node fill color |
| `borderColor` | `string` | `'#1a73e8'` | Node stroke color |
| `borderWidth` | `number` | `2` | Stroke width in world units |
| `borderRadius` | `number` | `8` | Corner radius in world units |
| `textColor` | `string` | `'#1a1a1a'` | Label text color |
| `fontSize` | `number` | `14` | Font size in world units |
| `fontFamily` | `string` | `'system-ui, sans-serif'` | CSS font-family stack |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'center'` | Horizontal text alignment |
| `lineHeight` | `number` | `1.4` | Line height multiplier (unitless) |
| `shape` | `NodeShape` | `'rectangle'` | Node geometry |

### PortDef

```ts
interface PortDef {
  id: string
  side: 'left' | 'right' | 'top' | 'bottom'
  offset?: number          // 0–1 position along the side. Default: 0.5
  label?: string
  maxConnections?: number  // Maximum edges on this port. Unlimited when absent.
}
```

### EdgeData

```ts
interface EdgeData {
  id: string                                            // Unique identifier
  source: string                                        // Source node id
  target: string                                        // Target node id
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left'  // Default: 'right'
  targetHandle?: 'top' | 'right' | 'bottom' | 'left'  // Default: 'left'
  type?: 'bezier' | 'straight' | 'step'               // Edge path style; default: 'bezier'
  label?: string                                        // Text rendered at the bezier midpoint
  style?: Partial<EdgeStyle>                            // Visual overrides
  animated?: boolean                                    // When true, renders as marching-ants animated dashes
  waypoints?: { x: number; y: number }[]               // Intermediate world-space control points; overrides auto bezier routing
  data?: Record<string, unknown>                        // Arbitrary user data
}
```

### EdgeStyle

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `color` | `string` | `'#555555'` | Line color |
| `width` | `number` | `2` | Line width in world units |
| `dashArray` | `[number, number]` | — | Dash pattern `[dashLength, gapLength]`, e.g. `[8, 4]` for dashed lines |

### GridConfig

```ts
interface GridConfig {
  visible: boolean          // Default: false
  size: number              // Grid cell size in world-space units. Default: 20
  type: 'dots' | 'lines'  // Visual style. Default: 'dots'
  color: string             // Default: 'rgba(0,0,0,0.15)'
}
```

### MinimapConfig

```ts
interface MinimapConfig {
  width: number              // Minimap panel width in px. Default: 200
  height: number             // Minimap panel height in px. Default: 150
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'  // Default: 'bottom-right'
  background: string         // Panel background. Default: 'rgba(255,255,255,0.92)'
  nodeColor: string          // Fallback node fill. Default: '#94a3b8'
}
```

### ViewportState

```ts
interface ViewportState {
  x: number     // Pan offset X in world coordinates
  y: number     // Pan offset Y in world coordinates
  zoom: number  // Zoom level. Range: 0.1 (10%) to 4.0 (400%)
}
```

### AABB

```ts
interface AABB {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
```

---

## Layout Utilities

Four standalone layout functions are exported from `@flowchart/core`. They are pure functions — they receive node and edge data and return computed positions without mutating anything or touching the chart instance.

```ts
import {
  hierarchicalLayout,
  forceLayout,
  gridLayout,
  circularLayout,
} from '@flowchart/core'
```

All four share a common return type:

```ts
interface LayoutResult {
  nodes: Array<{ id: string; x: number; y: number }>
}
```

| Function | Signature | Best for |
|----------|-----------|---------|
| `hierarchicalLayout` | `(nodes, edges) => LayoutResult` | Trees, pipelines, dependency graphs |
| `forceLayout` | `(nodes, edges) => LayoutResult` | Organic, exploratory graphs without a clear hierarchy |
| `gridLayout` | `(nodes, edges) => LayoutResult` | Fast placement when spatial relationships do not matter |
| `circularLayout` | `(nodes, radius?) => LayoutResult` | Ring layouts; `radius` defaults to a value derived from node count |

Apply a layout result to a chart:

```ts
const { nodes: positioned } = hierarchicalLayout(
  chart.graph.getNodes(),
  chart.graph.getEdges()
)

chart.setNodes(
  chart.graph.getNodes().map(node => {
    const pos = positioned.find(p => p.id === node.id)
    return pos ? { ...node, ...pos } : node
  })
)

chart.fitView()
```

Or animate the transition:

```ts
const { nodes: positioned } = hierarchicalLayout(
  chart.graph.getNodes(),
  chart.graph.getEdges()
)
chart.animateLayout(positioned, 400)
```

---

## Keyboard Shortcuts

The canvas element must be focused for keyboard shortcuts to work. Click the canvas or Tab to it.

| Key | Action |
|-----|--------|
| `Tab` | Select the next node (cycles through all nodes) |
| `Shift+Tab` | Select the previous node |
| `Arrow keys` | Move selected nodes 10 world units in the pressed direction. Rapid consecutive presses are coalesced into a single undo entry. |
| `Delete` / `Backspace` | Delete selected nodes and edges |
| `Escape` | Cancel an in-progress connection drag, or clear the current selection |
| `Ctrl+A` / `⌘A` | Select all nodes and edges |
| `Ctrl+Z` / `⌘Z` | Undo |
| `Ctrl+Shift+Z` / `⌘⇧Z` | Redo |
| `Ctrl+Y` / `⌘Y` | Redo |
| `Ctrl+C` / `⌘C` | Copy selected nodes |
| `Ctrl+X` / `⌘X` | Cut selected nodes |
| `Ctrl+V` / `⌘V` | Paste |
| `Ctrl+D` / `⌘D` | Duplicate selected nodes |
| `F` | Fit all nodes into view |
| `Shift+F` | Fit selected nodes into view |

---

## Touch Gestures

| Gesture | Action |
|---------|--------|
| 1-finger drag on a node | Move the node |
| 1-finger drag on a handle circle (node edge midpoints) | Draw a new edge |
| 1-finger drag on the empty canvas | Pan the viewport |
| 2-finger pinch | Zoom in or out |

---

## Examples

### 1. Basic Initialization

```ts
import { FlowChart } from '@flowchart/core'

const chart = new FlowChart({
  container: document.getElementById('flowchart-container')!,
  background: '#ffffff',
  grid: { visible: true, type: 'dots', size: 20 },
  historyLimit: 50,
  onError: (err) => {
    console.error('FlowChart could not initialize:', err.message)
    // Show a fallback UI
  },
})
```

---

### 2. Adding Nodes / Edges and Subscribing to Events

```ts
import { FlowChart } from '@flowchart/core'

const chart = new FlowChart({
  container: document.getElementById('app')!,
})

// Add nodes
chart.addNode({ id: 'n1', x: 50,  y: 100, width: 140, height: 60, label: 'Fetch data' })
chart.addNode({ id: 'n2', x: 250, y: 100, width: 140, height: 60, label: 'Process' })
chart.addNode({ id: 'n3', x: 450, y: 100, width: 140, height: 60, label: 'Store result' })

// Add edges
chart.addEdge({ id: 'e1', source: 'n1', target: 'n2' })
chart.addEdge({ id: 'e2', source: 'n2', target: 'n3', label: 'on success', type: 'step' })

// Subscribe to events
chart.on('nodeClick', ({ node }) => {
  console.log('Node clicked:', node.id, node.label)
})

chart.on('connect', ({ sourceId, targetId, sourceHandle, targetHandle }) => {
  const newEdge = {
    id: `edge-${Date.now()}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
  }
  chart.addEdge(newEdge)
})

chart.on('selectionChange', ({ selectedIds, edgeIds }) => {
  console.log('Selected nodes:', selectedIds)
  console.log('Selected edges:', edgeIds)
})
```

---

### 3. Serialization (Save / Load)

```ts
// Save to localStorage
function saveChart(chart: FlowChart): void {
  const state = chart.toJSON()
  localStorage.setItem('my-flowchart', JSON.stringify(state))
}

// Load from localStorage
function loadChart(chart: FlowChart): void {
  const raw = localStorage.getItem('my-flowchart')
  if (!raw) return
  chart.fromJSON(JSON.parse(raw))
}

// Usage
saveButton.addEventListener('click', () => saveChart(chart))
loadButton.addEventListener('click', () => loadChart(chart))
```

`toJSON` captures nodes, edges, and the current viewport. `fromJSON` restores all three and clears undo history, so the loaded state is treated as a fresh starting point.

---

### 4. Undo / Redo Buttons

```ts
const undoButton = document.getElementById('undo') as HTMLButtonElement
const redoButton = document.getElementById('redo') as HTMLButtonElement

function syncButtons(): void {
  undoButton.disabled = !chart.canUndo()
  redoButton.disabled = !chart.canRedo()
}

chart.on('historyChange', syncButtons)
syncButtons() // set initial state

undoButton.addEventListener('click', () => {
  chart.undo()
})

redoButton.addEventListener('click', () => {
  chart.redo()
})
```

---

### 5. Changing Node Style

```ts
// Apply a full style override to one node
chart.setNodeStyle('n1', {
  backgroundColor: '#fff3e0',
  borderColor: '#f57c00',
  borderWidth: 3,
  textColor: '#e65100',
  fontFamily: 'Georgia, serif',
})

// Convenience helpers for common properties
chart.setNodeBorderColor('n2', '#d32f2f')
chart.setNodeBackgroundColor('n2', '#ffebee')
chart.setNodeSize('n3', 180, 80)

// Highlight multiple nodes based on application state
function highlightErrors(errorIds: string[]): void {
  for (const id of errorIds) {
    chart.setNodeStyle(id, { borderColor: '#d32f2f', backgroundColor: '#ffebee' })
  }
}
```

---

### 6. fitView and setViewport

```ts
// Fit all nodes into view with 60px padding
chart.fitView(60)

// Jump to a specific viewport state
chart.setViewport({ x: 0, y: 0, zoom: 1.0 })

// Read the current viewport and log it
chart.on('viewportChange', ({ x, y, zoom }) => {
  console.log(`Pan: (${x.toFixed(0)}, ${y.toFixed(0)})  Zoom: ${(zoom * 100).toFixed(0)}%`)
})

// After programmatically adding many nodes, fit them all into view
function bulkImport(nodes: NodeData[], edges: EdgeData[]): void {
  chart.setNodes(nodes)
  chart.setEdges(edges)
  chart.fitView(40)
}
```

---

### 7. Automatic Layout

```ts
import { FlowChart, hierarchicalLayout, forceLayout, gridLayout, circularLayout } from '@flowchart/core'

const chart = new FlowChart({ container: document.getElementById('app')! })

// Load data
chart.setNodes([
  { id: 'a', x: 0, y: 0, width: 120, height: 60, label: 'A' },
  { id: 'b', x: 0, y: 0, width: 120, height: 60, label: 'B' },
  { id: 'c', x: 0, y: 0, width: 120, height: 60, label: 'C' },
  { id: 'd', x: 0, y: 0, width: 120, height: 60, label: 'D' },
])
chart.setEdges([
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'a', target: 'c' },
  { id: 'e3', source: 'b', target: 'd' },
  { id: 'e4', source: 'c', target: 'd' },
])

function applyLayout(algorithm: 'hierarchical' | 'force' | 'grid' | 'circular'): void {
  const currentNodes = chart.graph.getNodes()
  const currentEdges = chart.graph.getEdges()

  let result
  if (algorithm === 'circular') {
    result = circularLayout(currentNodes)
  } else {
    const layoutFn =
      algorithm === 'hierarchical' ? hierarchicalLayout :
      algorithm === 'force'        ? forceLayout :
                                     gridLayout
    result = layoutFn(currentNodes, currentEdges)
  }

  chart.animateLayout(result.nodes, 400)
  chart.fitView()
}

document.getElementById('layout-btn')!
  .addEventListener('click', () => applyLayout('hierarchical'))
```

---

### 8. Cleanup (dispose)

Always call `dispose()` when the chart is no longer needed — for example, when a component unmounts in a framework, or when the page section is hidden.

```ts
// Vanilla JS: cleanup on page unload
window.addEventListener('beforeunload', () => chart.dispose())

// React (useEffect)
useEffect(() => {
  const chart = new FlowChart({ container: containerRef.current! })
  return () => chart.dispose()
}, [])

// Vue 3 (onUnmounted)
import { onMounted, onUnmounted, ref } from 'vue'
import { FlowChart } from '@flowchart/core'

const container = ref<HTMLElement>()
let chart: FlowChart | null = null

onMounted(() => {
  chart = new FlowChart({ container: container.value! })
})

onUnmounted(() => {
  chart?.dispose()
  chart = null
})

// Svelte (onDestroy)
import { onDestroy } from 'svelte'
import { FlowChart } from '@flowchart/core'

let chart: FlowChart

function init(node: HTMLElement): void {
  chart = new FlowChart({ container: node })
}

onDestroy(() => chart?.dispose())
```
