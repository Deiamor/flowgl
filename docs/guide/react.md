# React

`@flowgl/react` is a thin binding over `@flowgl/core` — one component,
controlled-or-uncontrolled props, ref-forwarded handle to the underlying
chart for imperative access.

## Minimal example

```tsx
import { useState } from 'react'
import { Flowchart } from '@flowgl/react'
import type { NodeData, EdgeData } from '@flowgl/react'

const initialNodes: NodeData[] = [
  { id: 'a', x: 100, y: 150, width: 140, height: 60, label: 'Ingest' },
  { id: 'b', x: 360, y: 150, width: 140, height: 60, label: 'Transform' },
]
const initialEdges: EdgeData[] = [
  { id: 'e1', source: 'a', target: 'b', animated: true },
]

export function Pipeline() {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)

  return (
    <Flowchart
      nodes={nodes}
      edges={edges}
      onNodesChange={setNodes}
      onEdgesChange={setEdges}
      style={{ width: '100%', height: '600px' }}
    />
  )
}
```

## Imperative access via ref

For the rare case where you need to call a method directly (e.g.,
`fitView()`, `exportPNG()`, `undo()`):

```tsx
import { useRef } from 'react'
import { Flowchart, type FlowchartHandle } from '@flowgl/react'

export function PipelineWithToolbar() {
  const ref = useRef<FlowchartHandle>(null)
  return (
    <>
      <button onClick={() => ref.current?.fitView()}>Fit view</button>
      <button onClick={() => ref.current?.undo()}>Undo</button>
      <Flowchart ref={ref} nodes={nodes} edges={edges} onNodesChange={setNodes} onEdgesChange={setEdges} />
    </>
  )
}
```

The handle exposes the same public API as `@flowgl/core`'s `FlowChart`
class — methods are direct passthrough.

## Event props

Every chart event is also exposed as a callback prop, so you don't need to
attach via the ref:

```tsx
<Flowchart
  nodes={nodes}
  edges={edges}
  onNodesChange={setNodes}
  onEdgesChange={setEdges}
  onConnect={({ sourceId, targetId, sourceHandle, targetHandle }) => {
    setEdges(prev => [
      ...prev,
      { id: crypto.randomUUID(), source: sourceId, target: targetId, sourceHandle, targetHandle },
    ])
  }}
  onNodeDoubleClick={({ node }) => console.log('opened', node.id)}
  onSelectionChange={({ selectedIds, edgeIds }) => console.log('selected', selectedIds, edgeIds)}
/>
```

A full list of event props is in [@flowgl/react API](/api/flowchart#react-wrapper).

## SSR + Next.js / Remix

The wrapper is SSR-safe — `useEffect` defers the actual chart construction
to the client, and the server renders just the container `div`. No extra
setup is required.

## Performance notes

- The wrapper memoizes node + edge arrays internally. You can pass new
  arrays on every render without thrashing the chart — the diff only
  costs O(n) reference checks per frame.
- For lists of thousands of nodes, prefer `useState` over a heavyweight
  global store driving the entire dataset through React on every change.
  Drive incremental mutations through the imperative ref instead.

## Next steps

- Browse the [examples gallery](/examples/) — every example has a
  React variant.
- Wire the chart to Redux / Zustand / Jotai using the
  [state store cookbook](/cookbook/).
