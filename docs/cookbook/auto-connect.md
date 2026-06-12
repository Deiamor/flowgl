# Auto-connect on handle drag

When the user drags from a node handle and drops on another node,
`@flowgl/core` does **not** add the edge automatically — it just emits a
`connect` event with the resolved source / target / handles. This is on
purpose: most apps want to validate or transform before committing.

The minimal "always accept" pattern:

```ts
import { FlowChart, generateId } from '@flowgl/core'

const chart = new FlowChart({ container, nodes, edges })

chart.on('connect', ({ sourceId, targetId, sourceHandle, targetHandle }) => {
  chart.addEdge({
    id: generateId('e'),
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
  })
})
```

`generateId('e')` returns `'e-<8 hex chars>'`. Use `crypto.randomUUID()`
or your own id factory if you need globally unique ids for a backend.

## Rejecting connections before they're created

`onBeforeConnect` lets you return `false` to drop the connection before
the `connect` event ever fires. Use it for validation rules that should
read like the type system, not like a handler.

```ts
new FlowChart({
  container,
  nodes,
  edges,
  onBeforeConnect: ({ sourceId, targetId, sourceHandle, targetHandle }) => {
    // No self-connections
    if (sourceId === targetId) return false
    // Already connected? No duplicates.
    if (chart.getEdgesBetween(sourceId, targetId).length > 0) return false
    // Port that allows only 1 inbound
    if (targetHandle === 'in' && chart.getEdgesForNode(targetId)
        .filter(e => e.target === targetId && e.targetHandle === 'in').length >= 1) {
      return false
    }
    return true
  },
})
```

When `onBeforeConnect` returns `false`, the user sees the drag snap back
visually and no event fires. No edge is created.

## Adding edge metadata at creation time

The `connect` event payload is exactly what the source-target gesture
resolved — no styling, no label, no domain data. Add anything you need
during `addEdge`:

```ts
chart.on('connect', ({ sourceId, targetId, sourceHandle, targetHandle }) => {
  const src = chart.getNode(sourceId)
  const tgt = chart.getNode(targetId)

  chart.addEdge({
    id: generateId('e'),
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    // Domain metadata
    label: `${src?.label} → ${tgt?.label}`,
    animated: src?.type === 'stream',
    style: {
      width: 2,
      color: '#6366f1',
      dashArray: src?.type === 'optional' ? [8, 4] : undefined,
    },
  })
})
```

## Mirroring the new edge back to your app's state

If you're driving the chart from React / Vue / Svelte / Redux / Zustand /
Pinia, the `connect` handler is the right place to push the new edge into
your store. The wrapper components do this internally already — see the
[Wire to state store](./state-store) recipe for the pattern.

## See also

- [Drag & connect example](https://dev.flowgl.ouranos.kr/examples/drag-connect.html)
- [Named ports example](https://dev.flowgl.ouranos.kr/examples/named-ports.html)
- [`onBeforeConnect` in the API reference](/api/flowchart)
