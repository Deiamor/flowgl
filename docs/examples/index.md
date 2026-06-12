# Examples gallery

25 focused, runnable scenarios. Each example is its own HTML + TS pair
under `demo/examples/`, so you can clone the repo and `pnpm dev` locally,
or follow the links below to the live demo.

| Live gallery | Source |
| --- | --- |
| [dev.flowgl.ouranos.kr/examples/](https://dev.flowgl.ouranos.kr/examples/) | [github.com/Deiamor/flowgl/tree/master/demo/examples](https://github.com/Deiamor/flowgl/tree/master/demo/examples) |

## Basics

| Example | What it shows |
| --- | --- |
| [Minimal](https://dev.flowgl.ouranos.kr/examples/minimal.html) | Three nodes, two edges, default options. |
| [Drag & connect](https://dev.flowgl.ouranos.kr/examples/drag-connect.html) | Drag nodes, draw new connections from handles. |
| [Snap to grid](https://dev.flowgl.ouranos.kr/examples/snap-to-grid.html) | `snapGrid: 20` + matching dotted background. |
| [Keyboard navigation](https://dev.flowgl.ouranos.kr/examples/keyboard-navigation.html) | Tab cycle, Arrow nudge, Delete, Cmd+Z. |
| [Read-only mode](https://dev.flowgl.ouranos.kr/examples/readonly.html) | `readOnly: true` disables every edit. |

## Selection & multi-select

| Example | What it shows |
| --- | --- |
| [Box select](https://dev.flowgl.ouranos.kr/examples/box-select.html) | Drag on empty canvas to rubber-band. |
| [Cmd-click multi](https://dev.flowgl.ouranos.kr/examples/cmd-click-multi.html) | Toggle additional nodes into the selection. |
| [Programmatic selection](https://dev.flowgl.ouranos.kr/examples/programmatic-selection.html) | `setSelectedIds()` driven by a sidebar. |
| [Align & distribute](https://dev.flowgl.ouranos.kr/examples/align-distribute.html) | `alignNodes()` + `distributeNodes()`. |

## Edges

| Example | What it shows |
| --- | --- |
| [Animated edges](https://dev.flowgl.ouranos.kr/examples/animated-edges.html) | `animated: true` marching ants. |
| [Edge labels](https://dev.flowgl.ouranos.kr/examples/edge-labels.html) | Midpoint label with pill background. |
| [Waypoints](https://dev.flowgl.ouranos.kr/examples/waypoints.html) | Drag the midpoint to create / remove waypoints. |
| [Endpoint reroute](https://dev.flowgl.ouranos.kr/examples/endpoint-reroute.html) | Drag an endpoint to a different node. |

## Nodes

| Example | What it shows |
| --- | --- |
| [Status badges](https://dev.flowgl.ouranos.kr/examples/status-badges.html) | error / warning / success / info badges. |
| [Custom HTML node](https://dev.flowgl.ouranos.kr/examples/html-node.html) | `htmlContent` with rich HTML inside a node. |
| [Named ports](https://dev.flowgl.ouranos.kr/examples/named-ports.html) | `ports: [{ id, side, offset }]` + `maxConnections`. |
| [Multi-line CJK labels](https://dev.flowgl.ouranos.kr/examples/cjk-labels.html) | 한국어, 日本語, 中文测试, mixed and multi-line. |

## Groups & layout

| Example | What it shows |
| --- | --- |
| [Groups with collapse](https://dev.flowgl.ouranos.kr/examples/groups-collapse.html) | `type: 'group'` + `groupDoubleClickCollapses`. |
| [dissolveGroup](https://dev.flowgl.ouranos.kr/examples/dissolve-group.html) | Remove a group container while keeping its children. |
| [Hierarchical layout](https://dev.flowgl.ouranos.kr/examples/hierarchical-layout.html) | `hierarchicalLayout()` driving `chart.setNodes`. |
| [Animated layout](https://dev.flowgl.ouranos.kr/examples/animated-layout.html) | `chart.animateLayout(targets, duration)` smoothstep. |

## Viewport tools

| Example | What it shows |
| --- | --- |
| [Fit view](https://dev.flowgl.ouranos.kr/examples/fit-view.html) | `fitView` / `fitViewToSelection` / `scrollToNode`. |
| [Minimap](https://dev.flowgl.ouranos.kr/examples/minimap.html) | Position + click-to-pan. |
| [Search & highlight](https://dev.flowgl.ouranos.kr/examples/search-highlight.html) | `searchNodes(query)` with dashed highlight. |

## Import / export

| Example | What it shows |
| --- | --- |
| [toJSON / fromJSON](https://dev.flowgl.ouranos.kr/examples/json-roundtrip.html) | Serialize, edit, deserialize roundtrip. |
| [Export PNG](https://dev.flowgl.ouranos.kr/examples/export-png.html) | `exportPNG(scale)` with retina upscale. |
| [Export SVG](https://dev.flowgl.ouranos.kr/examples/export-svg.html) | `exportSVG(padding)` with proper bezier + shape polygons. |

## Contributing an example

Each example is a single HTML file under `demo/examples/<slug>.html` with
inline TS and a `<aside>` hint card explaining what to try. Add the new
`<slug>` to `demo/vite.config.ts` `rollupOptions.input` and add a row to
the table above. PRs welcome.
