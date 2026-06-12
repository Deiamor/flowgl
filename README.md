<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/brand/logo-dark.svg">
    <img src="./assets/brand/logo.svg" alt="flowgl" width="280">
  </picture>
</p>

<p align="center">
  <strong>GPU-accelerated flowchart &amp; diagram library — WebGL2, zero dependencies, framework-agnostic.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <a href="https://www.npmjs.com/package/@flowgl/core"><img src="https://img.shields.io/npm/v/@flowgl/core?label=%40flowgl%2Fcore" alt="npm @flowgl/core"></a>
  <a href="https://www.npmjs.com/package/@flowgl/react"><img src="https://img.shields.io/npm/v/@flowgl/react?label=%40flowgl%2Freact" alt="npm @flowgl/react"></a>
  <a href="https://www.npmjs.com/package/@flowgl/vue"><img src="https://img.shields.io/npm/v/@flowgl/vue?label=%40flowgl%2Fvue" alt="npm @flowgl/vue"></a>
  <a href="https://www.npmjs.com/package/@flowgl/svelte"><img src="https://img.shields.io/npm/v/@flowgl/svelte?label=%40flowgl%2Fsvelte" alt="npm @flowgl/svelte"></a>
  <a href="https://github.com/Deiamor/flowgl/actions/workflows/ci.yml"><img src="https://github.com/Deiamor/flowgl/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@flowgl/core"><img src="https://img.shields.io/npm/dm/@flowgl/core" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/tests-1082%20passing-brightgreen" alt="1082 tests passing">
  <img src="https://img.shields.io/badge/coverage-93.75%25-brightgreen" alt="coverage 93.75%">
  <img src="https://img.shields.io/badge/renderer-Canvas2D%20%2B%20WebGL2-orange" alt="Canvas2D + WebGL2">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies">
  <img src="https://img.shields.io/badge/provenance-signed-blue" alt="npm provenance signed">
  <img src="https://img.shields.io/badge/SBOM-CycloneDX-blue" alt="CycloneDX SBOM">
  <img src="https://img.shields.io/badge/i18n-CJK%20%E2%9C%93-brightgreen" alt="CJK supported">
</p>

<p align="center">
  <a href="https://docs.flowgl.ouranos.kr/"><strong>Documentation</strong></a>
  &nbsp;·&nbsp;
  <a href="https://dev.flowgl.ouranos.kr/"><strong>Live Demo</strong></a>
  &nbsp;·&nbsp;
  <a href="https://dev.flowgl.ouranos.kr/examples/"><strong>Examples</strong></a>
</p>

<p align="center">
  <img src="./assets/screenshot-light.png" alt="flowgl light theme" width="800">
</p>

---

## Why flowgl

Every other diagramming library renders to SVG or Canvas 2D — both CPU-bound and DOM-heavy. flowgl renders nodes, edges, text, and the minimap on a single WebGL2 context: instanced draw calls, geometry batching, frustum culling, and a fragment-shader text atlas. The result is smooth interaction at graph sizes that make SVG-based tools crawl. A Canvas 2D fallback ships behind the same `Renderer` interface for environments without WebGL2 or for CJK-heavy workloads (see Known limitations below).

Zero runtime dependencies. No D3. No React. No Lodash. `@flowgl/core` ships as a single ES module you own entirely. Every release is signed with npm provenance attestations and ships a CycloneDX SBOM in the tarball.

## 60-second tour

```ts
import { FlowChart } from '@flowgl/core'

const chart = new FlowChart({
  container: document.getElementById('app')!,
  nodes: [
    { id: 'in',  x:  40, y: 100, width: 120, height: 50, label: 'Source' },
    { id: 'mid', x: 240, y: 100, width: 120, height: 50, label: 'Transform' },
    { id: 'out', x: 440, y: 100, width: 120, height: 50, label: 'Sink' },
  ],
  edges: [
    { id: 'a', source: 'in',  target: 'mid' },
    { id: 'b', source: 'mid', target: 'out' },
  ],
})

chart.on('nodeDoubleClick', ({ node }) => console.log('opened', node.id))
chart.on('nodeUpdate',      ({ id, updates }) => console.log('changed', id, updates))
```

Double-click a node to edit its label inline. Drag the right edge to connect. Pan with empty-canvas drag, zoom with wheel/pinch, undo with Ctrl-Z.

---

## Comparison

|  | **flowgl** | react-flow | mermaid |
|---|---|---|---|
| Renderer | WebGL2 (GPU) | SVG | SVG |
| Runtime dependencies | **0** | ~6 | ~15 |
| Touch support | ✅ | ✅ | ❌ |
| Undo / redo | ✅ | ❌ built-in | ❌ |
| Group nodes (collapse/expand) | ✅ | partial | ❌ |
| Framework wrappers | React, Vue, Svelte | React only | — |
| SSR-safe | ✅ | ✅ | ✅ |

---

## Installation

```bash
# Core (framework-agnostic)
npm install @flowgl/core

# Framework wrappers
npm install @flowgl/react
npm install @flowgl/vue
npm install @flowgl/svelte
```

---

## Quick start

### Vanilla JS / TypeScript

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

### React

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

---

## Features

### Nodes

<img src="./assets/screenshot-dark.png" alt="flowgl dark theme" width="600" align="right">

- 📐 Shape variants — rectangle, diamond, hexagon, ellipse, custom
- 🖱️ Drag & drop with snap-to-grid
- 🔲 Multi-select — Cmd+click, Shift+drag box select
- ↔️ Resize handles (4-corner)
- 🗂️ Group nodes — `groupNodes` / `ungroupNodes` to compose or detach children, `dissolveGroup` to remove the group container while keeping its children, `toggleCollapse` / `collapseNode` / `expandNode` to show or hide children. Double-click → collapse is opt-in via `groupDoubleClickCollapses: true` so a stray double-click can't accidentally hide a subtree.
- 🔴 Status badges — error / warning / success / info
- 🔒 Locked nodes
- 🌐 Custom HTML content inside nodes
- 🔌 Named ports with `maxConnections` limits
- 💬 Node tooltips
- 🔤 Multi-line labels with automatic RTL detection

<br clear="right">

### Edges
- 〰️ Edge variants — bezier (default), straight, step (orthogonal), `'smoothstep'` (rounded corners, `pathOptions.borderRadius`)
- 🐜 Animated edges (marching-ants)
- 🏷️ Labels at the rendered-path midpoint by arc length (follows waypoints + step / smoothstep routing, not just the bezier baseline)
- 🌐 HTML edge labels via `chart.addEdgeLabel(spec)` for buttons / badges / mini-graphs
- ⚓ Waypoints — drag the midpoint handle to insert, right-click to remove; hit testing follows the rendered polyline
- ↩️ Endpoint rerouting by drag
- ✏️ Dashed / custom stroke styles

### Interaction
- 🖐️ Pan & zoom — mouse wheel, pinch-zoom on touch
- 📱 Full touch support (drag, connect, pan, pinch)
- ⌨️ Keyboard nav — Tab cycle, Arrow nudge (10 px), Delete
- ↩️ Undo / redo — Ctrl+Z / Ctrl+Y, configurable history depth
- 📋 Copy / cut / paste — Ctrl+C / Ctrl+X / Ctrl+V
- 🔁 Duplicate — Ctrl+D
- ✅ Select all — Ctrl+A
- 🔎 Fit view — F; fit selection — Shift+F
- 👁️ Read-only mode
- 📏 **Helper Lines** — Figma-style alignment guides + snap during drag (`helperLines: { enabled, snap, show }`)
- 🧲 **Proximity Connect** — drag a node near another → ghost + halo preview → drop creates the edge through `onBeforeConnect`
- 🤝 **Easy Connect** — opt-in per-node: `NodeData.easyConnect = true` inflates the handle hit radius so the edge of the node body starts a connection (React Flow whole-node-as-handle UX)
- 🔓 **`NodeData.extent`** — `'parent'` (clamp child to its parent group) or explicit world-coord rect; applied at drag end
- 🌱 **`NodeData.expandParent`** — opposite of `extent: 'parent'`: drag the child out → parent grows to contain it (siblings keep their local offsets)
- 📐 **NodeResize options** — `minWidth/Height`, `maxWidth/Height`, `keepAspectRatio`, `shouldResize` predicate, `onResizeStart/onResize/onResizeEnd` callbacks (Shift toggles aspect-ratio per gesture)

### Layout & Rendering
- 🌳 Hierarchical auto-layout
- ⭕ Circular layout
- 🗺️ Minimap (configurable position & size)
- ▦ Grid background — dots or lines
- 🖼️ Export PNG / SVG (every edge variant exports the actual rendered geometry)
- ♿ Accessible — `role="application"`, `aria-live` announcements
- 🌐 SSR-safe — no crash in Node.js environments

### Overlays & DOM components (0.5.0+)
- 🧰 **Panel** — `chart.addPanel(opts)` — 9-position floating widgets over the chart
- 🎛️ **Controls** — `chart.showControls()` — zoom in/out, fit view, lock toggle, customButtons (vertical / horizontal orientation, 9-position)
- 🛠️ **NodeToolbar** — `chart.addNodeToolbar(spec)` — node-anchored, constant pixel size under zoom, visibility `'auto'` (with selection) / `true` / `false`
- 🛠️ **EdgeToolbar** — `chart.addEdgeToolbar(spec)` — edge-anchored variant of the above
- 🪟 **ViewportPortal** — `chart.addViewportPortal(spec)` — world-coord DOM portal: children scale together with the viewport (opposite of NodeToolbar's constant-size contract)
- 📊 **PerfOverlay** — `chart.showPerfOverlay()` — live FPS / frame time / draw calls / GPU memory estimate / atlas miss rate (differentiator over React Flow)

### Reactive data layer (0.8.0)
- 🔄 **Computing Flows** — `updateNodeData(id, partial)` + `subscribeNodeData(id, listener)` for per-node data fan-out; merge-not-replace semantics
- 🚨 **Explicit cycle detection** — when a subscriber writes back to a node already on the active update stack, propagation stops and a `nodeDataCycle` event fires (differentiator over React Flow, which stack-overflows on cycles)

### React DX (`@flowgl/react`, 0.6.0)
- ⚛️ Hooks — `FlowchartProvider`, `useFlowChart`, `useNodes`, `useEdges`, `useViewport`, `useSelection`. Built on plain `useState` + `useEffect` subscribed to chart events; **no new runtime dependency**.

---

## Framework wrappers

| Package | Status | Description |
|---|---|---|
| `@flowgl/core` | [![npm](https://img.shields.io/npm/v/@flowgl/core)](https://www.npmjs.com/package/@flowgl/core) | Framework-agnostic core library |
| `@flowgl/react` | [![npm](https://img.shields.io/npm/v/@flowgl/react)](https://www.npmjs.com/package/@flowgl/react) | `<Flowchart>` component with full controlled / uncontrolled API |
| `@flowgl/vue` | [![npm](https://img.shields.io/npm/v/@flowgl/vue)](https://www.npmjs.com/package/@flowgl/vue) | Vue 3 `<Flowchart>` component |
| `@flowgl/svelte` | [![npm](https://img.shields.io/npm/v/@flowgl/svelte)](https://www.npmjs.com/package/@flowgl/svelte) | Svelte `<Flowchart>` component |

All wrappers are thin bindings over `@flowgl/core` — no extra runtime weight.

---

## Browser requirements

WebGL2 is required. Supported browsers:

| Browser | Minimum version |
|---|---|
| Chrome | 56+ |
| Firefox | 51+ |
| Safari | 15+ |
| Edge | 79+ |

When WebGL2 is unavailable the `onError` callback is invoked — no silent crash.

---

## License

MIT © [Deiamor](https://github.com/Deiamor)




