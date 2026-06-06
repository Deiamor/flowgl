# @flowgl/vue

Vue 3 wrapper for [@flowgl/core](https://www.npmjs.com/package/@flowgl/core) — a zero-dependency WebGL2 flowchart library.

## Installation

```bash
npm install @flowgl/vue @flowgl/core
```

## Quick start

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Flowchart } from '@flowgl/vue'
import type { FlowChart, NodeData, EdgeData } from '@flowgl/core'

const chartRef = ref<{ chart: FlowChart | null }>()

const nodes = ref<NodeData[]>([
  { id: 'a', x: 80,  y: 150, width: 120, height: 60, label: 'Start' },
  { id: 'b', x: 360, y: 150, width: 120, height: 60, label: 'End'   },
])

const edges = ref<EdgeData[]>([
  { id: 'e1', source: 'a', target: 'b' },
])
</script>

<template>
  <div style="width: 100vw; height: 100vh">
    <Flowchart
      ref="chartRef"
      :nodes="nodes"
      :edges="edges"
      @node-click="(node) => console.log('clicked', node.id)"
      @connect="({ sourceId, targetId }) => console.log('new edge', sourceId, '->', targetId)"
    />
  </div>
</template>
```

## Controlled edges with `autoConnect`

By default (`autoConnect` is `true`) the wrapper automatically creates a new edge whenever the user draws a connection. To manage edges yourself, set `:auto-connect="false"` and call `chart.addEdge()` in your `connect` handler:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Flowchart } from '@flowgl/vue'
import type { FlowChart, NodeData, EdgeData } from '@flowgl/core'

const chartRef = ref<{ chart: FlowChart | null }>()

function handleConnect({ sourceId, targetId, sourceHandle, targetHandle }) {
  // validate before adding
  if (sourceId !== targetId) {
    chartRef.value?.chart?.addEdge({
      id: crypto.randomUUID(),
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
    })
  }
}
</script>

<template>
  <Flowchart
    ref="chartRef"
    :nodes="nodes"
    :edges="edges"
    :auto-connect="false"
    @connect="handleConnect"
  />
</template>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nodes` | `NodeData[]` | `[]` | Node array (synced to chart) |
| `edges` | `EdgeData[]` | `[]` | Edge array (synced to chart) |
| `background` | `string` | `'#f7f7f7'` | Canvas background color |
| `grid` | `Partial<GridConfig>` | — | Grid overlay config |
| `minimap` | `Partial<MinimapConfig>` | — | Minimap config; omit to hide |
| `labelEditable` | `boolean` | `true` | Enable inline label editing |
| `readOnly` | `boolean` | `false` | Disable all editing |
| `historyLimit` | `number` | `100` | Max undo history depth |
| `ariaLabel` | `string` | `'Flowchart'` | `aria-label` on the canvas |
| `autoConnect` | `boolean` | `true` | Auto-create edge on connect drag |
| `width` | `string` | `'100%'` | Container CSS width |
| `height` | `string` | `'100%'` | Container CSS height |
| `class` | `string` | — | Extra class names on the container |
| `style` | `string \| Record<string, string>` | — | Extra styles on the container |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `init` | `FlowChart` | Fires once after the chart is created |
| `nodes-change` | `NodeData[]` | After any node move (drag end) |
| `edges-change` | `EdgeData[]` | After an edge is auto-created via connect drag |
| `connect` | `ConnectParams` | A new connection was drawn |
| `node-click` | `NodeData` | Node click |
| `node-add` | `NodeData` | Node added via `chart.addNode()` |
| `node-remove` | `string` (id) | Node removed |
| `node-update` | `{ id, updates }` | Node property changed |
| `edge-add` | `EdgeData` | Edge added via `chart.addEdge()` |
| `edge-remove` | `string` (id) | Edge removed |
| `edge-update` | `{ id, updates }` | Edge property changed |
| `selection-change` | `{ selectedIds, edgeIds }` | Selection changed |
| `viewport-change` | `ViewportState` | Pan/zoom changed |
| `error` | `Error` | WebGL init failure |

## Accessing the chart instance

Use `defineExpose` — the component exposes `{ chart }`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Flowchart } from '@flowgl/vue'
import type { FlowChart } from '@flowgl/core'

const flowchartRef = ref<{ chart: FlowChart | null }>()

onMounted(() => {
  flowchartRef.value?.chart?.fitView()
})
</script>

<template>
  <Flowchart ref="flowchartRef" :nodes="nodes" :edges="edges" />
</template>
```

Alternatively, use the `@init` event:

```vue
<Flowchart
  :nodes="nodes"
  :edges="edges"
  @init="(chart) => { chart.setTheme('dark'); chart.fitView() }"
/>
```

## TypeScript

All types are re-exported from `@flowgl/core`:

```ts
import type { NodeData, EdgeData, FlowChart, ViewportState } from '@flowgl/core'
```
