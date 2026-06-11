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
- **SDF text rendering** — Signed Distance Field font atlas delivers sharp labels at any zoom level (dead-reckoning EDT + `smoothstep(fwidth)` in GLSL)
- **SSR-safe** — detects non-browser environments and calls `onError` instead of crashing
- **856 tests** across 23 test files

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

## Text rendering

Node labels use a **Signed Distance Field (SDF)** texture atlas. Glyphs are rendered to a Canvas 2D offscreen buffer, a dead-reckoning Euclidean distance transform is applied to the alpha channel, and the result is stored as `(R, G, B) = textColor`, `A = SDF distance`. The fragment shader reconstructs sharp edges via `smoothstep(fwidth(dist) * 0.7)`, making labels crisp at any zoom level — including high-DPI displays and deep zoom-in.

Edge labels (which include a background fill) continue to use the bitmap path and retain their previous quality characteristics.

## Recipes

### Sync a chart with external (e.g. React / Vue / Svelte) state

```ts
const chart = new FlowChart({ container, nodes: initialNodes, edges: initialEdges })

// Internal mutation → propagate to external store
chart.on('nodeUpdate', ({ id, updates }) => store.patchNode(id, updates))
chart.on('nodeAdd',    ({ node })        => store.upsertNode(node))
chart.on('nodeRemove', ({ id })          => store.deleteNode(id))
chart.on('edgeAdd',    ({ edge })        => store.upsertEdge(edge))
chart.on('edgeRemove', ({ id })          => store.deleteEdge(id))

// External mutation → propagate to chart
store.subscribe(state => chart.setNodes(state.nodes))
```

### Auto-layout, then animate to the new positions

```ts
import { hierarchicalLayout } from '@flowgl/core'

const result = hierarchicalLayout(chart.getNodes(), chart.getEdges())
chart.animateLayout(result.nodes, 600) // 600 ms eased transition
```

### Reject a connection conditionally

```ts
new FlowChart({
  container,
  onBeforeConnect: ({ sourceId, targetId }) => {
    // Reject self-loops
    return sourceId !== targetId
  },
})
```

### Persist + restore chart state

```ts
// Save
const snapshot = chart.toJSON()
localStorage.setItem('chart', JSON.stringify(snapshot))

// Restore (with schema validation at the trust boundary)
const raw = JSON.parse(localStorage.getItem('chart') ?? 'null')
if (raw && Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
  chart.fromJSON(raw)
}
```

### Extend the right-click context menu

```ts
chart.on('nodeDoubleClick', ({ node }) => openInspector(node.id))
// Or replace the built-in panels via `setNodeStatus` / `setNodeStyle` etc.
chart.setNodeStatus(node.id, 'error')
```

## Accessibility

`FlowChart` aims for full keyboard + screen-reader operability:

- Canvas exposes `role="application"`, configurable `aria-label`, `aria-roledescription="Flowchart editor"`, `aria-keyshortcuts` (enumerates every shortcut so AT discovers them), and `aria-describedby` pointing to a visually-hidden summary.
- **Tab / Shift+Tab** cycles nodes; **Arrow keys** nudge the selection by 10 px (debounced ARIA announcement at 400 ms so screen readers are not flooded).
- **Delete / Backspace** removes selection; **Ctrl/⌘+Z / Y** undo / redo; **Ctrl/⌘+A** selects all; **F** fits view; **Shift+F** fits selection.
- Status badges set `aria-live="polite"` announcements (e.g. "Node Start: error").

### WCAG audit — what the library guarantees vs. what you must verify

| Criterion (WCAG 2.2 AA) | Library | Caller |
|---|---|---|
| 1.4.3 Contrast (text) | — | **Verify**: `style.backgroundColor` vs `style.textColor` ≥ 4.5:1 for body text, ≥ 3:1 for large/≥18 px |
| 1.4.11 Non-text Contrast (focus, borders) | Selected-node ring `#1a73e8`, status badges with white border; both ≥ 3:1 on light backgrounds | Verify on custom themes |
| 2.1.1 Keyboard | ✓ Every interactive surface is keyboard-reachable | — |
| 2.1.2 No Keyboard Trap | ✓ Inline label editor commits on blur and refocuses canvas | — |
| 2.4.3 Focus Order | ✓ Tab traverses nodes in graph order | — |
| 2.4.7 Focus Visible | ✓ Canvas `outline:none` is replaced by a WebGL-rendered selection ring | Verify the ring color contrasts against your background |
| 3.2.2 On Input | ✓ Label edit does not auto-commit on typing — only Enter / blur | — |
| 4.1.2 Name, Role, Value | ✓ `role="application"` + `aria-label` + `aria-keyshortcuts` | Pass a domain-specific `ariaLabel` (e.g. `"Pipeline editor"`) |
| 4.1.3 Status Messages | ✓ `aria-live="polite"` announcements for select/delete/status | — |

Suggested quick audit (axe-core or @axe-core/playwright):

```ts
import { AxeBuilder } from '@axe-core/playwright'

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
  .analyze()
expect(results.violations).toEqual([])
```

## Security

`NodeData.htmlContent` is written to `innerHTML` via the HTML overlay. **It is opt-in unsafe** — pass `sanitizeHtml` on the constructor when this field may contain untrusted input:

```ts
import DOMPurify from 'dompurify'

new FlowChart({
  container,
  sanitizeHtml: (html) => DOMPurify.sanitize(html),
  nodes: [{ id: 'card', x: 0, y: 0, width: 200, height: 100, label: '',
            htmlContent: someUserSuppliedHtml }],
})
```

If `htmlContent` is set without a sanitizer, the first write emits a one-time console warning. `exportSVG` validates `style.{backgroundColor, borderColor, textColor, color}` against a CSS-color whitelist (hex, rgb()/rgba(), hsl()/hsla(), named) and rejects malformed input back to the documented defaults — the export cannot be used as an XSS vector by chart data alone.

## Migration

### 0.1.x → 0.2.0

- `chart.graph.getNodes()` / `chart.graph.getEdges()` → `chart.getNodes()` / `chart.getEdges()`. The `graph` and `viewport` fields still exist for compatibility but are JSDoc-deprecated and will become private in 1.0.
- `chart.setNodeBorderColor(id, c)` / `setNodeBackgroundColor(id, c)` / `setNodeShape(id, s)` → `chart.setNodeStyle(id, { borderColor | backgroundColor | shape })`.
- `chart.setSelectedIds(ids)` + `chart.setSelectedEdgeIds(ids)` → `chart.setSelection({ nodes, edges })` (single call emits `selectionChange` once).
- `chart.requestRender()` → no replacement needed; every mutation already schedules a render.
- Custom `Renderer` implementations: `render(graph, viewport, ...args)` → `render(graph, viewport, frame: RenderFrame)`. `hasAnimatedEdges(): boolean` is now required by the interface.
