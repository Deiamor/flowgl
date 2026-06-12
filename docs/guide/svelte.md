# Svelte

`@flowgl/svelte` wraps `@flowgl/core` in a single component with bindable
props.

## Minimal example

```svelte
<script lang="ts">
  import { Flowchart } from '@flowgl/svelte'
  import type { NodeData, EdgeData } from '@flowgl/svelte'

  let nodes: NodeData[] = [
    { id: 'a', x: 100, y: 150, width: 140, height: 60, label: 'Ingest' },
    { id: 'b', x: 360, y: 150, width: 140, height: 60, label: 'Transform' },
  ]
  let edges: EdgeData[] = [
    { id: 'e1', source: 'a', target: 'b', animated: true },
  ]
</script>

<Flowchart bind:nodes bind:edges style="width: 100%; height: 600px" />
```

## Events

Svelte components dispatch chart events via `on:` directives:

```svelte
<Flowchart
  bind:nodes
  bind:edges
  on:connect={({ detail }) => {
    edges = [
      ...edges,
      {
        id: crypto.randomUUID(),
        source: detail.sourceId,
        target: detail.targetId,
        sourceHandle: detail.sourceHandle,
        targetHandle: detail.targetHandle,
      },
    ]
  }}
  on:nodeDoubleClick={({ detail }) => console.log('opened', detail.node.id)}
  on:selectionChange={({ detail }) => console.log('selected', detail.selectedIds)}
/>
```

## Imperative access

`bind:this` exposes the chart's handle for direct method calls:

```svelte
<script lang="ts">
  import { Flowchart, type FlowchartHandle } from '@flowgl/svelte'

  let chart: FlowchartHandle
  function fit() { chart?.fitView() }
</script>

<button on:click={fit}>Fit view</button>
<Flowchart bind:this={chart} bind:nodes bind:edges />
```

## SvelteKit / SSR

The component renders only the container on the server and constructs the
chart in the `onMount` hook. Works in both `+page.svelte` (SSR) and
`+page.svelte` with `export const ssr = false`.

## Next steps

- See the [examples gallery](/examples/) for Svelte versions of every scenario.
- Wire to Svelte stores via the [state store cookbook](/cookbook/).
