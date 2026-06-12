# Wire to Redux / Zustand / Pinia / Svelte store

flowgl's framework wrappers expose **controlled-component props** so the
chart's nodes / edges always reflect what your store says. There's no
hidden state — the chart re-renders when you update the store, and
emits change events when the user edits.

The pattern is the same shape in every framework: store → props →
chart, and chart events → store mutation → re-render.

## React (Zustand)

```tsx
import { create } from 'zustand'
import { Flowchart } from '@flowgl/react'
import type { NodeData, EdgeData } from '@flowgl/react'

type Store = {
  nodes: NodeData[]
  edges: EdgeData[]
  setNodes: (n: NodeData[]) => void
  setEdges: (e: EdgeData[]) => void
}

const useGraph = create<Store>((set) => ({
  nodes: [
    { id: 'a', x: 100, y: 150, width: 140, height: 60, label: 'Ingest' },
    { id: 'b', x: 360, y: 150, width: 140, height: 60, label: 'Transform' },
  ],
  edges: [{ id: 'e1', source: 'a', target: 'b' }],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}))

export function Pipeline() {
  const { nodes, edges, setNodes, setEdges } = useGraph()
  return (
    <Flowchart
      nodes={nodes}
      edges={edges}
      onNodesChange={setNodes}
      onEdgesChange={setEdges}
      onConnect={({ sourceId, targetId, sourceHandle, targetHandle }) => {
        setEdges([
          ...edges,
          { id: crypto.randomUUID(), source: sourceId, target: targetId, sourceHandle, targetHandle },
        ])
      }}
    />
  )
}
```

For Redux, the same shape works — `useSelector` to read `nodes` / `edges`,
`useDispatch` for the change callbacks.

## Vue 3 (Pinia)

```ts
// stores/graph.ts
import { defineStore } from 'pinia'
import type { NodeData, EdgeData } from '@flowgl/vue'

export const useGraphStore = defineStore('graph', {
  state: () => ({
    nodes: [
      { id: 'a', x: 100, y: 150, width: 140, height: 60, label: 'Ingest' },
      { id: 'b', x: 360, y: 150, width: 140, height: 60, label: 'Transform' },
    ] as NodeData[],
    edges: [{ id: 'e1', source: 'a', target: 'b' }] as EdgeData[],
  }),
  actions: {
    setNodes(nodes: NodeData[]) { this.nodes = nodes },
    setEdges(edges: EdgeData[]) { this.edges = edges },
    connect(p: { sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string }) {
      this.edges.push({
        id: crypto.randomUUID(),
        source: p.sourceId, target: p.targetId,
        sourceHandle: p.sourceHandle, targetHandle: p.targetHandle,
      })
    },
  },
})
```

```vue
<!-- Pipeline.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Flowchart } from '@flowgl/vue'
import { useGraphStore } from './stores/graph'

const store = useGraphStore()
const { nodes, edges } = storeToRefs(store)
</script>

<template>
  <Flowchart
    v-model:nodes="nodes"
    v-model:edges="edges"
    @connect="store.connect"
  />
</template>
```

## Svelte (writable store)

```ts
// graph.ts
import { writable } from 'svelte/store'
import type { NodeData, EdgeData } from '@flowgl/svelte'

export const nodes = writable<NodeData[]>([
  { id: 'a', x: 100, y: 150, width: 140, height: 60, label: 'Ingest' },
  { id: 'b', x: 360, y: 150, width: 140, height: 60, label: 'Transform' },
])
export const edges = writable<EdgeData[]>([{ id: 'e1', source: 'a', target: 'b' }])
```

```svelte
<!-- Pipeline.svelte -->
<script lang="ts">
  import { Flowchart } from '@flowgl/svelte'
  import { nodes, edges } from './graph'
</script>

<Flowchart
  bind:nodes={$nodes}
  bind:edges={$edges}
  on:connect={({ detail }) => {
    $edges = [...$edges, {
      id: crypto.randomUUID(),
      source: detail.sourceId, target: detail.targetId,
      sourceHandle: detail.sourceHandle, targetHandle: detail.targetHandle,
    }]
  }}
/>
```

## Performance — when to mutate via the chart API instead

For graphs above a few thousand nodes, driving every drag / connect /
update through a top-level store can become a re-render bottleneck. In
that case, hold the store at a coarser granularity (e.g., a snapshot
key per significant operation) and use `chart.addNode` /
`chart.updateNode` / `chart.removeNode` from a ref handle for the
high-frequency mutations.

```tsx
import { useRef } from 'react'
import { Flowchart, type FlowchartHandle } from '@flowgl/react'

const ref = useRef<FlowchartHandle>(null)
// inside an interaction handler:
ref.current?.updateNode(id, { x: newX, y: newY })
```

The chart maintains its own internal graph; the store catches up on the
next snapshot (e.g., on `nodeDragEnd`, not on every `nodeDragMove`).

## SSR

All three wrappers defer chart construction to the client (`useEffect` /
`onMounted` / `onMount`). The server renders the wrapper component as a
plain `<div>` container, so SSR-safe stores like Zustand / Pinia /
Svelte writable work without extra setup.

## See also

- [Auto-connect cookbook](./auto-connect)
- [API reference — Events](/api/flowchart#events)
- React: [Flowchart wrapper guide](/guide/react)
- Vue: [Flowchart wrapper guide](/guide/vue)
- Svelte: [Flowchart wrapper guide](/guide/svelte)
