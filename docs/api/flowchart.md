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
