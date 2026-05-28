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
| `background` | `string` | `'#f7f7f7'` | Canvas background color. Accepts any CSS color string. |
| `grid` | `Partial<GridConfig>` | — | Grid overlay configuration. Grid is hidden by default (`visible: false`). |
| `ariaLabel` | `string` | `'Flowchart'` | Value of the `aria-label` attribute on the canvas element. |
| `historyLimit` | `number` | `100` | Maximum number of undo history snapshots to keep. Older snapshots are evicted when the limit is reached. |
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
setEdges(edges: EdgeData[]): void
```

Replaces the entire edge collection. Does **not** clear undo history (unlike `setNodes`).

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
clearSelection(): void
```

Deselects all nodes and edges. Fires `selectionChange` with empty arrays.

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
setLabelEditable(enabled: boolean): void
```

Enables or disables the double-click inline label editor at runtime.

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
| `nodeDragEnd` | `{ id: string; x: number; y: number }` | User finishes dragging a node; `x`/`y` are the new world coordinates |
| `paneClick` | `{ x: number; y: number }` | User clicks the empty canvas; `x`/`y` are world coordinates |
| `viewportChange` | `{ x: number; y: number; zoom: number }` | Pan or zoom changes (by user interaction or programmatic call) |
| `connect` | `{ sourceId: string; targetId: string; sourceHandle: Handle; targetHandle: Handle }` | User drags from a handle and releases on another node's handle |
| `selectionChange` | `{ selectedIds: string[]; edgeIds: string[] }` | Selected nodes or edges change |
| `nodeAdd` | `{ node: NodeData }` | A node is added |
| `nodeRemove` | `{ id: string }` | A node is removed |
| `nodeUpdate` | `{ id: string; updates: Partial<Omit<NodeData, 'id'>> }` | A node's data is updated |
| `edgeAdd` | `{ edge: EdgeData }` | An edge is added |
| `edgeRemove` | `{ id: string }` | An edge is removed |
| `historyChange` | `{ canUndo: boolean; canRedo: boolean }` | The undo / redo availability changes |

`Handle` is `'top' | 'right' | 'bottom' | 'left'`.

---

## Type Reference

### NodeData

```ts
interface NodeData {
  id: string                        // Unique identifier
  x: number                         // World X position (top-left corner of the node)
  y: number                         // World Y position (top-left corner of the node)
  width: number                     // Node width in world units
  height: number                    // Node height in world units
  label: string                     // Display text; wraps to node width; supports RTL
  type?: string                     // User-defined type tag (not interpreted by the library)
  style?: Partial<NodeStyle>        // Per-node visual overrides
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

### ViewportState

```ts
interface ViewportState {
  x: number     // Pan offset X in world coordinates
  y: number     // Pan offset Y in world coordinates
  zoom: number  // Zoom level. Range: 0.1 (10%) to 4.0 (400%)
}
```

---

## Layout Utilities

Three standalone layout functions are exported from `@flowchart/core`. They are pure functions — they receive node and edge data and return computed positions without mutating anything or touching the chart instance.

```ts
import {
  hierarchicalLayout,
  forceLayout,
  gridLayout,
} from '@flowchart/core'
```

All three share the same signature:

```ts
function layoutFn(
  nodes: NodeData[],
  edges: EdgeData[]
): LayoutResult

interface LayoutResult {
  nodes: Array<{ id: string; x: number; y: number }>
}
```

| Function | Algorithm | Best for |
|----------|-----------|---------|
| `hierarchicalLayout` | Layered DAG (top-to-bottom) | Trees, pipelines, dependency graphs |
| `forceLayout` | Spring / repulsion force-directed | Organic, exploratory graphs without a clear hierarchy |
| `gridLayout` | Simple row-column grid | Fast placement when spatial relationships do not matter |

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
import { FlowChart, hierarchicalLayout, forceLayout, gridLayout } from '@flowchart/core'

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

function applyLayout(algorithm: 'hierarchical' | 'force' | 'grid'): void {
  const currentNodes = chart.graph.getNodes()
  const currentEdges = chart.graph.getEdges()

  const layoutFn =
    algorithm === 'hierarchical' ? hierarchicalLayout :
    algorithm === 'force'        ? forceLayout :
                                   gridLayout

  const result = layoutFn(currentNodes, currentEdges)

  // Merge computed positions back into node data
  const repositioned = currentNodes.map(node => {
    const pos = result.nodes.find(r => r.id === node.id)
    return pos ? { ...node, x: pos.x, y: pos.y } : node
  })

  chart.setNodes(repositioned)
  chart.fitView()
}

// Trigger layout from a button
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
