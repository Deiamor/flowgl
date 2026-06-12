# Vanilla JS / TypeScript

This is the bare-metal path. The framework wrappers all delegate to this
class.

## Minimal example

```ts
import { FlowChart } from '@flowgl/core'

const chart = new FlowChart({
  container: document.getElementById('app')!,
  nodes: [
    { id: 'a', x: 100, y: 150, width: 140, height: 60, label: 'Ingest' },
    { id: 'b', x: 360, y: 150, width: 140, height: 60, label: 'Transform' },
    { id: 'c', x: 620, y: 150, width: 140, height: 60, label: 'Load' },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'b', target: 'c', label: 'validated', animated: true },
  ],
  snapGrid: 20,
  minimap: { position: 'bottom-right' },
})
```

That's everything you need to render an interactive flowchart. Drag nodes
to move them, drag the right edge of a node to draw a new connection, pan
the canvas with an empty-space drag, zoom with the wheel.

## Common options

```ts
new FlowChart({
  container,                       // HTMLElement — the chart canvas + overlays mount here
  nodes,                           // initial NodeData[]
  edges,                           // initial EdgeData[]
  rendererKind: 'webgl2',          // 'webgl2' (default) | 'canvas2d' | a custom Renderer
  background: '#f7f7f7',
  grid:    { type: 'dots', size: 20 },
  minimap: { position: 'bottom-right', size: { width: 200, height: 150 } },
  snapGrid: 20,                    // 0 disables; otherwise drag snaps to this grid in world units
  readOnly: false,                 // when true, every editing interaction is disabled
  labelEditable: true,             // when false, double-click does not open the label editor
  groupDoubleClickCollapses: false,// opt-in: double-clicking a group node toggles its collapse state
  historyLimit: 100,               // undo depth
  ariaLabel: 'Pipeline editor',
  autoFit: false,                  // when true, fit view to initial nodes after construct
  onError: (err) => console.error(err),
  sanitizeHtml: (s) => DOMPurify.sanitize(s), // required when NodeData.htmlContent may contain untrusted strings
})
```

The full option list lives in the [API reference](/api/flowchart#flowchartoptions).

## Reacting to events

```ts
chart.on('connect', ({ sourceId, targetId, sourceHandle, targetHandle }) => {
  chart.addEdge({
    id: crypto.randomUUID(),
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
  })
})

chart.on('nodeDoubleClick', ({ node }) => {
  console.log('opened', node.id)
})

chart.on('nodeUpdate', ({ id, updates }) => {
  console.log('changed', id, updates)
})
```

## Cleanup

Always call `dispose()` when the chart's container is removed from the DOM
— it tears down the WebGL context, removes overlay elements, and detaches
every event listener.

```ts
chart.dispose()
```

Forgetting `dispose()` is the most common source of GPU resource leaks. In
SPA setups, call it in the framework's unmount hook.

## SSR-safe

`@flowgl/core` is safe to import on the server. The constructor guards
`typeof window === 'undefined'` and returns a dormant instance — calling
methods on it is a no-op and no DOM is touched. Hydrate on the client by
constructing it for real when the container element is mounted.

## Next steps

- Bind events to your application state — see the [auto-connect cookbook](/cookbook/) entry.
- Style nodes with `NodeData.style` — borderColor, backgroundColor, textColor, fontSize.
- Make a custom node by setting `NodeData.htmlContent` to your own DOM string.
- Use a framework wrapper for less boilerplate: [React](./react), [Vue](./vue), [Svelte](./svelte).
