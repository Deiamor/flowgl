# Examples gallery

Small, focused, runnable scenarios. Each example is its own HTML + TS
pair under `demo/examples/`, so you can clone the repo and `pnpm dev`
locally, or open the StackBlitz embed and play in the browser.

> Status: scaffolding. The 20 examples below are tracked on the
> [roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md).
> Each will land as its own PR — if you want to write one, please pick
> from the list and comment on the tracking issue.

## Basics

| Example | What it shows |
| --- | --- |
| **Minimal** | A `FlowChart` with three nodes, two edges, default options. |
| **Drag & connect** | Drag nodes, draw connections from handles. |
| **Snap to grid** | `snapGrid: 20` plus a visible dotted grid background. |
| **Keyboard navigation** | Tab cycle, Arrow nudge, Delete, Cmd+Z. |
| **Read-only mode** | `readOnly: true` disables every edit. |

## Selection & multi-select

| Example | What it shows |
| --- | --- |
| **Box select** | Drag on empty canvas to rubber-band. |
| **Cmd-click multi** | Toggle additional nodes into the selection. |
| **Programmatic selection** | `setSelectedIds()` driven by a sidebar. |
| **Align & distribute** | `alignNodes('left')` / `distributeNodes('horizontal')`. |

## Edges

| Example | What it shows |
| --- | --- |
| **Animated edges** | `animated: true` marching ants. |
| **Edge labels** | Midpoint label with pill background. |
| **Waypoints** | Drag the midpoint to create + remove waypoints. |
| **Endpoint reroute** | Drag an endpoint to a different node. |

## Nodes

| Example | What it shows |
| --- | --- |
| **Status badges** | error / warning / success / info badges in the corner. |
| **Custom HTML node** | `htmlContent` with sanitization. |
| **Named ports** | `ports: [{ id, side, offset }]` with `maxConnections`. |
| **Multi-line CJK labels** | `'여러줄\nテスト\n测试'` rendering correctly. |

## Groups & layout

| Example | What it shows |
| --- | --- |
| **Groups with collapse** | `type: 'group'` parent, `groupDoubleClickCollapses: true`. |
| **dissolveGroup** | Remove a group container while keeping its children. |
| **Hierarchical layout** | `hierarchicalLayout(nodes, edges)` driving `chart.setNodes`. |
| **Animated layout transition** | `chart.animateLayout(targets, duration)`. |

## Viewport tools

| Example | What it shows |
| --- | --- |
| **Fit view** | Programmatic + on-load `autoFit`. |
| **Minimap** | Position + click-to-pan. |
| **Search & highlight** | `searchNodes(query)` with a dashed yellow highlight rect. |

## Import / export

| Example | What it shows |
| --- | --- |
| **toJSON / fromJSON roundtrip** | Serialize, edit, deserialize. |
| **Export PNG** | `exportPNG(scale)` with retina upscale. |
| **Export SVG** | `exportSVG(padding)` with proper bezier paths. |

## Contributing an example

An example is a single HTML file under `demo/examples/<slug>.html` with
inline TS. Add a row to the table on this page once it lands. PRs welcome.
