# @flowgl/react

React wrapper for [@flowgl/core](https://www.npmjs.com/package/@flowgl/core) — a zero-dependency WebGL2 flowchart library.

## Installation

```bash
npm install @flowgl/react @flowgl/core
```

## Quick start

```tsx
import { useRef } from 'react'
import { Flowchart } from '@flowgl/react'
import type { FlowChart, NodeData, EdgeData } from '@flowgl/core'

const initialNodes: NodeData[] = [
  { id: 'a', x: 80,  y: 150, width: 120, height: 60, label: 'Start' },
  { id: 'b', x: 360, y: 150, width: 120, height: 60, label: 'End'   },
]

const initialEdges: EdgeData[] = [
  { id: 'e1', source: 'a', target: 'b' },
]

export default function App() {
  const chartRef = useRef<FlowChart | null>(null)

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Flowchart
        ref={chartRef}
        nodes={initialNodes}
        edges={initialEdges}
        onNodeClick={(node) => console.log('clicked', node.id)}
        onConnect={({ sourceId, targetId }) =>
          console.log('new edge', sourceId, '->', targetId)
        }
      />
    </div>
  )
}
```

## Controlled edges with `autoConnect`

By default (`autoConnect={true}`) the wrapper automatically creates a new edge whenever the user draws a connection. To manage edges yourself, set `autoConnect={false}` and call `chart.addEdge()` in your `onConnect` handler:

```tsx
<Flowchart
  ref={chartRef}
  nodes={nodes}
  edges={edges}
  autoConnect={false}
  onConnect={({ sourceId, targetId, sourceHandle, targetHandle }) => {
    // validate before adding
    if (sourceId !== targetId) {
      chartRef.current?.addEdge({
        id: crypto.randomUUID(),
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
      })
    }
  }}
/>
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
| `style` | `CSSProperties` | — | Container style |
| `className` | `string` | — | Container class name |
| `onError` | `(err: Error) => void` | — | WebGL init failure handler |

## Callbacks

| Callback | Signature | Description |
|----------|-----------|-------------|
| `onInit` | `(chart: FlowChart) => void` | Fires once after the chart is created |
| `onNodesChange` | `(nodes: NodeData[]) => void` | After any node move (drag end) |
| `onEdgesChange` | `(edges: EdgeData[]) => void` | After an edge is auto-created via connect drag |
| `onConnect` | `(params: ConnectParams) => void` | A new connection was drawn |
| `onNodeClick` | `(node: NodeData) => void` | Node click |
| `onNodeAdd` | `(node: NodeData) => void` | Node added via `chart.addNode()` |
| `onNodeRemove` | `(id: string) => void` | Node removed |
| `onNodeUpdate` | `(id: string, updates) => void` | Node property changed |
| `onEdgeAdd` | `(edge: EdgeData) => void` | Edge added via `chart.addEdge()` |
| `onEdgeRemove` | `(id: string) => void` | Edge removed |
| `onEdgeUpdate` | `(id: string, updates) => void` | Edge property changed |
| `onSelectionChange` | `({ selectedIds, edgeIds }) => void` | Selection changed |
| `onViewportChange` | `(state: ViewportState) => void` | Pan/zoom changed |

## Accessing the chart instance

Use the `ref` prop to get the underlying `FlowChart` instance for imperative calls:

```tsx
const chartRef = useRef<FlowChart | null>(null)

// fit view after data loads
useEffect(() => {
  chartRef.current?.fitView()
}, [nodes])

<Flowchart ref={chartRef} nodes={nodes} edges={edges} />
```

Alternatively, use the `onInit` callback:

```tsx
<Flowchart
  nodes={nodes}
  edges={edges}
  onInit={(chart) => {
    chart.setTheme('dark')
    chart.fitView()
  }}
/>
```

## TypeScript

All types are re-exported from `@flowgl/core`:

```ts
import type { NodeData, EdgeData, FlowChart, ViewportState } from '@flowgl/core'
```
