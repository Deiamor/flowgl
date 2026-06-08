# @flowgl/core

Zero-dependency WebGL2 flowchart library for the browser.

[GitHub](https://github.com/Deiamor/flowgl) · [npm](https://www.npmjs.com/package/@flowgl/core) · [Demo](https://dev.flowgl.ouranos.kr/)

## Features

- **WebGL2 rendering** — GPU-accelerated nodes, edges, and text at any zoom level
- **Zero dependencies** — no React, no D3, no external packages
- **Touch support** — drag nodes, draw connections, and pan/pinch-zoom on touch screens
- **Keyboard navigation** — Tab/Shift+Tab to cycle nodes, Arrow keys to nudge (10 px), Ctrl+Z/Y for undo/redo
- **Undo / redo** — snapshot-based history with configurable depth; `batchUpdate` groups mutations into one entry
- **Multi-line text + RTL** — word-wrap within node width, automatic RTL detection
- **Edge labels** — `label` field on any edge, rendered at the bezier midpoint
- **Animated edges** — `animated: true` on any edge enables marching-ants rendering
- **Custom ports** — named connection points with optional `maxConnections` limits
- **Group nodes** — collapse/expand child nodes; `type: 'group'`
- **Minimap** — optional overview panel, configurable position and size
- **Node status badges** — `error | warning | success | info` rendered at the top-right corner
- **Accessible** — `role="application"`, `aria-live` announcements, full keyboard control
- **SSR-safe** — detects non-browser environments and calls `onError` instead of crashing
- **220 tests** across 10 test files

## Installation

```bash
npm install @flowgl/core
```

## Quick start

```ts
import { FlowChart } from '@flowgl/core'

const chart = new FlowChart({
  container: document.getElementById('app')!,
  nodes: [
    { id: 'a', x: 100, y: 150, width: 120, height: 60, label: 'Start' },
    { id: 'b', x: 350, y: 150, width: 120, height: 60, label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', label: 'next' },
  ],
})

chart.on('nodeClick', ({ node }) => console.log('clicked', node.id))
chart.on('connect',   ({ sourceId, targetId }) => console.log('connected', sourceId, '->', targetId))

// later
chart.dispose()
```

## FlowChartOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `container` | `HTMLElement` | — | Host element; the canvas is appended inside it |
| `nodes` | `NodeData[]` | `[]` | Initial nodes |
| `edges` | `EdgeData[]` | `[]` | Initial edges |
| `renderer` | `RendererOptions` | `{}` | `{ pixelRatio?, antialias? }` |
| `labelEditable` | `boolean` | `true` | Double-click to edit node labels inline |
| `readOnly` | `boolean` | `false` | Disable all editing (drag, connect, resize, delete, label edit) |
| `background` | `string` | `'#f7f7f7'` | Canvas background color |
| `grid` | `Partial<GridConfig>` | — | `{ visible, type, size, color }` |
| `minimap` | `Partial<MinimapConfig>` | — | Minimap overlay; omit to disable |
| `ariaLabel` | `string` | `'Flowchart'` | `aria-label` on the canvas element |
| `historyLimit` | `number` | `100` | Max undo history entries |
| `snapGrid` | `number` | `0` | Snap drag to this world-unit grid size; `0` = off |
| `autoFit` | `boolean` | `false` | Fit view to initial nodes after construction |
| `onBeforeConnect` | `(params) => boolean` | — | Return `false` to reject a new connection |
| `onBeforeDelete` | `(nodeIds, edgeIds) => boolean` | — | Return `false` to cancel deletion |
| `onError` | `(err: Error) => void` | `console.error` | Called when WebGL2 is unavailable or env is non-browser |

## Events

```ts
chart.on(event, handler)
chart.off(event, handler)
```

| Event | Payload |
|-------|---------|
| `nodeClick` | `{ node: NodeData }` |
| `nodeDoubleClick` | `{ node: NodeData }` |
| `nodeDragStart` | `{ id: string }` |
| `nodeDragEnd` | `{ id, x, y }` |
| `nodeResize` | `{ id, x, y, width, height }` |
| `nodeHover` | `{ node: NodeData \| null }` |
| `edgeClick` | `{ edge: EdgeData }` |
| `edgeDoubleClick` | `{ edge: EdgeData }` |
| `edgeUpdate` | `{ id, updates }` |
| `edgeHover` | `{ edge: EdgeData \| null }` |
| `paneClick` | `{ x, y }` — world coordinates |
| `viewportChange` | `ViewportState` — `{ x, y, zoom }` |
| `connect` | `{ sourceId, targetId, sourceHandle, targetHandle }` |
| `selectionChange` | `{ selectedIds: string[], edgeIds: string[] }` |
| `nodeAdd` | `{ node: NodeData }` |
| `nodeRemove` | `{ id: string }` |
| `nodeUpdate` | `{ id, updates }` |
| `edgeAdd` | `{ edge: EdgeData }` |
| `edgeRemove` | `{ id: string }` |
| `historyChange` | `{ canUndo: boolean, canRedo: boolean }` |

## API

### Node / edge mutation

```ts
chart.addNode(node: NodeData): void
chart.removeNode(id: string): void
chart.updateNode(id: string, updates: Partial<Omit<NodeData, 'id'>>): void
chart.deleteSelected(): void                         // delete selected nodes/edges (respects onBeforeDelete)
chart.duplicateSelected(): void                      // duplicate selected nodes/edges, +24px offset

chart.addEdge(edge: EdgeData): void
chart.removeEdge(id: string): void
chart.updateEdge(id: string, updates: Partial<Omit<EdgeData, 'id'>>): void
chart.swapEdgeDirection(id: string): void            // reverse source ↔ target

chart.setNodes(nodes: NodeData[]): void              // replace all, clears history
chart.setEdges(edges: EdgeData[]): void              // replace all edges
chart.importJSON(data, mode?: 'replace' | 'merge'): void
```

### Node style & status

```ts
chart.setNodeStyle(id: string, style: Partial<NodeStyle>): void
chart.setNodeBorderColor(id: string, color: string): void
chart.setNodeBackgroundColor(id: string, color: string): void
chart.setNodeSize(id: string, width: number, height: number): void
chart.setNodeShape(id: string, shape: NodeShape): void
chart.setNodeStatus(id: string, status: NodeStatus | null): void
chart.setEdgeStyle(id: string, style: Partial<EdgeStyle>): void
chart.lockNode(id: string): void
chart.unlockNode(id: string): void
```

### Selection

```ts
chart.getSelectedIds(): string[]
chart.getSelectedEdgeIds(): string[]
chart.getSelectedNodes(): NodeData[]
chart.getSelectedEdges(): EdgeData[]
chart.setSelectedIds(ids: string[]): void
chart.setSelectedEdgeIds(ids: string[]): void
chart.selectAll(): void
chart.clearSelection(): void
```

### Viewport

```ts
chart.getViewport(): ViewportState        // { x, y, zoom }
chart.setViewport(state: ViewportState): void
chart.fitView(padding?: number): void     // default 40
chart.fitViewToSelection(padding?: number): void
chart.zoomIn(): void
chart.zoomOut(): void
chart.zoomTo(factor: number): void
chart.panTo(worldX: number, worldY: number): void
chart.getNodesBounds(ids?: string[]): AABB | null
chart.scrollToNode(id: string, padding?: number): void
```

### Undo / redo

```ts
chart.undo(): boolean
chart.redo(): boolean
chart.canUndo(): boolean
chart.canRedo(): boolean
chart.clearHistory(): void
chart.batchUpdate(fn: () => void): void   // group mutations into one undo entry
```

### Serialization

```ts
chart.toJSON(): { version: number; nodes: NodeData[]; edges: EdgeData[]; viewport: ViewportState }
chart.fromJSON(data): void
chart.exportPNG(scale?: number): string | null
chart.exportSVG(padding?: number): string
```

### Canvas appearance

```ts
chart.setBackground(color: string): void
chart.setGrid(config: Partial<GridConfig>): void
chart.setTheme(theme: 'light' | 'dark'): void
chart.setReadOnly(readOnly: boolean): void
chart.setSnapGrid(size: number): void
chart.setLabelEditable(enabled: boolean): void
chart.setMinimap(config: Partial<MinimapConfig> | null): void
```

### Group

```ts
chart.collapseNode(id: string): void
chart.expandNode(id: string): void
chart.toggleCollapse(id: string): void
chart.groupNodes(parentId: string, childIds: string[]): void
chart.ungroupNodes(childIds: string[]): void
```

### Alignment

```ts
chart.alignNodes(axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void
chart.distributeNodes(axis: 'horizontal' | 'vertical'): void
```

### Search / highlight

```ts
chart.searchNodes(query: string): NodeData[]   // case-insensitive label search + highlight
chart.setHighlightedNodes(ids: string[]): void
chart.clearHighlights(): void
```

### Graph query

```ts
chart.getNode(id: string): NodeData | undefined
chart.getEdge(id: string): EdgeData | undefined
chart.getNodes(): NodeData[]
chart.getEdges(): EdgeData[]
chart.getEdgesForNode(nodeId: string): EdgeData[]
chart.getEdgesBetween(sourceId: string, targetId: string): EdgeData[]
chart.getIncomers(nodeId: string): NodeData[]
chart.getOutgoers(nodeId: string): NodeData[]
chart.getConnectedNodes(nodeId: string): NodeData[]
chart.hasCycle(): boolean
chart.findPaths(sourceId: string, targetId: string): string[][]  // up to 100 paths
```

### Animation

```ts
chart.animateLayout(targets, duration?: number): void
```

### Runtime callbacks

```ts
chart.setOnBeforeDelete(fn: ((nodeIds: string[], edgeIds: string[]) => boolean) | null): void
```

### Lifecycle

```ts
chart.dispose(): void   // remove canvas, release GPU resources, remove listeners
```

## Data types

### NodeData

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✓ | Unique identifier |
| `x` | `number` | ✓ | World X position (top-left corner) |
| `y` | `number` | ✓ | World Y position (top-left corner) |
| `width` | `number` | ✓ | Node width in world units |
| `height` | `number` | ✓ | Node height in world units |
| `label` | `string` | ✓ | Display text (wraps to node width, supports RTL) |
| `type` | `'group' \| string` | — | `'group'` enables collapse/expand; any other value is a user tag |
| `parentId` | `string` | — | Makes this node a child of the given group node |
| `collapsed` | `boolean` | — | When `true`, children of this group are hidden |
| `locked` | `boolean` | — | When `true`, node cannot be dragged, resized, or deleted |
| `status` | `NodeStatus` | — | Badge at top-right: `error \| warning \| success \| info` |
| `tooltip` | `string` | — | Floating tooltip text on hover |
| `ports` | `PortDef[]` | — | Custom named connection points |
| `style` | `Partial<NodeStyle>` | — | Per-node style overrides |
| `htmlContent` | `string` | — | Raw HTML overlay (suppresses WebGL label) |
| `data` | `Record<string, unknown>` | — | Arbitrary user data |

### NodeStyle

| Field | Type | Default |
|-------|------|---------|
| `backgroundColor` | `string` | `'#ffffff'` |
| `borderColor` | `string` | `'#1a73e8'` |
| `borderWidth` | `number` | `2` |
| `borderRadius` | `number` | `8` |
| `textColor` | `string` | `'#1a1a1a'` |
| `fontSize` | `number` | `14` |
| `fontFamily` | `string` | `'system-ui, sans-serif'` |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'center'` |
| `lineHeight` | `number` | `1.4` |
| `shape` | `NodeShape` | `'rectangle'` |

`NodeShape = 'rectangle' | 'circle' | 'diamond' | 'hexagon'`

### EdgeData

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✓ | Unique identifier |
| `source` | `string` | ✓ | Source node id |
| `target` | `string` | ✓ | Target node id |
| `sourceHandle` | `'top' \| 'right' \| 'bottom' \| 'left'` | — | Default `'right'` |
| `targetHandle` | `'top' \| 'right' \| 'bottom' \| 'left'` | — | Default `'left'` |
| `label` | `string` | — | Text rendered at the bezier midpoint |
| `type` | `'bezier' \| 'straight' \| 'step'` | — | Default `'bezier'` |
| `animated` | `boolean` | — | Marching-ants animated dashes |
| `waypoints` | `{ x: number; y: number }[]` | — | Intermediate world-space control points |
| `style` | `Partial<EdgeStyle>` | — | Color, width, dashArray |
| `data` | `Record<string, unknown>` | — | Arbitrary user data |

### EdgeStyle

| Field | Type | Default |
|-------|------|---------|
| `color` | `string` | `'#555555'` |
| `width` | `number` | `2` |
| `dashArray` | `[number, number]` | — | e.g. `[8, 4]` for dashed |

## Layout utilities

```ts
import { hierarchicalLayout, forceLayout, gridLayout, circularLayout } from '@flowgl/core'
```

| Function | Signature | Best for |
|----------|-----------|---------|
| `hierarchicalLayout` | `(nodes, edges) => LayoutResult` | Trees, pipelines, DAGs |
| `forceLayout` | `(nodes, edges) => LayoutResult` | Organic / exploratory graphs |
| `gridLayout` | `(nodes, edges) => LayoutResult` | Fast placement, no spatial meaning |
| `circularLayout` | `(nodes, radius?) => LayoutResult` | Ring layouts |

All return `{ nodes: Array<{ id, x, y }> }`. Pass the result to `chart.animateLayout()` for a smooth transition:

```ts
const result = hierarchicalLayout(chart.graph.getNodes(), chart.graph.getEdges())
chart.animateLayout(result.nodes, 400)
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Select next node |
| `Shift+Tab` | Select previous node |
| `Arrow keys` | Nudge selected nodes 10 px (rapid presses coalesced into one undo entry) |
| `Delete` / `Backspace` | Delete selected nodes / edges |
| `Escape` | Cancel connection drag / clear selection |
| `Ctrl+A` / `⌘A` | Select all |
| `Ctrl+Z` / `⌘Z` | Undo |
| `Ctrl+Shift+Z` / `⌘⇧Z` | Redo |
| `Ctrl+Y` / `⌘Y` | Redo |
| `Ctrl+C` / `⌘C` | Copy |
| `Ctrl+X` / `⌘X` | Cut |
| `Ctrl+V` / `⌘V` | Paste |
| `Ctrl+D` / `⌘D` | Duplicate |
| `F` | Fit all nodes into view |
| `Shift+F` | Fit selected nodes into view |

Keyboard events are scoped to the canvas element (canvas must be focused). Click or Tab to focus it.

## Touch gestures

| Gesture | Action |
|---------|--------|
| 1-finger drag on node | Move node |
| 1-finger drag on handle circle | Draw edge |
| 1-finger drag on canvas | Pan |
| 2-finger pinch | Zoom |

## Browser support

Requires **WebGL2** — available in all modern browsers (Chrome 56+, Firefox 51+, Safari 15+, Edge 79+). Server-side rendering is not supported; use `onError` to handle non-browser environments gracefully.

## Known limitations

### Text quality at high zoom

Node labels are rendered into a 2048×2048 texture atlas using Canvas 2D. Text stays crisp up to approximately 2× zoom on a standard DPR-1 display (4× on a Retina/HiDPI display) because the atlas is pre-scaled by the device pixel ratio. Beyond that threshold, zooming in will blur the glyphs because the atlas is a fixed-resolution bitmap.

**Workaround**: avoid workflows that require reading fine-grained text at zoom factors above 3–4×.

**Future direction**: replacing the Canvas 2D atlas with signed distance field (SDF) font rendering would provide resolution-independent glyphs at any zoom level. This is tracked as a future enhancement.
