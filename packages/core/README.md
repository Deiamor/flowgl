# @flowchart/core

Zero-dependency WebGL2 flowchart library for the browser.

## Features

- **WebGL2 rendering** — GPU-accelerated nodes, edges, and text at any zoom level
- **Zero dependencies** — no React, no D3, no external packages
- **Touch support** — drag nodes, draw connections, and pan/pinch-zoom on touch screens
- **Keyboard navigation** — Tab/Shift+Tab to cycle nodes, Arrow keys to nudge (10 px), Ctrl+Z/Y for undo/redo
- **Undo / redo** — snapshot-based history with configurable depth
- **Multi-line text + RTL** — word-wrap within node width, automatic RTL detection
- **Edge labels** — `label` field on any edge, rendered at the bezier midpoint
- **Accessible** — `role="application"`, `aria-live` announcements, full keyboard control
- **SSR-safe** — detects non-browser environments and calls `onError` instead of crashing

## Installation

```bash
npm install @flowchart/core
```

## Quick start

```ts
import { FlowChart } from '@flowchart/core'

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
| `background` | `string` | `'#f7f7f7'` | Canvas background color |
| `grid` | `Partial<GridConfig>` | — | `{ visible, type, size, color }` |
| `ariaLabel` | `string` | `'Flowchart'` | `aria-label` on the canvas element |
| `historyLimit` | `number` | `100` | Max undo history entries |
| `onError` | `(err: Error) => void` | `console.error` | Called when WebGL2 is unavailable or env is non-browser |

## Events

```ts
chart.on(event, handler)
chart.off(event, handler)
```

| Event | Payload |
|-------|---------|
| `nodeClick` | `{ node: NodeData }` |
| `nodeDragEnd` | `{ id, x, y }` |
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

chart.addEdge(edge: EdgeData): void
chart.removeEdge(id: string): void

chart.setNodes(nodes: NodeData[]): void   // replace all, clears history
chart.setEdges(edges: EdgeData[]): void   // replace all edges
```

### Selection

```ts
chart.getSelectedIds(): string[]
chart.getSelectedEdgeIds(): string[]
chart.setSelectedIds(ids: string[]): void
chart.clearSelection(): void
```

### Viewport

```ts
chart.getViewport(): ViewportState        // { x, y, zoom }
chart.setViewport(state: ViewportState): void
chart.fitView(padding?: number): void     // default padding 40 px
```

### Undo / redo

```ts
chart.undo(): boolean
chart.redo(): boolean
chart.canUndo(): boolean
chart.canRedo(): boolean
```

### Serialization

```ts
chart.toJSON(): { version: number; nodes: NodeData[]; edges: EdgeData[]; viewport: ViewportState }
chart.fromJSON(data): void
```

### Node style

```ts
chart.setNodeStyle(id: string, style: Partial<NodeStyle>): void
chart.setNodeBorderColor(id: string, color: string): void
chart.setNodeBackgroundColor(id: string, color: string): void
chart.setNodeSize(id: string, width: number, height: number): void
```

### Canvas appearance

```ts
chart.setBackground(color: string): void
chart.setGrid(config: Partial<GridConfig>): void
chart.setLabelEditable(enabled: boolean): void
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
| `type` | `string` | — | User-defined type tag |
| `style` | `Partial<NodeStyle>` | — | Per-node style overrides |
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
| `style` | `Partial<EdgeStyle>` | — | Color, width, dashArray |
| `data` | `Record<string, unknown>` | — | Arbitrary user data |

### EdgeStyle

| Field | Type | Default |
|-------|------|---------|
| `color` | `string` | `'#555555'` |
| `width` | `number` | `2` |
| `dashArray` | `[number, number]` | — | e.g. `[8, 4]` for dashed |

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
