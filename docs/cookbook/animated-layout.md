# Programmatic layout & animation

When you change a node's position via `updateNode` / `setNodes`, the
chart re-renders at the new positions instantly — useful when you're
relaying out programmatically, jarring when the user is watching. Use
`animateLayout` to interpolate between the current positions and target
positions with a smoothstep easing.

## Minimal

```ts
import { FlowChart, hierarchicalLayout } from '@flowgl/core'

const chart = new FlowChart({ container, nodes, edges })

function reflow() {
  const laidOut = hierarchicalLayout(chart.getNodes(), chart.getEdges(), {
    direction: 'TB',
  })
  const targets = Object.fromEntries(laidOut.map(n => [n.id, { x: n.x, y: n.y }]))
  chart.animateLayout(targets, 600)  // 600ms smoothstep
}
```

`animateLayout(targets, duration)`:

- `targets` is a plain object `Record<nodeId, { x, y }>`. Nodes not in
  the object stay where they are.
- `duration` is in milliseconds; 300–600ms feels right for most graphs.
  Long durations (>1s) read as "we're animating *because* the layout
  changed", short ones (<200ms) as "the chart settled".
- Returns nothing; subscribe to `viewportChange` or run a manual
  `setTimeout` if you need to know when the animation ends.

## With a built-in layout

Three layout algorithms ship in `@flowgl/core`:

- `hierarchicalLayout(nodes, edges, { direction, nodeSpacing, rankSpacing })`
- `circularLayout(nodes, { radius })`
- `forceLayout(nodes, edges, { iterations, attraction, repulsion })`

```ts
import { circularLayout } from '@flowgl/core'

function layoutCircle() {
  const laid = circularLayout(chart.getNodes(), { radius: 220 })
  chart.animateLayout(
    Object.fromEntries(laid.map(n => [n.id, { x: n.x, y: n.y }])),
    500,
  )
}
```

## Custom layout function

A layout is just a function `(nodes, edges) => positions`. Write your
own and feed it into `animateLayout`:

```ts
function swimLanes(nodes, edges) {
  const laneByType = { ingest: 0, transform: 1, sink: 2 }
  return Object.fromEntries(nodes.map(n => [n.id, {
    x: 100 + (n.indexInLane ?? 0) * 200,
    y: 100 + laneByType[n.type ?? 'transform'] * 160,
  }]))
}

chart.animateLayout(swimLanes(chart.getNodes(), chart.getEdges()), 500)
```

## Animating to a saved snapshot

The same pattern restores a saved layout from `toJSON`:

```ts
const snap = chart.toJSON()
// ... user moves nodes ...
chart.animateLayout(
  Object.fromEntries(snap.nodes.map(n => [n.id, { x: n.x, y: n.y }])),
  400,
)
```

## Async layout in a Web Worker

For large graphs, force-directed iterations can block the main thread.
`LayoutWorkerClient` runs the hierarchical algorithm in a worker:

```ts
import { LayoutWorkerClient } from '@flowgl/core'

const worker = new LayoutWorkerClient()
const laid = await worker.hierarchical(chart.getNodes(), chart.getEdges(), {
  direction: 'TB',
})
chart.animateLayout(
  Object.fromEntries(laid.map(n => [n.id, { x: n.x, y: n.y }])),
  500,
)
worker.dispose()
```

A generalized worker contract (so you can run any layout, including
your own custom ones, off-main-thread) is on the
[roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md).

## See also

- [Animated layout example](https://dev.flowgl.ouranos.kr/examples/animated-layout.html)
- [Hierarchical layout example](https://dev.flowgl.ouranos.kr/examples/hierarchical-layout.html)
- [Performance guide](/guide/performance)
