# @flowgl/svelte

Svelte 4 wrapper for [@flowgl/core](https://www.npmjs.com/package/@flowgl/core) — a zero-dependency WebGL2 flowchart library.

[GitHub](https://github.com/Deiamor/flowgl) · [npm](https://www.npmjs.com/package/@flowgl/svelte) · [Demo](https://dev.flowgl.ouranos.kr/)

## Installation

```bash
npm install @flowgl/svelte @flowgl/core
```

## Quick start

```svelte
<script lang="ts">
  import { Flowchart } from '@flowgl/svelte'
  import type { NodeData, EdgeData } from '@flowgl/core'

  const nodes: NodeData[] = [
    { id: 'a', x: 80,  y: 150, width: 120, height: 60, label: 'Start' },
    { id: 'b', x: 360, y: 150, width: 120, height: 60, label: 'End'   },
  ]

  const edges: EdgeData[] = [
    { id: 'e1', source: 'a', target: 'b' },
  ]
</script>

<div style="width:100vw;height:100vh">
  <Flowchart
    {nodes}
    {edges}
    on:nodeClick={(e) => console.log('clicked', e.detail.id)}
    on:connect={(e) => console.log('new edge', e.detail.sourceId, '->', e.detail.targetId)}
  />
</div>
```

## Controlled edges with `autoConnect`

By default (`autoConnect={true}`) the wrapper automatically creates a new edge whenever the user draws a connection. To manage edges yourself, set `autoConnect={false}` and call `chart.addEdge()` in your `connect` event handler:

```svelte
<script lang="ts">
  import { Flowchart } from '@flowgl/svelte'
  import type { FlowChart } from '@flowgl/core'

  let chart: FlowChart | null = null

  function handleConnect(e: CustomEvent) {
    const { sourceId, targetId, sourceHandle, targetHandle } = e.detail
    if (sourceId !== targetId) {
      chart?.addEdge({
        id: crypto.randomUUID(),
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
      })
    }
  }
</script>

<Flowchart
  bind:chart
  {nodes}
  {edges}
  autoConnect={false}
  on:connect={handleConnect}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nodes` | `NodeData[]` | `[]` | Node array (synced to chart) |
| `edges` | `EdgeData[]` | `[]` | Edge array (synced to chart) |
| `background` | `string` | — | Canvas background color |
| `grid` | `Partial<GridConfig>` | — | Grid overlay config |
| `minimap` | `Partial<MinimapConfig>` | — | Minimap config; omit to hide |
| `labelEditable` | `boolean` | — | Enable inline label editing |
| `readOnly` | `boolean` | — | Disable all editing |
| `historyLimit` | `number` | — | Max undo history depth |
| `ariaLabel` | `string` | — | `aria-label` on the canvas |
| `autoConnect` | `boolean` | `true` | Auto-create edge on connect drag |
| `width` | `string` | `'100%'` | Container CSS width |
| `height` | `string` | `'100%'` | Container CSS height |
| `className` | `string` | `''` | Extra class names on the container |
| `chart` | `FlowChart \| null` | — | Bindable — exposes the chart instance |

## Events

| Event | `event.detail` | Description |
|-------|----------------|-------------|
| `init` | `FlowChart` | Fires once after the chart is created |
| `nodesChange` | `NodeData[]` | After any node move (drag end) |
| `edgesChange` | `EdgeData[]` | After an edge is auto-created via connect drag |
| `connect` | `{ sourceId, targetId, sourceHandle, targetHandle }` | A new connection was drawn |
| `nodeClick` | `NodeData` | Node click |
| `nodeAdd` | `NodeData` | Node added via `chart.addNode()` |
| `nodeRemove` | `string` (id) | Node removed |
| `nodeUpdate` | `{ id, updates }` | Node property changed |
| `edgeAdd` | `EdgeData` | Edge added via `chart.addEdge()` |
| `edgeRemove` | `string` (id) | Edge removed |
| `edgeUpdate` | `{ id, updates }` | Edge property changed |
| `selectionChange` | `{ selectedIds, edgeIds }` | Selection changed |
| `viewportChange` | `ViewportState` | Pan/zoom changed |
| `error` | `Error` | WebGL init failure |

## Accessing the chart instance

Use `bind:chart` to get a reactive reference to the underlying `FlowChart` instance:

```svelte
<script lang="ts">
  import { Flowchart } from '@flowgl/svelte'
  import type { FlowChart } from '@flowgl/core'

  let chart: FlowChart | null = null
</script>

<button on:click={() => chart?.fitView()}>Fit View</button>

<Flowchart bind:chart {nodes} {edges} />
```

Alternatively, use the `on:init` event:

```svelte
<Flowchart
  {nodes}
  {edges}
  on:init={(e) => { e.detail.setTheme('dark'); e.detail.fitView() }}
/>
```

## TypeScript

All types are re-exported from `@flowgl/core`:

```ts
import type { NodeData, EdgeData, FlowChart, ViewportState } from '@flowgl/core'
```
