# Server-side render (SSR-safe usage)

`@flowgl/core` and all three framework wrappers (`@flowgl/react`,
`@flowgl/vue`, `@flowgl/svelte`) are SSR-safe out of the box. The
constructor guards `typeof window === 'undefined'` and returns a
dormant instance; the framework wrappers defer chart construction to
their respective client-side lifecycle hooks.

## What "SSR-safe" actually means here

When `@flowgl/core` is imported in a Node.js / Edge / Deno environment:

- `new FlowChart({ container })` does **not** touch the DOM.
- It returns an instance whose public methods are mostly no-ops; calling
  them does not throw, but they don't do anything meaningful either.
- No WebGL context is acquired. No `requestAnimationFrame` is scheduled.
- The instance is intentionally throwaway — when the page hydrates on
  the client, construct a fresh chart with a real `container` element.

You don't get a usable chart on the server. You get a *quiet* failure
mode that doesn't crash your SSR render. That's the contract.

## Next.js (React)

The wrapper handles this for you — the `<Flowchart>` component renders
its container `div` on the server and constructs the chart inside a
`useEffect` on the client. No `<ClientOnly>` is required.

```tsx
// app/pipeline/page.tsx
'use client'

import { Flowchart } from '@flowgl/react'
import { useState } from 'react'

export default function PipelinePage() {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  return (
    <Flowchart
      nodes={nodes}
      edges={edges}
      onNodesChange={setNodes}
      onEdgesChange={setEdges}
      style={{ width: '100%', height: 600 }}
    />
  )
}
```

The `'use client'` directive is required because the chart is interactive
state. The server response includes the container `<div>` with its size;
the chart constructs on first paint.

If you're using Pages Router rather than App Router:

```tsx
// pages/pipeline.tsx
import dynamic from 'next/dynamic'

const Flowchart = dynamic(
  () => import('@flowgl/react').then(m => m.Flowchart),
  { ssr: false }
)
```

`{ ssr: false }` is optional but skips the wrapper-render-and-discard
roundtrip if your SSR budget matters.

## Nuxt (Vue 3)

Same shape. The Composition API wrapper handles `onMounted` internally:

```vue
<!-- pages/pipeline.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { Flowchart } from '@flowgl/vue'

const nodes = ref(initialNodes)
const edges = ref(initialEdges)
</script>

<template>
  <Flowchart v-model:nodes="nodes" v-model:edges="edges" style="width:100%;height:600px;" />
</template>
```

You do not need to wrap the component in `<ClientOnly>` — the wrapper
already gates on a client check. Add `<ClientOnly>` only if you're
hitting a hard server-side error from some other library further up
the tree.

## SvelteKit

```svelte
<!-- routes/pipeline/+page.svelte -->
<script lang="ts">
  import { Flowchart } from '@flowgl/svelte'
  let nodes = initialNodes
  let edges = initialEdges
</script>

<Flowchart bind:nodes bind:edges style="width:100%;height:600px;" />
```

Works on both `export const ssr = true` (default) and `export const ssr
= false`. The `onMount` inside the wrapper handles the deferral.

## Hydration mismatch warnings

If you see a hydration mismatch from React / Vue / Svelte, it's almost
always because the *container* dimensions differ between server and
client (often a CSS-only issue). The chart itself doesn't render
content during SSR, so it's not the source. Pin the container's width
and height explicitly:

```tsx
<Flowchart style={{ width: '100%', height: 600 }} />
```

…rather than relying on parent flex sizing that might compute
differently on the server.

## Server-side SVG / PNG preview generation

If what you actually want is a static SVG preview generated on the
server (not an interactive chart), the right pattern is to build the
graph data on the server, send it to the client, render in a hidden
container, call `chart.exportSVG()`, send the SVG back. That works
today but is awkward.

A dedicated server-side renderer backend (so you can `import { ssrRender }
from '@flowgl/ssr'`) is on the
[roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md)
under "Later".

## See also

- [React wrapper guide](/guide/react)
- [Vue wrapper guide](/guide/vue)
- [Svelte wrapper guide](/guide/svelte)
- [Wire to state store](./state-store)
