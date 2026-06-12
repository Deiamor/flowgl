# Custom node types

Register a node renderer once with `chart.registerNodeType(name, def)`,
then use it as `addNode({ type: 'name', ... })`. Built-in shapes
(`rectangle`, `circle`, `diamond`, `hexagon`) keep the WebGL2 SDF fast
path; custom types mount a DOM `<div>` per node, positioned and
zoom-scaled to track the canvas.

## Minimal example — sticky note

```ts
import { FlowChart } from '@flowgl/core'

const chart = new FlowChart({ container: document.getElementById('app')! })

chart.registerNodeType('sticky-note', {
  category: 'html',
  defaultSize: { width: 200, height: 120 },
  render: (el, node) => {
    el.innerHTML = `
      <div style="
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 12px;
        height: 100%;
        font: 13px system-ui;
        box-sizing: border-box;
      ">
        <strong>${node.label ?? 'note'}</strong>
        <div style="margin-top:6px;opacity:.75;">
          ${(node.data?.body as string) ?? ''}
        </div>
      </div>
    `
  },
})

chart.addNode({
  id: 'todo-1',
  type: 'sticky-note',
  label: 'Q3 brainstorm',
  x: 100, y: 100, width: 200, height: 120,
  data: { body: 'Lock the routing fix before the demo.' },
})
```

## How rendering works

- The container `<div>` mounts inside the chart at `z-index: 5` —
  between the WebGL canvas (z 0) and the highlight overlay (z 1).
- Each node gets its own child `<div>` with
  `data-flowgl-html-node="<id>"` and
  `data-flowgl-html-type="<name>"` for CSS hooks and tests.
- The chart sets `transform: translate(sx, sy) scale(zoom)` on the
  node `<div>` every render, so DOM content scales with the
  canvas — no per-node pixel-ratio juggling needed.
- `render` is called on mount and on every reposition (drag,
  viewport change, `updateNodeData`). It should be idempotent —
  set `innerHTML` from a template, or mutate inner elements you
  selected the first time.
- Pointer events route into the `<div>` first. The chart's drag /
  connect / select still work as long as the plugin does **not**
  call `e.stopPropagation()`.

## Reading selection / read-only state

The third argument to `render` is a `ctx` object:

```ts
render: (el, node, ctx) => {
  const ring = ctx.selected ? '0 0 0 2px #6366f1' : 'none'
  el.style.boxShadow = ring
  el.setAttribute('aria-disabled', ctx.readOnly ? 'true' : 'false')
  // ctx.zoom is the current viewport.zoom
}
```

`ctx.selected` matches `chart.getSelectedIds().includes(node.id)`.
`ctx.readOnly` mirrors `FlowChartOptions.readOnly` (or
`chart.setReadOnly(...)`).

## Tearing down — `destroy`

Use `destroy` for cleanup the render hook can't unwind in `innerHTML`:
ResizeObservers, intervals, in-flight `fetch`, framework portals.

```ts
chart.registerNodeType('weather-card', {
  category: 'html',
  render: (el, node) => { /* … */ },
  destroy: (el, node) => {
    const tag = el.querySelector('[data-fetch-controller]') as HTMLDivElement | null
    ;(tag?.['__aborter'] as AbortController | undefined)?.abort()
  },
})
```

`destroy` fires when the node is removed (`removeNode`), when its
type changes via `updateNode(id, { type: 'other' })`, and when
`chart.dispose()` runs.

## Publishing a plugin

Ship `@my-org/flowgl-node-foo` as an ESM package exporting a
`NodeTypeDefinition`:

```ts
// packages/foo/src/index.ts
import type { NodeTypeDefinition } from '@flowgl/core'

export const fooNodeType: NodeTypeDefinition = {
  category: 'html',
  defaultSize: { width: 180, height: 100 },
  className: 'foo-node',
  render(el, node, ctx) {
    // …
  },
}
```

Consumers:

```ts
import { fooNodeType } from '@my-org/flowgl-node-foo'
chart.registerNodeType('foo', fooNodeType)
```

Plugins should declare `@flowgl/core` as a peer dependency at the
same `^0.x.0` major they tested against. The chart's
`getRegisteredNodeTypes()` and `getCustomNodeTypes()` give the host
app a list to render in a "node palette" UI.

## Restrictions

- Built-in shape names (`rectangle`, `circle`, `diamond`, `hexagon`)
  and `group` are reserved. Registering them throws.
- External plugins must use `category: 'html'`. `category: 'builtin'`
  is reserved for the SDF-compiled shapes baked into the WebGL2
  fragment shader.
- A node-type without a `render` function throws at registration
  time.
- The render `<div>` is the plugin's. Style it freely, but do not
  call `el.remove()` from inside `render` — let `destroy` and the
  chart's reposition loop manage the lifecycle.

## Related

- [`FlowChart.registerNodeType` API](/api/flowchart#custom-node-type-registry-0-9-0-plugin-contract)
- [`NodeTypeDefinition` type reference](/api/flowchart#type-reference)
