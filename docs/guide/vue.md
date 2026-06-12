# Vue 3

`@flowgl/vue` is a Composition-API wrapper around `@flowgl/core` with
controlled-or-uncontrolled props and event emits.

## Minimal example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Flowchart } from '@flowgl/vue'
import type { NodeData, EdgeData } from '@flowgl/vue'

const nodes = ref<NodeData[]>([
  { id: 'a', x: 100, y: 150, width: 140, height: 60, label: 'Ingest' },
  { id: 'b', x: 360, y: 150, width: 140, height: 60, label: 'Transform' },
])
const edges = ref<EdgeData[]>([
  { id: 'e1', source: 'a', target: 'b', animated: true },
])
</script>

<template>
  <Flowchart
    :nodes="nodes"
    :edges="edges"
    @update:nodes="nodes = $event"
    @update:edges="edges = $event"
    style="width: 100%; height: 600px"
  />
</template>
```

## Two-way binding shortcut

With `v-model` syntax sugar:

```vue
<template>
  <Flowchart v-model:nodes="nodes" v-model:edges="edges" />
</template>
```

## Events

Every chart event is emitted as a Vue event:

```vue
<Flowchart
  v-model:nodes="nodes"
  v-model:edges="edges"
  @connect="onConnect"
  @node-double-click="onNodeDoubleClick"
  @selection-change="onSelectionChange"
/>
```

```ts
function onConnect({ sourceId, targetId, sourceHandle, targetHandle }) {
  edges.value.push({
    id: crypto.randomUUID(),
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
  })
}
```

## Imperative access

Use `ref` to grab the chart's handle for methods like `fitView()`,
`exportPNG()`, `undo()`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Flowchart, type FlowchartHandle } from '@flowgl/vue'

const chartRef = ref<FlowchartHandle | null>(null)
function fit() { chartRef.value?.fitView() }
</script>

<template>
  <button @click="fit">Fit view</button>
  <Flowchart ref="chartRef" v-model:nodes="nodes" v-model:edges="edges" />
</template>
```

## SSR + Nuxt

The component renders only the container on the server and defers chart
construction to the client `onMounted` hook. No extra `<ClientOnly>`
wrapper is required.

## Next steps

- See the [examples gallery](/examples/) — Vue versions of every scenario.
- Wire the chart to Pinia using the [state store cookbook](/cookbook/).
